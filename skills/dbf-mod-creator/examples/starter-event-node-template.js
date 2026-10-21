// ============================================================================
// DBF Starter / Event Node Template
// ============================================================================
// Copy this template when creating a custom starter/trigger node (0 inputs,
// 1 "Trigger" output) that starts a flow when an event fires from runtime.js.
// ============================================================================

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

function buildSaveVarCondition(condition, label, saveVar, valueExpr, schema = "") {
  const normalized = normalizeSaveVarProp(saveVar);
  if (!normalized.name) return { condition, label };
  const literal = JSON.stringify({
    name: normalized.name,
    scope: normalized.scope || "local",
    parts: normalized.parts || [],
    schema: schema || normalized.schema || ""
  });
  const saveSnippet = `(() => {
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
  return {
    condition: `${condition} && (() => { ${saveSnippet} return true; })()`,
    label
  };
}

module.exports = function (DBFMod) {
  const nodeConfig = {
    type: "CustomStarterEvent",
    aliases: [
      "Events/CustomStarterEvent",
      "When Custom Event Triggers"
    ],
    title: "When Custom Event Triggers",
    color: "#8b5cf6",
    bgcolor: "#2e1065",
    size: [260, 105],
    description: "Starts a flow when the custom event is triggered by the bot runtime.",
    inputs: [],
    outputs: [
      {
        name: "Trigger",
        type: "event"
      }
    ],
    properties: {
      eventKey: "default",
      saveVar: ""
    },
    autoTitle(node) {
      const key = String(node?.properties?.eventKey || "default").trim();
      return `When ${key} triggers`;
    },
    drawForeground(ctx) {
      const key = String(this.properties?.eventKey || "default").trim();

      ctx.fillStyle = "#c084fc";
      ctx.font = "bold 11px Inter, Lexend, system-ui, sans-serif";
      ctx.fillText("CUSTOM TRIGGER", 12, this.size[1] - 38);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px Inter, Lexend, system-ui, sans-serif";
      const display = key.length > 28 ? key.slice(0, 25) + "..." : key;
      ctx.fillText(`Key: ${display}`, 12, this.size[1] - 18);
    },
    modalFields(node) {
      // Live DOM observer example for real-time validation without shrinking the input
      if (typeof document !== "undefined") {
        setTimeout(() => {
          try {
            const input = Array.from(document.querySelectorAll('input[type="text"]')).find(
              el => el.name === "eventKey" || el.value === node.properties.eventKey
            );
            if (!input || input.__liveHooked) return;
            input.__liveHooked = true;

            // Enforce vertical column layout so helper text never squeezes the text input
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
          } catch (_) {}
        }, 50);
      }

      return [
        {
          label: "Event Key *",
          property: "eventKey",
          value: node.properties.eventKey || "default",
          type: "text",
          placeholder: "default",
          help: "Identifier for this trigger."
        },
        {
          label: "Save Event Info to Variable (optional)",
          property: "saveVar",
          value: node.properties.saveVar,
          type: "variableSave",
          saveLabel: "the trigger event payload",
          autoLabel: "custom_event",
          saveSchema: "custom_event",
          parts: [
            { name: "nodeId", label: "Node ID", type: "string" },
            { name: "timestamp", label: "Timestamp", type: "string" }
          ]
        }
      ];
    },
    codegen: {
      role: "event",
      buildCondition(nodeData, ctx) {
        const id = String(nodeData?.id ?? "").trim();
        const idEsc = id.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const condition = `message.__eventType === 'customStarterEvent' && message.__eventPayload?.nodeId === '${idEsc}'`;
        const label = String(nodeData?.properties?.eventKey || "Custom Event").trim();
        return buildSaveVarCondition(
          condition,
          label,
          nodeData?.properties?.saveVar,
          `(message.__eventPayload || {})`,
          "custom_event"
        );
      }
    }
  };

  if (DBFMod && typeof DBFMod.registerEventNode === "function") {
    return DBFMod.registerEventNode(nodeConfig);
  }
  if (DBFMod && typeof DBFMod.registerNode === "function") {
    return DBFMod.registerNode("Discord Events", nodeConfig);
  }
};
