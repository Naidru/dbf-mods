# DBF Editor Node API & Modal Fields Reference

## 1. `DBFMod` Registration Methods

| Method | Category | Default Inputs | Default Outputs | Default `codegen.role` | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DBFMod.registerEventNode(config)` | `"Discord Events"` | `[]` | `[{ name: "Output", type: "event" }]` | `"event"` | Starter/trigger nodes (like "When a message is sent", "When Cron Schedule Triggers"). |
| `DBFMod.registerSocialEventNode(config)` | `"Social events"` | `[]` | `[{ name: "Output", type: "event" }]` | `"event"` | External polling/webhook triggers (like RSS, Twitch, YouTube). |
| `DBFMod.registerActionNode(category, config)` | Custom `category` | `[{ name: "Trigger", type: "event" }]` | `[{ name: "Output", type: "event" }]` | `"action"` | Standard action nodes that execute a step and continue. |
| `DBFMod.registerNode(category, config)` | Custom `category` | Custom `config.inputs` | Custom `config.outputs` | Custom `config.codegen.role` | Custom multi-slot or specialized nodes. |

### Common Built-in Categories & Color Palettes
- `"Discord Events"`: `#22c55e` (bg `#0f3e22`) or `#8b5cf6` (bg `#2e1065`)
- `"Messaging"`: `#8b5cf6` (bg `#4c1d95`)
- `"Moderation"`: `#ef4444` (bg `#450a0a`)
- `"Logic"`: `#f59e0b` (bg `#422006`)
- `"Variables"`: `#3b82f6` (bg `#172554`)
- `"APIs"`: `#06b6d4` (bg `#083344`)
- `"Utility"`: `#10b981` (bg `#064e3b`)

---

## 2. Node Configuration Object Schema

```javascript
{
  type: "UniqueNodeType",           // Required: PascalCase identifier
  aliases: [                        // Optional: Search & legacy aliases
    "Category/UniqueNodeType",
    "Human Readable Search Phrase"
  ],
  title: "Node Title",              // Required: Default title on canvas & catalog
  color: "#8b5cf6",                 // Header bar hex color
  bgcolor: "#2e1065",               // Body background hex color
  size: [250, 110],                 // Default [width, height] in pixels
  description: "Tooltip and catalog description.",
  inputs: [                         // Omit to use role defaults, or specify explicitly
    { name: "Trigger", type: "event" }
  ],
  outputs: [                        // Specify 1 or more output pins
    { name: "Success", type: "event" },
    { name: "Failed", type: "event" }
  ],
  properties: {                     // Default values for node.properties
    myTextProp: "default",
    myModeProp: "modeA",
    myBoolProp: false,
    saveVar: ""
  },
  autoTitle(node) {                 // Optional: Dynamic node title based on properties
    return `My Node (${node?.properties?.myTextProp || "default"})`;
  },
  onNodeCreated() {                 // Optional: Lifecycle hook when placed on canvas
  },
  onConfigure() {                   // Optional: Lifecycle hook when loaded from file
  },
  onPropertyChanged(name, value) {  // Optional: Lifecycle hook when a modal field changes
    if (this.graph && typeof this.graph.setDirtyCanvas === "function") {
      this.graph.setDirtyCanvas(true, true);
    }
  },
  drawForeground(ctx) {             // Optional: Custom HTML5 Canvas 2D rendering on the node body
    ctx.fillStyle = "#f8fafc";
    ctx.font = "12px Inter, Lexend, system-ui, sans-serif";
    ctx.fillText(String(this.properties?.myTextProp || ""), 12, this.size[1] - 20);
  },
  modalFields(node) {               // Required for double-click settings modal
    return [ /* field definitions */ ];
  },
  codegen: {                        // Required for bot code generation
    role: "action",                 // "event" or "action"
    buildAction(nodeData, ctx, helpers) { ... } // or buildCondition(nodeData, ctx)
  }
}
```

---

## 3. Complete `modalFields(node)` Field Types

When a user double-clicks a node on the canvas, DBF invokes `modalFields(node)` and renders a configuration modal.

### 1. Text Input (`type: "text"`)
Supports `{variable}` template syntax automatically.
```javascript
{
  label: "Channel ID *",
  property: "channelId",
  value: node.properties.channelId,
  type: "text",
  placeholder: "e.g. 123456789012345678 or {channel.id}",
  help: "Optional helper text displayed below the input."
}
```

### 2. Multi-line Textarea (`type: "textarea"`)
```javascript
{
  label: "Payload Body",
  property: "body",
  value: node.properties.body,
  type: "textarea",
  placeholder: "{\n  \"ok\": true\n}",
  help: "Supports multi-line text or JSON."
}
```

