---
name: dbf-mod-creator
description: >-
  Use this skill whenever the user asks to create, modify, debug, or package a
  custom mod or custom node (starter/trigger node, action node, branching logic
  node, or editor/runtime extension) for Discord Bot Factory (DBF). Provides a
  complete, clean-room public API specification, codegen architecture, modal field
  types, and bot runtime integration standards.
---

# Discord Bot Factory (DBF) Mod Creator Skill

This skill provides a clean-room specification and template suite required to design, implement, validate, and deploy functional mods for **Discord Bot Factory (DBF)** using only public modding interfaces and standard Node.js APIs.

---

## 1. Mod Directory Structure & Manifest

Every DBF mod lives in its own folder inside `<project>/mods/<mod-id>/`:

```text
mods/<mod-id>/
├── dbf.mod.json           # Required: Mod manifest
├── nodes/
│   └── MyCustomNode.js    # Required: At least 1 editor node script
└── runtime.js             # Optional: Bot runtime script executed in bot.js
```

### `dbf.mod.json` Schema
```json
{
  "id": "my-mod-id",
  "name": "Human Readable Mod Name",
  "version": "1.0.0",
  "author": "Author Name",
  "description": "What this mod does.",
  "nodes": [
    "nodes/MyCustomNode.js"
  ],
  "runtime": "runtime.js"
}
```
- **`id`**: Lowercase alphanumeric + hyphens (`^[a-z0-9-_]+$`).
- **`nodes`**: Non-empty array of relative paths to editor node scripts.
- **`runtime`**: Relative path (or array of paths) to runtime scripts executed in the bot runner. Omit if the mod only uses inline `codegen` inside `buildAction` and does not need a background loop or event listener.

---

## 2. Modding Architecture & Functional Contracts

### Contract 1: Editor Scripts Run in an Isolated Module Scope
Each node file in `nodes/` runs in an isolated CommonJS-style module environment. The script receives `module`, `exports`, and `DBFMod` as arguments:
- Mod scripts should be completely self-contained. They do not share global variables or private closures with other editor scripts.
- Use the self-contained, standard JavaScript helper functions provided in [examples/starter-event-node-template.js](./examples/starter-event-node-template.js) and [examples/action-node-template.js](./examples/action-node-template.js) for escaping strings and saving variables.

### Contract 2: Runtime Lifecycle & Idempotency
Mod runtime scripts (`runtime.js`) are executed in the bot process when flows are dispatched in `bot.js`.
- Because flow execution functions are called repeatedly during the bot's operation, **always guard your background timers and listeners** with a `globalThis` initialization flag:
  ```javascript
  if (globalThis.__myModInit) return;
  globalThis.__myModInit = true;
  ```
- Capture and store references to `client` and `runFlowWithMessage` when they become available so that background schedulers and asynchronous event handlers can trigger flows anytime.

### Contract 3: How Starter / Event Nodes Trigger Flows
1. Register the node with `DBFMod.registerEventNode(nodeConfig)` (which configures `inputs: []`, `outputs: [{ name: "Trigger", type: "event" }]`, and category `"Discord Events"`).
2. In `codegen`:
   ```javascript
   codegen: {
     role: "event",
     buildCondition(nodeData, ctx) {
       const id = String(nodeData?.id ?? "").trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
       const condition = `message.__eventType === 'myCustomEvent' && message.__eventPayload?.nodeId === '${id}'`;
       const label = "My Custom Event";
       return buildSaveVarCondition(condition, label, nodeData?.properties?.saveVar, `(message.__eventPayload || {})`, "my_schema");
     }
   }
   ```
3. In `runtime.js`, read `bot.config.json` (scanning both `cfg.flow.nodes` and `cfg.flowTabs.tabs[].flow.nodes` where `!tab.disabled && !node.disabled`), and when your event occurs, dispatch:
   ```javascript
   await flowRunner(stubMessage, "myCustomEvent", {
     nodeId: String(node.id),
     /* custom payload properties */
   });
   ```

