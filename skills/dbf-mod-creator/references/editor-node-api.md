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
Renders DBF's built-in Local/Global variable selector widget.
```javascript
{
  label: "Save Result to Variable",
  property: "saveVar",
  value: node.properties.saveVar,
  type: "variableSave",
  saveLabel: "the response data",
  autoLabel: "my_response",
  saveSchema: "api_response",
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

// Multiple conditions (all must match):
showWhen: {
  allOf: [
    { property: "deliveryMode", equals: "webhook" },
    { property: "useCustomAvatar", equals: true }
  ]
}
```
