# DBF Mod Manifest, Loader & Project Config Reference

## 1. Mod Discovery & Manifest (`dbf.mod.json`)

Discord Bot Factory discovers mods inside `<projectRoot>/mods/<mod-folder>/dbf.mod.json`.
New projects created in DBF copy their initial `mods/` folder from:
`F:\SteamLibrary\steamapps\common\Discord Bot Factory\windows\_up_\templates\project-template\mods\`

### Complete `dbf.mod.json` Specification

```json
{
  "id": "my-mod-id",
  "name": "My Custom Mod",
  "version": "1.0.0",
  "author": "Author",
  "description": "Concise description shown in the DBF Mods panel.",
  "enabled": true,
  "nodes": [
    "nodes/MyNode.js"
  ],
  "runtime": "runtime.js"
}
```

### Manifest Validation Rules
- `dbf.mod.json` must be a valid JSON object.
- `id`: Normalized to lowercase alphanumeric characters, hyphens (`-`), and underscores (`_`).
- `nodes` (or `editorFiles`): Must be a non-empty array of relative file paths inside the mod folder.
- `runtime` (or `botFiles`): Optional string or array of strings pointing to relative `.js` files inside the mod folder that will be executed in the bot environment.

---

## 2. The `DBFMod` Registration API

When a mod's editor script in `nodes/` is loaded, it is provided with the `DBFMod` registration interface:

| Method | Signature | Description |
| :--- | :--- | :--- |
| `registerActionNode` | `(category: string, config: object)` | Registers an action node in the specified catalog category with standard trigger/output event pins. |
| `registerEventNode` | `(config: object)` | Registers a starter event node under the `"Discord Events"` category with no input pins and a single `"Output"` output pin. |
| `registerSocialEventNode`| `(config: object)` | Registers an external webhook/polling event trigger under `"Social events"`. |
| `registerNode` | `(category: string, config: object)` | Registers a custom node with user-defined input and output slot arrays. |

### Standard Export Patterns for `nodes/*.js`

#### Pattern A: Function Export (Recommended)
```javascript
module.exports = function (DBFMod) {
  DBFMod.registerActionNode("CategoryName", {
    type: "MyNode",
    title: "My Node Title",
    ...
  });
};
```

#### Pattern B: Top-Level Registration
```javascript
DBFMod.registerActionNode("CategoryName", {
  type: "MyNode",
  title: "My Node Title",
  ...
});
```

---

## 3. Project Configuration (`bot.config.json`) Structure

When a bot project is saved, all canvas nodes and flows are serialized into `<projectRoot>/bot.config.json`.

When writing a `runtime.js` that needs to discover placed nodes (such as background schedulers or external stream listeners), scan both `cfg.flow.nodes` and `cfg.flowTabs.tabs`:

```javascript
function getActiveNodesByType(configPath, targetType) {
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const allNodes = [];
  const seenIds = new Set();

  const pushNode = (node) => {
    if (!node || node.disabled) return;
    const id = String(node.id ?? "").trim();
    if (!id || seenIds.has(id)) return;
    if (node.type === targetType || (Array.isArray(targetType) && targetType.includes(node.type))) {
      seenIds.add(id);
      allNodes.push(node);
    }
  };

  // Multi-tab flow structure
  if (cfg.flowTabs && Array.isArray(cfg.flowTabs.tabs)) {
    cfg.flowTabs.tabs.forEach((tab) => {
      if (tab && !tab.disabled && tab.flow && Array.isArray(tab.flow.nodes)) {
        tab.flow.nodes.forEach(pushNode);
      }
    });
  }

  // Single-flow structure
  if (cfg.flow && Array.isArray(cfg.flow.nodes)) {
    cfg.flow.nodes.forEach(pushNode);
  }

  return allNodes;
}
```
