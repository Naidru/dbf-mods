// ============================================================================
// DBF Action Node Template (Single-Slot & Multi-Branch Examples)
// ============================================================================
// Copy this template when creating custom action or logic nodes that execute
// inside a flow and optionally branch to "Success" / "Failed" output pins.
// ============================================================================

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
        setVariable(_saveName, ${valueExpr}, _saveScope, message, { schema: _saveSchema });
      }
    })();`;
}

module.exports = function (DBFMod) {
  // --------------------------------------------------------------------------
  // Example: Branching Action Node (Slot 0 = Success, Slot 1 = Failed)
  // For a simple 1-output node, omit `outputs` and omit `skipNext: true`.
  // --------------------------------------------------------------------------
  DBFMod.registerActionNode("Utility", {
    type: "CustomBranchingAction",
    aliases: ["Utility/CustomBranchingAction", "Custom Action"],
    title: "Custom Branching Action",
    color: "#10b981",
    bgcolor: "#064e3b",
    size: [250, 110],
    description: "Executes custom logic, saves the result to a variable, and routes to Success or Failed.",
    inputs: [
      { name: "Trigger", type: "event" }
    ],
    outputs: [
      { name: "Success", type: "event" },
      { name: "Failed", type: "event" }
    ],
    properties: {
      inputValue: "",
      saveVar: ""
    },
    drawForeground(ctx) {
      const val = String(this.properties?.inputValue || "").trim();
      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px Inter, Lexend, system-ui, sans-serif";
      const display = val ? (val.length > 28 ? val.slice(0, 25) + "..." : val) : "Configure input";
      ctx.fillText(display, 12, this.size[1] - 20);
    },
    modalFields(node) {
      return [
        {
          label: "Input Value *",
          property: "inputValue",
          value: node.properties.inputValue || "",
          type: "text",
          placeholder: "Enter text or {variable}",
          help: "Supports template variables like {message.content}."
        },
        {
          label: "Save Result to Variable",
          property: "saveVar",
          value: node.properties.saveVar,
          type: "variableSave",
          saveLabel: "the processed output",
          autoLabel: "action_result"
        }
      ];
    },
    codegen: {
      role: "action",
      buildAction(nodeData, ctx, helpers = {}) {
        const suffix = getSuffix(nodeData, ctx);
        const inputEsc = escapeJsStr(nodeData?.properties?.inputValue || "", ctx);
        const saveSnippet = buildSaveVarSnippet(nodeData?.properties?.saveVar, `_result${suffix}`);

        const successChain = helpers.buildChainForSlot ? helpers.buildChainForSlot(0) : [];
        const failedChain = helpers.buildChainForSlot ? helpers.buildChainForSlot(1) : [];

        return {
          code: `
    let _ok${suffix} = false;
    let _result${suffix} = null;
    try {
      const _resolvedInput${suffix} = resolveTemplateVars('${inputEsc}', message);
      if (!_resolvedInput${suffix}) {
        throw new Error('Input value was empty');
      }
      _result${suffix} = {
        input: _resolvedInput${suffix},
        processedAt: new Date().toISOString()
      };
      ${saveSnippet}
      _ok${suffix} = true;
    } catch (_err${suffix}) {
      console.warn('CustomBranchingAction failed:', _err${suffix}?.message || _err${suffix});
    }
    if (_ok${suffix}) {
${(successChain || []).join("\n")}
    } else {
${(failedChain || []).join("\n")}
    }`,
          skipNext: true
        };
      }
    }
  });
};