### 3. Number Input (`type: "number"`)
```javascript
{
  label: "Timeout (seconds)",
  property: "timeoutSeconds",
  value: node.properties.timeoutSeconds,
  type: "number",
  min: 1,
  max: 300,
  step: 1,
  placeholder: "15"
}
```

### 4. Select Dropdown (`type: "select"`)
```javascript
{
  label: "HTTP Method",
  property: "method",
  value: node.properties.method,
  type: "select",
  options: [
    { label: "POST", value: "POST" },
    { label: "GET", value: "GET" }
  ],
  help: "Choose how the request is sent."
}
```

### 5. Boolean Toggle (`type: "boolean"`)
```javascript
{
  label: "Run Once on Bot Startup",
  property: "runOnStartup",
  value: !!node.properties.runOnStartup,
  type: "boolean",
  help: "When enabled, runs immediately on bot startup."
}
```

### 6. Variable Save Picker (`type: "variableSave"`)
Renders DBF's built-in Local/Global variable selector widget. Always pass `parts` and `schemaParts` alongside `saveSchema` when your variable provides sub-variables:
```javascript
{
  label: "Save Result to Variable",
  property: "saveVar",
  value: node.properties.saveVar,
  type: "variableSave",
  saveLabel: "the response data",
  autoLabel: "my_response",
  saveSchema: "api_response",
  parts: MY_VARIABLE_PARTS,
  schemaParts: MY_VARIABLE_PARTS,
  help: "Stores the result into a local or global flow variable."
}
```

### 7. Collapsible Sections (`collapsibleStart` & `collapsibleEnd`)
Group advanced settings cleanly inside an expandable accordion:
```javascript
{
  type: "collapsibleStart",
  label: "Advanced Settings",
  summary: "Configure timeouts, headers, and retries."
},
// ... fields inside the collapsible section ...
{
  type: "collapsibleEnd"
}
```

### 8. Conditional Field Visibility (`showWhen`)
Any field can include a `showWhen` rule to appear only when other properties match specific values:
```javascript
// Single condition:
showWhen: { property: "authType", equals: "bearer" }

// Any of multiple conditions:
showWhen: {
  anyOf: [
    { property: "format", equals: "sha256" },
    { property: "format", equals: "md5" }
  ]
}

// Multiple conditions (all must match):
showWhen: {
  allOf: [
    { property: "deliveryMode", equals: "webhook" },
    { property: "useCustomAvatar", equals: true }
  ]
}
```

---

## 4. Live Modal Field DOM Validation & Layout Standards

When a node requires live input feedback (e.g. testing regex, evaluating CRON schedules, or showing a live preview) while the user types inside the configuration modal:

1. **Attach in `setTimeout` inside `modalFields(node)` & Match Inputs Strictly**:
   Since modal DOM elements are mounted asynchronously after `modalFields(node)` returns, query the DOM after a small delay (~50ms) and guard elements with a `__liveHooked` property to avoid duplicate listeners.
   - **CRITICAL**: **NEVER** match an optional text input using `el.value === node.properties.myProperty` when `myProperty` can be empty (`""`)! When a field is hidden by `showWhen`, `el.value === ""` will match an empty `variableSave` input and hide or corrupt the variable save widget. Always match by `el.name`, `el.getAttribute("data-property")`, or a unique `el.placeholder` substring:
   ```javascript
   if (typeof document !== "undefined") {
     setTimeout(() => {
       try {
         const input = Array.from(document.querySelectorAll('input[type="text"]')).find(
           el =>
             el.name === "myProperty" ||
             el.getAttribute("data-property") === "myProperty" ||
             (el.placeholder && el.placeholder.includes("unique placeholder text"))
         );
         if (!input || input.__liveHooked) return;
         input.__liveHooked = true;
         // Attach input, change, and keyup listeners...
       } catch (_) {}
     }, 50);
   }
   ```

2. **CRITICAL Layout Rule: Enforce Column Flex ONLY on the Specific Target Input**:
   DBF modal containers use horizontal flex rows by default, and `variableSave` relies on a horizontal flex row.
   - **NEVER** loop over all modal inputs (`inputs.forEach(...)`) to set `flexDirection = "column"`, as that breaks the `variableSave` widget!
   - Apply column flex protection **ONLY** to the specific `input` receiving the live helper element:
   ```javascript
   const parent = input.parentElement || input.parentNode;
   if (parent) {
     parent.style.display = "flex";
     parent.style.flexDirection = "column";
     parent.style.alignItems = "stretch";
     parent.style.width = "100%";
   }
   input.style.width = "100%";
   input.style.minWidth = "0";
   input.style.boxSizing = "border-box";
   ```

