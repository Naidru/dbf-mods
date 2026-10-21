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
       // Use robust ID coercion so tabbed or numeric LiteGraph IDs match reliably
       const condition = `(message.__eventType === 'myCustomEvent' && (String(message.__eventPayload?.nodeId || '').trim() === '${id}' || message.__eventPayload?.nodeId == '${id}'))`;
       const label = "My Custom Event";
       return buildSaveVarCondition(condition, label, nodeData?.properties?.saveVar, `(message.__eventPayload || {})`, "my_schema");
     }
   }
   ```
3. In `runtime.js`, read `bot.config.json` (scanning both `cfg.flow.nodes` and `cfg.flowTabs.tabs[].flow.nodes` where `!tab.disabled && !node.disabled`).
4. **CRITICAL: Robust Message Stub Construction for Starter Events**:
   When background schedulers or external events trigger a flow, there is no incoming Discord user message. Downstream action nodes (such as DBF's native "Send Message", "Reply to Message", "Send Embed", or permission checks) rely on `message.channel`, `message.guild`, `message.member`, and `message.reply`:
   - **Never rely only on `botClient.guilds.cache.first()`**: The first guild may not be populated yet, may have no text channels, or the bot may be in multiple servers. Search `botClient.channels.cache` across all guilds, iterate through all cached guilds, and optionally fetch channels if Gateway cache has not finished populating.
   - **Always provide a fallback channel**: If no active Discord text channel is available (e.g. when a friend runs the bot before joining a server), provide a fallback channel object with `send: async (msg) => { console.warn('[Mod:ChannelSend]', msg); }`. This prevents downstream nodes from throwing fatal `Cannot read properties of null (reading 'send')` or silently aborting.
   - **Delegate `stub.reply`**: Route `stub.reply(...)` to `stub.channel.send(...)` so downstream "Reply" nodes actually output messages instead of silently resolving to a no-op function.
   - **Populate `stub.guild`, `stub.member`, and IDs**: Ensure `stub.guildId`, `stub.channelId`, `stub.user`, and `stub.member` (defaulting to `guild.members.me`) are present so permission checks and guild-scoped variables succeed.
   - **Wrap Variable Saving in `try / catch`**: Always enclose `saveSnippet` execution in `try / catch` so missing properties or scopes never cause condition evaluation to abort.
   - See [examples/runtime-template.js](./examples/runtime-template.js) for the complete implementation.

### Contract 4: How Action Nodes & Branching Slots Work
1. Register the node with `DBFMod.registerActionNode("CategoryName", nodeConfig)`.
2. In `codegen`:
   - **Single Output Slot**: Return `{ code: "..." }`. The runner continues to the next connected node after your code finishes.
   - **Multiple Branching Output Slots** (e.g., Slot 0 = `"Success"`, Slot 1 = `"Failed"`):
     Use `helpers.buildChainForSlot(0)` and `helpers.buildChainForSlot(1)` to get the downstream code arrays for each slot, embed `(branch || []).join('\n')` inside your `if / else` blocks, and return **`skipNext: true`** so the runner does not also execute downstream nodes unconditionally afterward.

### Contract 5: Sub-Variables & Editor Autocomplete Suggestions (`{var.subVar}`)
When a mod saves structured data or sub-properties into a variable (e.g. `{ code, value, format, length, timestamp }` or `{ nodeId, runCount, timestamp, frequency }`), users expect to access both the main variable `{my_var}` and individual sub-variables like `{my_var.code}` or `{my_var.runCount}`:
1. **`variableSave` Modal Field Definition**: Always pass both `parts` and `schemaParts` alongside `saveSchema` on the `variableSave` field in `modalFields(node)`:
   ```javascript
   {
     label: "Save Result to Variable",
     property: "saveVar",
     value: node.properties.saveVar,
     type: "variableSave",
     saveLabel: "the result",
     autoLabel: "my_result",
     saveSchema: "my_schema",
     parts: MY_VARIABLE_PARTS,
     schemaParts: MY_VARIABLE_PARTS
   }
   ```
2. **Runtime Codegen**: In `buildSaveVarSnippet`, set the main variable AND register each sub-variable property key with `setVariable`:
   ```javascript
   const _mainVal = (_val && typeof _val === 'object' && 'code' in _val) ? _val.code : _val;
   setVariable(_saveName, _mainVal, _saveScope, message, { schema: _saveSchema, parts: _saveCfg.parts });
   if (_val && typeof _val === 'object') {
     for (const [k, v] of Object.entries(_val)) {
       setVariable(`${_saveName}.${k}`, v, _saveScope, message);
     }
   }
   ```
3. **Editor Autocomplete Enhancement (CRITICAL — Freeze Prevention & Layout Safety)**:
   - DBF's editor only natively knows sub-variables for built-in Discord entities (`user`, `channel`, `message`, etc.).
   - **NEVER** use naive selectors like `document.querySelector("[class*='autocomplete']")` or `popup.querySelector("div")`, **NEVER** overwrite `row.textContent` directly, and **NEVER** call `popup.remove()` (which permanently destroys DBF's autocomplete DOM container!).
   - **NEVER climb ancestor containers in a `while (textContent === txt)` loop**: When the user types a specific variable name (e.g. `"cron"`), that variable may be the ONLY match in the autocomplete list. When only one item matches, the text of the item, the list wrapper, the popup container, and even `document.body` all equal `"{var}"`! Climbing ancestors causes `baseItem` to resolve to `document.body`, cloning the entire application DOM 9 times and causing an immediate, fatal UI freeze. Bound `rowCandidate` strictly to immediate list items (`el.closest("button, [role='option'], li, .autocomplete-item, [class*='item']") || el.parentElement`) and reject `document.body` or `document.documentElement`.
   - **Debounce DOM Enhancement via `requestAnimationFrame`**: Never run `enhancePopup()` synchronously on every input or mutation. Schedule through `requestAnimationFrame` so rapid keystrokes and microtask events coalesce into at most one enhance pass per frame.
   - **Filter Self-Mutations in `MutationObserver`**: Check `MutationRecord[]` in the observer and ignore mutations where added/removed nodes have `[data-dbf-subvar]` or target has `[data-cron-enhanced]` to eliminate feedback loops.
   - **Coordinated Singleton Coordinator**: Guard enhancer registration with `globalThis.__dbfSharedAutocompleteActive`. All installed custom mods register variables into `globalThis.__dbfCustomModVars`, and exactly one singleton enhancer manages DOM injections and keyboard listeners without cross-mod observer battles.
   - Always copy the complete, battle-tested `setupEditorAutocompleteEnhancer()` implementation from [references/editor-node-api.md](./references/editor-node-api.md) / [examples/action-node-template.js](./examples/action-node-template.js).

### Contract 6: Live Modal Field DOM Validation & Layout Standards
When rendering live helper text, real-time validators, or live previews under text inputs in double-click settings modals:
1. **Target ONLY the Specific Input (Never `inputs.forEach`)**:
   - DBF modal field containers use flexbox, and the `variableSave` widget relies on a horizontal flex row.
   - **NEVER** run `inputs.forEach(...)` to set `flexDirection = "column"` on all inputs in the modal — doing so breaks the `variableSave` widget layout! Apply column flex protection **ONLY** to the specific input receiving the live helper element:
   ```javascript
   if (targetInput && targetInput.parentElement) {
     targetInput.parentElement.style.display = "flex";
     targetInput.parentElement.style.flexDirection = "column";
     targetInput.parentElement.style.alignItems = "stretch";
     targetInput.parentElement.style.width = "100%";
     targetInput.style.width = "100%";
     targetInput.style.minWidth = "0";
     targetInput.style.boxSizing = "border-box";
   }
   ```
2. **Never Match Optional Inputs by Empty `el.value`**:
   - When locating an optional input in the DOM (especially one controlled by `showWhen`), **NEVER** use `|| el.value === node.properties.myOptionalProp` when `myOptionalProp` can be `""`. When hidden, that fallback matches an empty `variableSave` input and hides or corrupts the variable picker! Match strictly by `el.name`, `el.getAttribute("data-property")`, or a unique `el.placeholder` substring.
3. **Exclude Node Inputs & Validate Names When Watching `variableSave`**:
   - When attaching live `input`/`change` listeners to capture custom variable names typed into `variableSave`, explicitly exclude your node's own text inputs and validate with `isValidVarName(v)` (`/^[a-zA-Z_][a-zA-Z0-9_-]*$/`, excluding numbers and patterns like `"XXXX-XXXX"`).
4. **Placement**: Reuse existing `.field-help` / `.help` elements when available, or insert the live validator element directly after the target input with `width: 100%; display: block; margin-top: 6px; clear: both; word-break: break-word;`.

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
