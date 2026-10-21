# DBF Codegen & Bot Runtime API Reference

## 1. Flow Compilation Contracts

In Discord Bot Factory, flows are compiled into JavaScript routines executed by `bot.js`. Custom nodes provide code snippets through their `codegen` configuration.

### Event Node Contract (`codegen.role === "event"`)
Event nodes initiate a flow when a matching event occurs. For each event node, `codegen.buildCondition(nodeData, ctx)` must return:

```javascript
{
  condition: "<JavaScript boolean expression evaluated against the incoming message/stub>",
  label: "<Human-readable trigger name used in logging>"
}
```

When an event triggers, if `condition` evaluates to `true`, downstream connected actions execute.

### Action Node Contract (`codegen.role === "action"`)
Action nodes execute steps in sequence. For each action node, `codegen.buildAction(nodeData, ctx, helpers)` returns JavaScript statements:

- **`nodeData`**: Object containing `{ id, type, title, properties, inputs, outputs }`.
- **`ctx`**: Helper context providing:
  - `ctx.escape(str)`: Escapes strings for inclusion in single-quoted literals.
  - `ctx.prefix`: The bot's command prefix.
  - `ctx.getNodeSuffix(nodeData)`: Returns a unique variable suffix (e.g. `_42`) to prevent variable name collisions in flow scope.
- **`helpers`**: Link navigation helpers:
  - `helpers.buildChainForSlot(slotIndex)`: Returns an array of compiled JavaScript code strings for all nodes connected to the output pin at `slotIndex`.

`buildAction` returns:
```javascript
{
  code: "<JavaScript code string>",
  skipNext: false // Set to true ONLY when you manually embed helpers.buildChainForSlot(...) inside branching logic
}
```

---

## 2. Self-Contained Helpers for Mod Node Files (`nodes/*.js`)

Because mod node files run in an isolated module scope, include these standard JavaScript helper functions directly in your node scripts:

```javascript
function escapeJsStr(str, ctx) {
  const raw = String(str ?? "");
  if (ctx && typeof ctx.escape === "function") return ctx.escape(raw);
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function getSuffix(nodeData, ctx) {
  if (ctx && typeof ctx.getNodeSuffix === "function") {
    const s = ctx.getNodeSuffix(nodeData);
    if (s) return s;
  }
  return `_${String(nodeData?.id ?? Math.floor(Math.random() * 1e6)).replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function normalizeSaveVarProp(raw) {
  if (!raw && raw !== 0) return { name: "", scope: "local", parts: [], schema: "" };
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return normalizeSaveVarProp(parsed);
        }
      } catch (_) {}
    }
    return { name: trimmed, scope: "local", parts: [], schema: "" };
  }
  if (typeof raw === "object") {
    const scope = String(raw.scope || "").toLowerCase() === "global" ? "global" : "local";
    return {
      name: String(raw.name || "").trim(),
      scope,
      parts: Array.isArray(raw.parts) ? raw.parts : [],
      schema: String(raw.schema || "").trim().toLowerCase()
    };
  }
  return { name: "", scope: "local", parts: [], schema: "" };
}

function buildSaveVarSnippet(raw, valueExpr = "''", forcedSchema = "") {
  const normalized = normalizeSaveVarProp(raw);
  if (!normalized.name) return "";
  const literal = JSON.stringify({
    name: normalized.name,
    scope: normalized.scope || "local",
    parts: normalized.parts || [],
    schema: forcedSchema || normalized.schema || ""
  });
  return `
    (() => {
      const _saveCfg = ${literal};
      const _saveName = resolveTemplateVars(String(_saveCfg.name || ''), message).trim();
      const _saveScope = String(_saveCfg.scope || 'local').toLowerCase();
      const _saveSchema = String(_saveCfg.schema || '').trim().toLowerCase();
      if (_saveName) {
        const _val = ${valueExpr};
        setVariable(_saveName, _val, _saveScope, message, { schema: _saveSchema, parts: _saveCfg.parts });
        if (_val && typeof _val === 'object') {
          for (const [k, v] of Object.entries(_val)) {
            setVariable(\`\${_saveName}.\${k}\`, v, _saveScope, message);
          }
        }
      }
    })();`;
}

function buildSaveVarCondition(condition, label, saveVar, valueExpr, schema = "") {
  const saveSnippet = buildSaveVarSnippet(saveVar, valueExpr, schema);
  if (!saveSnippet) return { condition, label };
  return {
    condition: `${condition} && (() => { ${saveSnippet} return true; })()`,
    label
  };
}
```

---

## 3. Public Bot Runtime Environment & Standard Globals

In both `buildAction` generated code and `runtime.js`, standard bot functions and objects are available:

### Core Flow & Variable Functions
- **`client`**: The standard `discord.js` v14 `Client` instance (`client.user`, `client.guilds.cache`, `client.channels.fetch(...)`, etc.).
- **`message`**: The active flow execution context or message object.
- **`runFlowWithMessage(messageStub, eventType, payload)`**: Triggers bot flows matching the given `eventType` and `payload`.
- **`resolveTemplateVars(templateString, message)`**: Resolves `{variable}` and `{user.*}` placeholders into a string.
- **`resolveTemplateValue(templateString, message)`**: Resolves a template expression and returns the underlying value.
- **`setVariable(name, value, scope, message, options)`**:
  - `scope`: `'local'` (current flow execution) or `'global'` (persisted across runs).
  - `options`: `{ schema: '...' }`.
- **`getVariable(name, scope, message)`**: Retrieves a `'local'` or `'global'` variable value.

### Database Operations (SQLite)
If the project uses local SQLite tables (`data/dbf.sqlite`), standard database helper functions are available:
- `dbfDbResolveTableRef(tableName, aliases)`
- `dbfDbFindRows(tableRef, options)`
- `dbfDbInsertRow(tableRef, values)`
- `dbfDbUpdateRows(tableRef, options)`
- `dbfDbDeleteRows(tableRef, options)`
- `dbfDbRunSql(sql, params, mode)`

### Discord.js Client Ready Compatibility
In `discord.js` v14.15+ and v15, listening to `'ready'` logs:
`DeprecationWarning: The ready event has been renamed to clientReady to distinguish it from the gateway READY event and will only emit under that name in v15.`

In `runtime.js`, always listen for `clientReady` with a safe fallback:
```javascript
const readyEvent = (typeof Events !== "undefined" && Events.ClientReady) ? Events.ClientReady : "clientReady";
if (client.isReady && client.isReady()) {
  onStartup();
} else {
  client.once(readyEvent, onStartup);
}
```