3. **Validator Element Placement & Styling**:
   Search for existing `.field-help` or `small` elements in the container first. If creating a new helper element, insert it after the input with full width:
   ```javascript
   if (!helpEl && parent) {
     helpEl = document.createElement("div");
     helpEl.className = "field-help live-validation-help";
     if (input.nextSibling) {
       parent.insertBefore(helpEl, input.nextSibling);
     } else {
       parent.appendChild(helpEl);
     }
   }
   if (helpEl) {
     helpEl.style.display = "block";
     helpEl.style.width = "100%";
     helpEl.style.boxSizing = "border-box";
     helpEl.style.marginTop = "6px";
     helpEl.style.fontSize = "12px";
     helpEl.style.lineHeight = "1.4";
     helpEl.style.wordBreak = "break-word";
     helpEl.style.clear = "both";
   }
   ```

---

## 5. Custom Sub-Variables & Editor Autocomplete Enhancement

When saving structured data to a variable (`saveVar`), DBF's editor only natively suggests sub-properties for built-in Discord entities (`user`, `channel`, `message`, etc.). For custom schemas, the editor displays only `Local: <var> {<var>} — Saved local text variable`.

### Critical Rules for Sub-Variable Autocomplete:
1. **NEVER** use naive selectors like `document.querySelector(".autocomplete-dropdown, [class*='autocomplete']")` or `popup.querySelector("div")`.
2. **NEVER** overwrite `row.textContent` directly (which destroys DBF's label + monospace token child structure).
3. **NEVER** call `popup.remove()` when inserting a variable (which permanently removes DBF's autocomplete container from the DOM and breaks variable selection across the editor). Instead, dispatch an `Escape` `KeyboardEvent` and remove only injected `[data-cron-subvar], [data-dbf-subvar]` rows.
4. **NEVER climb ancestor containers in a `while (textContent === txt)` loop**: When the user types a specific variable name (e.g. `"cron"`), that variable may be the ONLY match in the autocomplete list. When only one item matches, the text of the item, the list wrapper, the popup container, and even `document.body` all equal `"{var}"`! Climbing ancestors causes `baseItem` to resolve to `document.body`, cloning the entire application DOM 9 times and causing an immediate, fatal UI freeze. Bound `rowCandidate` strictly to immediate list items (`el.closest("button, [role='option'], li, .autocomplete-item, [class*='item']") || el.parentElement`) and reject `document.body` or `document.documentElement`.
5. **Debounce DOM Enhancement via `requestAnimationFrame`**: Never run `enhancePopup()` synchronously on every input or mutation. Schedule through `requestAnimationFrame` so rapid keystrokes and microtask events coalesce into at most one enhance pass per frame.
6. **Filter Self-Mutations in `MutationObserver`**: Check `MutationRecord[]` in the observer and ignore mutations where added/removed nodes have `[data-dbf-subvar]` or target has `[data-cron-enhanced]` to eliminate feedback loops.
7. **Coordinated Singleton Coordinator**: Guard enhancer registration with `globalThis.__dbfSharedAutocompleteActive`. All installed custom mods register variables into `globalThis.__dbfCustomModVars`, and exactly one singleton enhancer manages DOM injections and keyboard listeners without cross-mod observer battles.
8. **Clear custom sub-variable selection (`clearSubSelection()`)** whenever the user hovers or clicks any native DBF variable row in `listContainer` so native variables can be selected and inserted without interference.

### Complete Reference Implementation for `nodes/*.js`:

Copy and adapt this self-contained block into any node script that provides sub-variables (see [examples/action-node-template.js](../examples/action-node-template.js) and [examples/starter-event-node-template.js](../examples/starter-event-node-template.js)):

```javascript
const MY_VARIABLE_PARTS = [
  { name: "value", label: "Processed Value", type: "string", description: "The processed output value." },
  { name: "timestamp", label: "Timestamp", type: "string", description: "ISO-8601 timestamp." }
];

const MY_VAR_DESCRIPTION = "Saved custom action result (supports .value, .timestamp).";

function isValidVarName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  if (/^[Xx]+-[Xx]+/.test(trimmed)) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmed);
}

function getSharedCustomModVarsMap() {
  if (!globalThis.__dbfCustomModVars || !(globalThis.__dbfCustomModVars instanceof Map)) {
    globalThis.__dbfCustomModVars = new Map();
  }
  return globalThis.__dbfCustomModVars;
}

function registerMyModVarName(rawSaveVar, defaultAutoLabel = "action_result", schema = "custom_action") {
  const norm = normalizeSaveVarProp(rawSaveVar);
  const name = norm.name || defaultAutoLabel;
  if (!isValidVarName(name)) return;
  const sharedMap = getSharedCustomModVarsMap();
  sharedMap.set(name.toLowerCase(), {
    name,
    scope: norm.scope || "local",
    schema,
    description: MY_VAR_DESCRIPTION,
    parts: MY_VARIABLE_PARTS
  });
}
```
And invoke `setupEditorAutocompleteEnhancer()` (full implementation included in [examples/action-node-template.js](../examples/action-node-template.js)).