### Contract 4: How Action Nodes & Branching Slots Work
1. Register the node with `DBFMod.registerActionNode("CategoryName", nodeConfig)`.
2. In `codegen`:
   - **Single Output Slot**: Return `{ code: "..." }`. The runner continues to the next connected node after your code finishes.
   - **Multiple Branching Output Slots** (e.g., Slot 0 = `"Success"`, Slot 1 = `"Failed"`):
     Use `helpers.buildChainForSlot(0)` and `helpers.buildChainForSlot(1)` to get the downstream code arrays for each slot, embed `(branch || []).join('\n')` inside your `if / else` blocks, and return **`skipNext: true`** so the runner does not also execute downstream nodes unconditionally afterward.

### Contract 5: Sub-Variables & Editor Autocomplete Suggestions (`{var.subVar}`)
When a mod saves an object payload into a variable (e.g. `{ nodeId, runCount, timestamp, frequency }`), users expect to access both the full object `{my_var}` and individual fields like `{my_var.runCount}`:
1. **Runtime Codegen**: In `buildSaveVarSnippet`, set the main object AND register each property key with `setVariable`:
   ```javascript
   setVariable(_saveName, _val, _saveScope, message, { schema: _saveSchema, parts: _saveCfg.parts });
   if (_val && typeof _val === 'object') {
     for (const [k, v] of Object.entries(_val)) {
       setVariable(`${_saveName}.${k}`, v, _saveScope, message);
     }
   }
   ```
2. **Editor Autocomplete Enhancement**: DBF's editor only knows sub-variables for built-in Discord entities (`user`, `channel`, `message`, etc.). For custom mod schemas, DBF defaults to showing `Local: <var> {<var>} — Saved local text variable`. To provide native autocomplete for `{my_var.field}`, mod editor scripts attach a lightweight DOM observer to the editor window that intercepts the autocomplete popup, renders sub-variable suggestions cloned from DBF's native row style, and updates the preview card.

### Contract 6: Live Modal Field DOM Validation & Layout Standards
When rendering live helper text / real-time validators under text inputs in double-click settings modals:
1. **Flex Column Protection**: DBF modal field containers use flexbox. Appending helper text inside a horizontal flex row causes the text input to shrink into a tiny cut-off box. Always enforce vertical column layout and 100% width on the field container:
   ```javascript
   if (input.parentElement) {
     input.parentElement.style.display = "flex";
     input.parentElement.style.flexDirection = "column";
     input.parentElement.style.alignItems = "stretch";
     input.parentElement.style.width = "100%";
   }
   input.style.width = "100%";
   input.style.minWidth = "0";
   input.style.boxSizing = "border-box";
   ```
2. **Placement**: Reuse existing `.field-help` / `.help` elements when available, or insert the live validator element directly after the input with `width: 100%; display: block; margin-top: 6px; clear: both; word-break: break-word;`.

### Contract 7: Discord.js v14/v15 Event Compatibility
Modern Discord.js (v14.15+ and v15) emits a deprecation warning if listening to `'ready'` (`DeprecationWarning: The ready event has been renamed to clientReady`). In runtime scripts, always listen to `Events.ClientReady || 'clientReady'` with a fallback to `'ready'`:
```javascript
const readyEvent = (typeof Events !== "undefined" && Events.ClientReady) ? Events.ClientReady : "clientReady";
if (client.isReady && client.isReady()) {
  onClientReady();
} else {
  client.once(readyEvent, onClientReady);
}
```

---

## 3. Step-by-Step Workflow

1. **Choose the Template**:
   - Building a starter/trigger node (e.g., recurring scheduler or external stream)? Read and use [examples/starter-event-node-template.js](./examples/starter-event-node-template.js) and [examples/runtime-template.js](./examples/runtime-template.js).
   - Building an action or logic node (e.g., query, extraction, hashing, or sending commands)? Read and use [examples/action-node-template.js](./examples/action-node-template.js).
2. **Consult Reference Specs When Needed**:
   - For `modalFields` property types (`text`, `textarea`, `number`, `select`, `boolean`, `variableSave`, `showWhen`, collapsible sections) and canvas rendering, see [references/editor-node-api.md](./references/editor-node-api.md).
   - For public `bot.js` scope variables (`resolveTemplateVars`, `setVariable`, `getVariable`, `client`), see [references/bot-runtime-and-codegen.md](./references/bot-runtime-and-codegen.md).
   - For manifest specifications and project configuration structure, see [references/mod-manifest-and-loader.md](./references/mod-manifest-and-loader.md).
3. **Validate & Deploy**:
   - Run `node --check` on every `.js` file and verify `dbf.mod.json` parses as valid JSON.
