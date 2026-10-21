// ============================================================================
// Cron & Quartz Schedule Trigger Starter Node
// ============================================================================
// Clean-room implementation for Discord Bot Factory (DBF).
// Supports 5-part UNIX and 6/7-part Quartz CRON expressions with timezone offsets.
// Displays expression validity and human-readable frequency under the field & on canvas.
// Supports full sub-variable access and editor auto-suggestions:
// {cron_trigger_info.runCount}, {cron_trigger_info.timestamp}, etc.
// ============================================================================

const CRON_VARIABLE_PARTS = [
  {
    name: "runCount",
    label: "Run count",
    type: "number",
    description: "Total number of times this schedule has triggered since bot startup."
  },
  {
    name: "timestamp",
    label: "Trigger timestamp",
    type: "string",
    description: "ISO-8601 timestamp of when this cron schedule triggered."
  },
  {
    name: "reason",
    label: "Trigger reason",
    type: "string",
    description: "Why the flow was triggered ('schedule' or 'startup')."
  },
  {
    name: "frequency",
    label: "Schedule frequency",
    type: "string",
    description: "Human-readable schedule frequency (e.g. Every Monday at 00:00)."
  },
  {
    name: "timezoneAbbr",
    label: "Timezone abbreviation",
    type: "string",
    description: "Short timezone abbreviation for the schedule (e.g. EDT / AST)."
  },
  {
    name: "timezone",
    label: "Timezone offset",
    type: "string",
    description: "Configured UTC offset for the schedule (e.g. UTC-04:00)."
  },
  {
    name: "cronExpression",
    label: "CRON expression",
    type: "string",
    description: "Raw 5-part UNIX or 6/7-part Quartz CRON expression."
  },
  {
    name: "isQuartz",
    label: "Is Quartz schedule",
    type: "boolean",
    description: "True if using 6/7-part Quartz format, false if 5-part UNIX format."
  },
  {
    name: "nodeId",
    label: "Node ID",
    type: "string",
    description: "Unique ID of the Cron Schedule Trigger node that fired."
  }
];

function escapeJsStr(str, ctx) {
  const raw = String(str ?? "");
  if (ctx && typeof ctx.escape === "function") return ctx.escape(raw);
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function normalizeSaveVarProp(raw) {
  if (!raw && raw !== 0) return { name: "", scope: "local", parts: CRON_VARIABLE_PARTS, schema: "cron_trigger" };
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
    return { name: trimmed, scope: "local", parts: CRON_VARIABLE_PARTS, schema: "cron_trigger" };
  }
  if (typeof raw === "object") {
    const scope = String(raw.scope || "").toLowerCase() === "global" ? "global" : "local";
    const parts = Array.isArray(raw.parts) && raw.parts.length ? raw.parts : CRON_VARIABLE_PARTS;
    return {
      name: String(raw.name || "").trim(),
      scope,
      parts,
      schema: String(raw.schema || "cron_trigger").trim().toLowerCase()
    };
  }
  return { name: "", scope: "local", parts: CRON_VARIABLE_PARTS, schema: "cron_trigger" };
}

// ============================================================================
// Known Cron Variable Registry & Editor Sub-Variable Autocomplete Enhancer
// ============================================================================

function getSharedCustomModVarsMap() {
  if (!globalThis.__dbfCustomModVars || !(globalThis.__dbfCustomModVars instanceof Map)) {
    globalThis.__dbfCustomModVars = new Map();
  }
  return globalThis.__dbfCustomModVars;
}

const CRON_VAR_DESCRIPTION =
  "Saved cron schedule trigger object (supports .runCount, .timestamp, .frequency, etc.).";

function getKnownCronVarsMap() {
  const sharedMap = getSharedCustomModVarsMap();
  if (!globalThis.__dbfCronTriggerVars || !(globalThis.__dbfCronTriggerVars instanceof Map)) {
    globalThis.__dbfCronTriggerVars = new Map();
    const defaultEntry = {
      name: "cron_trigger_info",
      scope: "local",
      schema: "cron_trigger",
      description: CRON_VAR_DESCRIPTION,
      parts: CRON_VARIABLE_PARTS
    };
    globalThis.__dbfCronTriggerVars.set("cron_trigger_info", defaultEntry);
    sharedMap.set("cron_trigger_info", defaultEntry);
    if (typeof localStorage !== "undefined") {
      try {
        const saved = JSON.parse(localStorage.getItem("__dbf_cron_trigger_vars") || "[]");
        if (Array.isArray(saved)) {
          saved.forEach((entry) => {
            if (entry && entry.name) {
              const item = {
                name: String(entry.name),
                scope: entry.scope === "global" ? "global" : "local",
                schema: "cron_trigger",
                description: CRON_VAR_DESCRIPTION,
                parts: CRON_VARIABLE_PARTS
              };
              const key = String(entry.name).toLowerCase();
              globalThis.__dbfCronTriggerVars.set(key, item);
              sharedMap.set(key, item);
            }
          });
        }
      } catch (_) {}
    }
  }
  return globalThis.__dbfCronTriggerVars;
}

function isValidVarName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  if (/^[Xx]+-[Xx]+/.test(trimmed)) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmed);
}

function registerCronVarName(rawSaveVar) {
  const norm = normalizeSaveVarProp(rawSaveVar);
  const name = norm.name || "cron_trigger_info";
  if (!isValidVarName(name)) return;
  const map = getKnownCronVarsMap();
  const sharedMap = getSharedCustomModVarsMap();
  const key = name.toLowerCase();
  const entry = {
    name,
    scope: norm.scope || "local",
    schema: "cron_trigger",
    description: CRON_VAR_DESCRIPTION,
    parts: CRON_VARIABLE_PARTS
  };
  map.set(key, entry);
  sharedMap.set(key, entry);
  if (typeof localStorage !== "undefined") {
    try {
      const serializable = Array.from(map.values()).map((v) => ({
        name: v.name,
        scope: v.scope
      }));
      localStorage.setItem("__dbf_cron_trigger_vars", JSON.stringify(serializable));
    } catch (_) {}
  }
}

function registerCronNodeVars(node) {
  if (!node) return;
  if (node.properties && node.properties.saveVar) {
    registerCronVarName(node.properties.saveVar);
  }
  const graphNodes = node.graph && Array.isArray(node.graph._nodes) ? node.graph._nodes : null;
  if (graphNodes) {
    graphNodes.forEach((n) => {
      if (n && n.type === "CronTrigger" && n.properties && n.properties.saveVar) {
        registerCronVarName(n.properties.saveVar);
      }
    });
  }
}

function getCursorVarQuery(inputEl) {
  if (!inputEl || typeof inputEl.value !== "string") return null;
  const val = inputEl.value;
  const selStart = typeof inputEl.selectionStart === "number" ? inputEl.selectionStart : val.length;
  const before = val.slice(0, selStart);
  const match = before.match(/(\{?)([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_]*))?$/);
  if (!match) return null;
  return {
    hasBrace: match[1] === "{",
    varName: match[2],
    hasDot: match[3] !== undefined,
    subFilter: String(match[3] || "").toLowerCase()
  };
}

function insertSubVarToken(inputEl, varName, fullToken) {
  if (!inputEl) return;
  const val = String(inputEl.value || "");
  const selStart = typeof inputEl.selectionStart === "number" ? inputEl.selectionStart : val.length;
  const selEnd = typeof inputEl.selectionEnd === "number" ? inputEl.selectionEnd : selStart;
  const before = val.slice(0, selStart);
  let after = val.slice(selEnd);

  const escapedVar = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixRegex = new RegExp(`\\{?${escapedVar}(?:\\.[a-zA-Z0-9_]*)?$`, "i");
  let newBefore;
  if (prefixRegex.test(before)) {
    newBefore = before.replace(prefixRegex, fullToken);
  } else if (before.endsWith("{")) {
    newBefore = before.slice(0, -1) + fullToken;
  } else {
    newBefore = before + fullToken;
  }

  if (after.startsWith("}")) {
    after = after.slice(1);
  }

  const nextVal = newBefore + after;
  const proto =
    inputEl.tagName === "TEXTAREA"
      ? typeof HTMLTextAreaElement !== "undefined" && HTMLTextAreaElement.prototype
      : typeof HTMLInputElement !== "undefined" && HTMLInputElement.prototype;
  const nativeSetter = proto ? Object.getOwnPropertyDescriptor(proto, "value")?.set : null;

  if (nativeSetter) {
    nativeSetter.call(inputEl, nextVal);
  } else {
    inputEl.value = nextVal;
  }

  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));

  try {
    inputEl.focus();
    inputEl.setSelectionRange(newBefore.length, newBefore.length);
  } catch (_) {}
}

function setupEditorAutocompleteEnhancer() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (globalThis.__dbfSharedAutocompleteActive) return;
  globalThis.__dbfSharedAutocompleteActive = true;

  if (typeof globalThis.__dbfSharedAutocompleteCleanup === "function") {
    try {
      globalThis.__dbfSharedAutocompleteCleanup();
    } catch (_) {}
  }

  let activeInputEl = null;
  let isMutating = false;
  let activePopupState = null;
  let fallbackPopupEl = null;
  let enhanceFrameId = null;

  function scheduleEnhance() {
    if (enhanceFrameId !== null) return;
    enhanceFrameId = requestAnimationFrame(() => {
      enhanceFrameId = null;
      enhancePopup();
    });
  }

  function scanGlobalGraphVars() {
    getKnownCronVarsMap();
    const sharedMap = getSharedCustomModVarsMap();
    try {
      if (typeof LGraphCanvas !== "undefined" && LGraphCanvas.active_canvas?.graph?._nodes) {
        LGraphCanvas.active_canvas.graph._nodes.forEach((n) => {
          if (!n || !n.properties?.saveVar) return;
          if (n.type === "CronTrigger") {
            registerCronVarName(n.properties.saveVar);
          }
        });
      }
    } catch (_) {}
    return sharedMap;
  }

  function hideFallbackPopup() {
    if (fallbackPopupEl && fallbackPopupEl.parentNode) {
      fallbackPopupEl.parentNode.removeChild(fallbackPopupEl);
    }
    fallbackPopupEl = null;
    if (activePopupState && activePopupState.isFallback) {
      activePopupState = null;
    }
  }

  function styleRowSelected(el, isSelected) {
    if (!el) return;
    if (isSelected) {
      el.style.borderColor = "#3b82f6";
      el.style.background = "rgba(30, 64, 175, 0.22)";
      el.style.boxShadow = "0 0 0 1px rgba(59, 130, 246, 0.35)";
    } else {
      el.style.borderColor = "rgba(148, 163, 184, 0.18)";
      el.style.background = "rgba(15, 23, 42, 0.55)";
      el.style.boxShadow = "none";
      el.style.outline = "none";
    }
  }

  function updateSubItemLabels(subItem, varName, labelText, tokenText) {
    const leaves = Array.from(subItem.querySelectorAll("*")).filter((el) => el.children.length === 0);
    const tokenLeaf =
      leaves.find((el) => (el.textContent || "").includes(`{${varName}`)) ||
      leaves[leaves.length - 1] ||
      null;
    const labelLeaf = leaves.find((el) => el !== tokenLeaf) || null;

    if (labelLeaf && tokenLeaf && labelLeaf !== tokenLeaf) {
      labelLeaf.textContent = labelText;
      tokenLeaf.textContent = tokenText;
      return;
    }

    if (tokenLeaf) {
      let replacedTextNode = false;
      subItem.childNodes.forEach((node) => {
        if (node.nodeType === 3 && (node.nodeValue || "").trim()) {
          node.nodeValue = `${labelText} `;
          replacedTextNode = true;
        }
      });
      if (replacedTextNode) {
        tokenLeaf.textContent = tokenText;
        return;
      }
    }

    subItem.innerHTML = "";
    const leftSpan = document.createElement("span");
    leftSpan.textContent = labelText;
    const rightSpan = document.createElement("span");
    rightSpan.style.opacity = "0.75";
    rightSpan.style.fontFamily = "monospace";
    rightSpan.textContent = tokenText;
    subItem.appendChild(leftSpan);
    subItem.appendChild(rightSpan);
  }

  function closeNativePopup(inputEl) {
    hideFallbackPopup();
    if (activePopupState && activePopupState.popupContainer) {
      const pc = activePopupState.popupContainer;
      activePopupState = null;
      if (inputEl) {
        try {
          inputEl.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
              which: 27,
              bubbles: true
            })
          );
        } catch (_) {}
      }
      pc.querySelectorAll("[data-cron-subvar], [data-dbf-subvar]").forEach((el) => el.remove());
    }
  }

  function renderFallbackPopup(inputEl, varMeta, subFilter) {
    const varName = varMeta.name;
    const partsList = Array.isArray(varMeta.parts) && varMeta.parts.length ? varMeta.parts : CRON_VARIABLE_PARTS;
    const filteredParts = partsList.filter(
      (p) =>
        !subFilter ||
        p.name.toLowerCase().includes(subFilter) ||
        p.label.toLowerCase().includes(subFilter)
    );
    if (!filteredParts.length) {
      hideFallbackPopup();
      return;
    }

    if (!fallbackPopupEl) {
      fallbackPopupEl = document.createElement("div");
      fallbackPopupEl.setAttribute("data-cron-fallback-popup", "true");
      fallbackPopupEl.style.cssText = [
        "position: fixed",
        "z-index: 999999",
        "background: #0b0f17",
        "border: 1px solid rgba(148, 163, 184, 0.2)",
        "border-radius: 12px",
        "padding: 10px",
        "display: grid",
        "grid-template-columns: minmax(220px, 1fr) 230px",
        "gap: 12px",
        "box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65)",
        "color: #f8fafc",
        "font-family: Inter, Lexend, system-ui, sans-serif",
        "box-sizing: border-box"
      ].join(";");
      document.body.appendChild(fallbackPopupEl);
    }

    const rect = inputEl.getBoundingClientRect();
    const width = Math.max(480, Math.min(620, rect.width));
    const top = Math.min(window.innerHeight - 280, rect.bottom + 6);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
    fallbackPopupEl.style.width = `${width}px`;
    fallbackPopupEl.style.top = `${top}px`;
    fallbackPopupEl.style.left = `${left}px`;

    fallbackPopupEl.innerHTML = "";

    const listCol = document.createElement("div");
    listCol.style.cssText = [
      "display: flex",
      "flex-direction: column",
      "gap: 6px",
      "max-height: 240px",
      "overflow-y: auto",
      "padding-right: 4px"
    ].join(";");

    const previewCol = document.createElement("div");
    previewCol.style.cssText = [
      "border: 1px solid rgba(148, 163, 184, 0.16)",
      "border-radius: 10px",
      "padding: 12px",
      "background: rgba(15, 23, 42, 0.45)",
      "display: flex",
      "flex-direction: column",
      "gap: 6px"
    ].join(";");

    const titleEl = document.createElement("div");
    titleEl.style.cssText = "font-weight: 700; font-size: 14px; color: #f8fafc;";
    const tokenEl = document.createElement("div");
    tokenEl.style.cssText = "font-size: 12px; color: #cbd5e1; font-family: monospace;";
    const descEl = document.createElement("div");
    descEl.style.cssText = "font-size: 12px; color: #94a3b8; line-height: 1.4; flex: 1;";
    const insertBtn = document.createElement("button");
    insertBtn.type = "button";
    insertBtn.textContent = "Insert";
    insertBtn.style.cssText = [
      "align-self: flex-end",
      "background: #2563eb",
      "color: #ffffff",
      "border: none",
      "border-radius: 8px",
      "padding: 6px 14px",
      "font-size: 12px",
      "font-weight: 600",
      "cursor: pointer",
      "margin-top: 6px"
    ].join(";");

    previewCol.appendChild(titleEl);
    previewCol.appendChild(tokenEl);
    previewCol.appendChild(descEl);
    previewCol.appendChild(insertBtn);

    const items = [];
    const state = {
      isFallback: true,
      popupContainer: fallbackPopupEl,
      varName,
      items,
      selectedIndex: 0,
      selectIndex(idx) {
        if (idx < 0 || idx >= items.length) return;
        state.selectedIndex = idx;
        items.forEach((it, i) => styleRowSelected(it.el, i === idx));
        const chosen = items[idx];
        titleEl.textContent = chosen.label;
        tokenEl.textContent = chosen.token;
        descEl.textContent = chosen.description;
        try {
          chosen.el.scrollIntoView({ block: "nearest" });
        } catch (_) {}
      },
      insertSelected() {
        const chosen = items[state.selectedIndex];
        if (!chosen) return;
        insertSubVarToken(inputEl, chosen.varName || varName, chosen.token);
        hideFallbackPopup();
      }
    };

    filteredParts.forEach((part, idx) => {
      const token = `{${varName}.${part.name}}`;
      const row = document.createElement("button");
      row.type = "button";
      row.setAttribute("data-cron-subvar", part.name);
      row.setAttribute("data-dbf-subvar", `${varName}.${part.name}`);
      row.style.cssText = [
        "display: flex",
        "justify-content: space-between",
        "align-items: center",
        "width: 100%",
        "padding: 8px 12px",
        "border-radius: 8px",
        "border: 1px solid rgba(148, 163, 184, 0.18)",
        "background: rgba(15, 23, 42, 0.55)",
        "color: #f8fafc",
        "font-size: 13px",
        "cursor: pointer",
        "text-align: left",
        "box-sizing: border-box"
      ].join(";");

      const leftSpan = document.createElement("span");
      leftSpan.style.cssText = "font-weight: 600; color: #f8fafc;";
      leftSpan.textContent = part.label;

      const rightSpan = document.createElement("span");
      rightSpan.style.cssText = "font-size: 12px; color: #94a3b8; font-family: monospace;";
      rightSpan.textContent = token;

      row.appendChild(leftSpan);
      row.appendChild(rightSpan);

      row.addEventListener("mouseenter", () => state.selectIndex(idx));
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.selectIndex(idx);
        state.insertSelected();
      });

      listCol.appendChild(row);
      items.push({
        el: row,
        varName,
        partName: part.name,
        label: part.label,
        token,
        description: part.description
      });
    });

    insertBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.insertSelected();
    });

    fallbackPopupEl.appendChild(listCol);
    fallbackPopupEl.appendChild(previewCol);

    activePopupState = state;
    state.selectIndex(0);
  }

  function enhancePopup() {
    if (isMutating) return;
    isMutating = true;
    try {
      const knownMap = scanGlobalGraphVars();
      const currentInput =
        (document.activeElement &&
          (document.activeElement.tagName === "TEXTAREA" ||
            document.activeElement.tagName === "INPUT") &&
          document.activeElement) ||
        activeInputEl;
      const cursorQuery = getCursorVarQuery(currentInput);

      // Find all native autocomplete base items matching known custom mod variables
      const matchedBases = [];
      const seenBaseEls = new Set();

      const candidateElements = Array.from(
        document.querySelectorAll(
          "button, [role='option'], li, .autocomplete-item, [class*='item'], [class*='option'], [class*='row'], [class*='autocomplete'] *"
        )
      );

      for (let i = 0; i < candidateElements.length; i++) {
        const el = candidateElements[i];
        if (el.children.length !== 0) continue;
        if (
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SCRIPT" ||
          el.tagName === "STYLE" ||
          el.tagName === "CANVAS"
        ) {
          continue;
        }
        if (
          el.closest("[data-cron-subvar]") ||
          el.closest("[data-dbf-subvar]") ||
          el.closest("[data-cron-fallback-popup]")
        ) {
          continue;
        }
        if (el.getAttribute("data-cron-preview-role")) continue;

        const txt = (el.textContent || "").trim();
        if (!txt.startsWith("{") || !txt.endsWith("}") || txt.includes(".")) continue;
        const rawVar = txt.slice(1, -1).trim();
        const varKey = rawVar.toLowerCase();
        if (!knownMap.has(varKey)) continue;

        let rowCandidate = el.closest
          ? el.closest("button, [role='option'], li, .autocomplete-item, [class*='item'], [class*='option'], [class*='row']")
          : el.parentElement;
        if (!rowCandidate) {
          rowCandidate = el.parentElement;
        }
        if (
          !rowCandidate ||
          rowCandidate === document.body ||
          rowCandidate === document.documentElement ||
          seenBaseEls.has(rowCandidate)
        ) {
          continue;
        }
        if (["BODY", "HTML", "INPUT", "TEXTAREA", "CANVAS"].includes(rowCandidate.tagName)) {
          continue;
        }

        const listContainer = rowCandidate.parentElement;
        if (
          !listContainer ||
          listContainer === document.body ||
          listContainer === document.documentElement
        ) {
          continue;
        }

        // Distinguish left list row from right preview panel
        const rowText = (rowCandidate.textContent || "").trim();
        if (rowText === "Insert") continue;
        const hasInsertBtn = Array.from(rowCandidate.querySelectorAll("button")).some(
          (b) => (b.textContent || "").trim() === "Insert"
        );
        if (hasInsertBtn) continue;
        if (/Saved\s+(local|global)\s+/i.test(rowText)) continue;

        let pCheck = rowCandidate.parentElement;
        let insidePreviewPanel = false;
        while (pCheck && pCheck !== document.body) {
          const pText = pCheck.textContent || "";
          const pHasInsert = Array.from(pCheck.querySelectorAll("button")).some(
            (b) => (b.textContent || "").trim() === "Insert"
          );
          if (pHasInsert && /Saved\s+(local|global)\s+/i.test(pText)) {
            const occurrences = pText.split(`{${rawVar}}`).length - 1;
            if (occurrences === 1) {
              insidePreviewPanel = true;
              break;
            }
          }
          pCheck = pCheck.parentElement;
        }
        if (insidePreviewPanel) continue;

        const varMeta = knownMap.get(varKey);
        rowCandidate.setAttribute("data-cron-base-var", varMeta.name);
        seenBaseEls.add(rowCandidate);
        matchedBases.push({ baseItem: rowCandidate, varMeta });
      }

      const taggedBases = Array.from(document.querySelectorAll("[data-cron-base-var]"));
      for (const el of taggedBases) {
        if (!document.body.contains(el) || seenBaseEls.has(el)) continue;
        if (el === document.body || el === document.documentElement) continue;
        const vKey = String(el.getAttribute("data-cron-base-var") || "").toLowerCase();
        if (knownMap.has(vKey)) {
          seenBaseEls.add(el);
          matchedBases.push({ baseItem: el, varMeta: knownMap.get(vKey) });
        }
      }

      if (!matchedBases.length) {
        if (
          currentInput &&
          document.activeElement === currentInput &&
          cursorQuery &&
          cursorQuery.hasDot &&
          knownMap.has(cursorQuery.varName.toLowerCase())
        ) {
          const varMeta = knownMap.get(cursorQuery.varName.toLowerCase());
          renderFallbackPopup(currentInput, varMeta, cursorQuery.subFilter);
        } else {
          hideFallbackPopup();
        }
        return;
      }

      // Native popup is open; hide standalone fallback popup
      hideFallbackPopup();

      const firstBaseItem = matchedBases[0].baseItem;
      const listContainer = firstBaseItem.parentElement;
      if (
        !listContainer ||
        listContainer === document.body ||
        listContainer === document.documentElement
      ) {
        return;
      }

      // Locate popupContainer & preview elements
      let popupContainer = listContainer.parentElement;
      let insertBtnEl = null;
      while (popupContainer && popupContainer !== document.body) {
        const btns = Array.from(popupContainer.querySelectorAll("button"));
        insertBtnEl = btns.find((b) => (b.textContent || "").trim() === "Insert") || null;
        if (insertBtnEl) break;
        popupContainer = popupContainer.parentElement;
      }
      if (!popupContainer || popupContainer === document.body) {
        popupContainer = listContainer.parentElement || listContainer;
      }

      if (!popupContainer.__cronPreviewRefs && insertBtnEl) {
        let previewPanel = insertBtnEl.parentElement;
        while (
          previewPanel &&
          previewPanel !== popupContainer &&
          !previewPanel.contains(listContainer) &&
          !(previewPanel.textContent || "").includes("{")
        ) {
          previewPanel = previewPanel.parentElement;
        }
        if (!previewPanel || previewPanel.contains(listContainer)) {
          previewPanel = insertBtnEl.parentElement;
        }
        if (previewPanel) {
          const leaves = Array.from(previewPanel.querySelectorAll("*")).filter(
            (el) => el.children.length === 0 && el !== insertBtnEl
          );
          const tokenEl =
            leaves.find((el) => /^\{[^{}]+\}$/.test((el.textContent || "").trim())) ||
            leaves[1] ||
            null;
          const firstVarName = matchedBases[0].varMeta.name;
          const titleEl =
            leaves.find((el) => el !== tokenEl && (el.textContent || "").includes(firstVarName)) ||
            leaves[0] ||
            null;
          const descEl =
            leaves.find((el) => el !== tokenEl && el !== titleEl) ||
            leaves[2] ||
            null;
          if (titleEl) titleEl.setAttribute("data-cron-preview-role", "title");
          if (tokenEl) tokenEl.setAttribute("data-cron-preview-role", "token");
          if (descEl) descEl.setAttribute("data-cron-preview-role", "desc");
          popupContainer.__cronPreviewRefs = {
            titleEl,
            tokenEl,
            descEl,
            insertBtnEl
          };
        }
      }

      const previewRefs = popupContainer.__cronPreviewRefs || null;
      const queryKey = cursorQuery
        ? `${cursorQuery.varName.toLowerCase()}:${cursorQuery.hasDot ? "dot" : "root"}:${cursorQuery.subFilter}`
        : "none";
      const varsKey = matchedBases.map((m) => m.varMeta.name.toLowerCase()).join(",");
      const renderKey = `${varsKey}::${queryKey}`;

      if (
        listContainer.getAttribute("data-cron-enhanced") === renderKey &&
        activePopupState &&
        activePopupState.popupContainer === popupContainer
      ) {
        return;
      }

      listContainer.setAttribute("data-cron-enhanced", renderKey);
      const existingSubEls = Array.from(
        listContainer.querySelectorAll("[data-cron-subvar], [data-dbf-subvar]")
      );
      existingSubEls.forEach((el) => el.remove());

      listContainer.style.maxHeight = listContainer.style.maxHeight || "260px";
      listContainer.style.overflowY = listContainer.style.overflowY || "auto";

      const items = [];
      let initialSelectIndex = -1;

      matchedBases.forEach(({ baseItem, varMeta }) => {
        const varName = varMeta.name;
        const partsList = Array.isArray(varMeta.parts) && varMeta.parts.length ? varMeta.parts : CRON_VARIABLE_PARTS;
        const isDotQueryForThisVar =
          cursorQuery &&
          cursorQuery.hasDot &&
          cursorQuery.varName.toLowerCase() === varName.toLowerCase();
        const subFilter = isDotQueryForThisVar ? cursorQuery.subFilter : "";

        if (isDotQueryForThisVar) {
          baseItem.style.display = "none";
        } else {
          baseItem.style.display = "";
          const baseIdx = items.length;
          const scopePrefix = varMeta.scope === "global" ? "Global" : "Local";
          items.push({
            el: baseItem,
            isBase: true,
            varName,
            partName: "",
            label: `${scopePrefix}: ${varName}`,
            token: `{${varName}}`,
            description: varMeta.description || CRON_VAR_DESCRIPTION
          });
          if (initialSelectIndex === -1 && baseItem === listContainer.firstElementChild) {
            initialSelectIndex = baseIdx;
          }
        }

        const filteredParts = partsList.filter(
          (p) =>
            !subFilter ||
            p.name.toLowerCase().includes(subFilter) ||
            p.label.toLowerCase().includes(subFilter)
        );

        let insertAfterEl = baseItem;
        filteredParts.forEach((part) => {
          const token = `{${varName}.${part.name}}`;
          const subItem = baseItem.cloneNode(true);
          subItem.removeAttribute("data-cron-base-var");
          subItem.setAttribute("data-cron-subvar", part.name);
          subItem.setAttribute("data-dbf-subvar", `${varName}.${part.name}`);
          subItem.style.display = "";
          subItem.style.marginTop = "4px";
          updateSubItemLabels(subItem, varName, part.label, token);

          if (insertAfterEl.nextSibling) {
            listContainer.insertBefore(subItem, insertAfterEl.nextSibling);
          } else {
            listContainer.appendChild(subItem);
          }
          insertAfterEl = subItem;

          const subIdx = items.length;
          items.push({
            el: subItem,
            isBase: false,
            varName,
            partName: part.name,
            label: part.label,
            token,
            description: part.description
          });
          if (isDotQueryForThisVar && initialSelectIndex === -1) {
            initialSelectIndex = subIdx;
          }
        });
      });

      const state = {
        isFallback: false,
        popupContainer,
        listContainer,
        items,
        selectedIndex: initialSelectIndex,
        clearSubSelection() {
          state.selectedIndex = -1;
          items.forEach((it) => {
            if (!it.isBase) styleRowSelected(it.el, false);
          });
        },
        selectIndex(idx) {
          if (idx < 0 || idx >= items.length) {
            state.clearSubSelection();
            return;
          }
          isMutating = true;
          try {
            state.selectedIndex = idx;
            items.forEach((it, i) => styleRowSelected(it.el, i === idx));
            const chosen = items[idx];
            if (previewRefs && chosen) {
              if (previewRefs.titleEl) previewRefs.titleEl.textContent = chosen.label;
              if (previewRefs.tokenEl) previewRefs.tokenEl.textContent = chosen.token;
              if (previewRefs.descEl) previewRefs.descEl.textContent = chosen.description;
            }
            try {
              chosen.el.scrollIntoView({ block: "nearest" });
            } catch (_) {}
          } finally {
            isMutating = false;
          }
        },
        insertSelected() {
          const chosen = items[state.selectedIndex];
          const targetInput =
            (document.activeElement &&
              (document.activeElement.tagName === "TEXTAREA" ||
                document.activeElement.tagName === "INPUT") &&
              !popupContainer.contains(document.activeElement) &&
              document.activeElement) ||
            activeInputEl ||
            currentInput;
          if (!chosen || !targetInput) return false;
          insertSubVarToken(targetInput, chosen.varName, chosen.token);
          closeNativePopup(targetInput);
          return true;
        }
      };

      const itemElSet = new Set(items.map((it) => it.el));

      items.forEach((item, idx) => {
        if (item.isBase) {
          item.el.__dbfBaseSelectFn = () => {
            if (activePopupState === state) state.selectIndex(idx);
          };
          if (!item.el.__cronBaseHooked) {
            item.el.__cronBaseHooked = true;
            item.el.addEventListener("mouseenter", () => {
              if (typeof item.el.__dbfBaseSelectFn === "function") {
                item.el.__dbfBaseSelectFn();
              }
            });
            item.el.addEventListener("mousedown", () => {
              if (typeof item.el.__dbfBaseSelectFn === "function") {
                item.el.__dbfBaseSelectFn();
              }
            });
          }
        } else {
          item.el.addEventListener("mouseenter", () => state.selectIndex(idx));
          item.el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            state.selectIndex(idx);
            state.insertSelected();
          });
        }
      });

      listContainer.__dbfNativeRowCheck = (e) => {
        if (activePopupState !== state) return;
        const row = e.target && e.target.closest ? e.target.closest("button, [role='option'], li, .autocomplete-item, [class*='item']") : null;
        if (row && listContainer.contains(row) && !itemElSet.has(row)) {
          state.clearSubSelection();
        }
      };
      if (!listContainer.__dbfContainerHooked) {
        listContainer.__dbfContainerHooked = true;
        listContainer.addEventListener("mouseover", (e) => {
          if (typeof listContainer.__dbfNativeRowCheck === "function") {
            listContainer.__dbfNativeRowCheck(e);
          }
        });
        listContainer.addEventListener("mousedown", (e) => {
          if (typeof listContainer.__dbfNativeRowCheck === "function") {
            listContainer.__dbfNativeRowCheck(e);
          }
        });
      }

      activePopupState = state;
      if (initialSelectIndex >= 0) {
        state.selectIndex(initialSelectIndex);
      }
    } catch (_) {
    } finally {
      isMutating = false;
    }
  }

  const onFocusOrInput = (e) => {
    const t = e.target;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
      if (!activePopupState || !activePopupState.popupContainer || !activePopupState.popupContainer.contains(t)) {
        activeInputEl = t;
      }
    }
    scheduleEnhance();
  };

  const onKeyDownCapture = (e) => {
    if (!activePopupState || !activePopupState.items || !activePopupState.items.length) return;
    if (!document.body.contains(activePopupState.popupContainer)) {
      activePopupState = null;
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const next =
        activePopupState.selectedIndex < 0
          ? 0
          : (activePopupState.selectedIndex + 1) % activePopupState.items.length;
      activePopupState.selectIndex(next);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const prev =
        activePopupState.selectedIndex <= 0
          ? activePopupState.items.length - 1
          : activePopupState.selectedIndex - 1;
      activePopupState.selectIndex(prev);
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      const chosen =
        activePopupState.selectedIndex >= 0
          ? activePopupState.items[activePopupState.selectedIndex]
          : null;
      if (chosen && !chosen.isBase) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        activePopupState.insertSelected();
      }
      return;
    }

    if (e.key === "Escape") {
      hideFallbackPopup();
    }
  };

  const onMouseDownCapture = (e) => {
    if (!activePopupState || !document.body.contains(activePopupState.popupContainer)) return;
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (
      btn &&
      (btn.textContent || "").trim() === "Insert" &&
      activePopupState.popupContainer.contains(btn)
    ) {
      const chosen =
        activePopupState.selectedIndex >= 0
          ? activePopupState.items[activePopupState.selectedIndex]
          : null;
      if (chosen && !chosen.isBase) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        activePopupState.insertSelected();
      }
      return;
    }
    if (
      activePopupState.isFallback &&
      !activePopupState.popupContainer.contains(e.target) &&
      e.target !== activeInputEl
    ) {
      hideFallbackPopup();
    }
  };

  document.addEventListener("focusin", onFocusOrInput, true);
  document.addEventListener("input", onFocusOrInput, true);
  document.addEventListener("keyup", onFocusOrInput, true);
  document.addEventListener("click", onFocusOrInput, true);
  document.addEventListener("keydown", onKeyDownCapture, true);
  document.addEventListener("mousedown", onMouseDownCapture, true);

  let observer = null;
  if (typeof MutationObserver !== "undefined" && document.body) {
    observer = new MutationObserver((mutations) => {
      if (isMutating) return;
      let foreignChange = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.target && m.target.hasAttribute && m.target.hasAttribute("data-cron-enhanced")) continue;
        let onlyOurNodes = true;
        for (let j = 0; j < m.addedNodes.length; j++) {
          const n = m.addedNodes[j];
          if (n.nodeType === 1 && !n.hasAttribute("data-dbf-subvar") && !n.hasAttribute("data-cron-subvar")) {
            onlyOurNodes = false;
            break;
          }
        }
        for (let j = 0; j < m.removedNodes.length; j++) {
          const n = m.removedNodes[j];
          if (n.nodeType === 1 && !n.hasAttribute("data-dbf-subvar") && !n.hasAttribute("data-cron-subvar")) {
            onlyOurNodes = false;
            break;
          }
        }
        if (!onlyOurNodes) {
          foreignChange = true;
          break;
        }
      }
      if (foreignChange) {
        scheduleEnhance();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  globalThis.__dbfSharedAutocompleteCleanup = () => {
    globalThis.__dbfSharedAutocompleteActive = false;
    if (enhanceFrameId !== null) {
      cancelAnimationFrame(enhanceFrameId);
      enhanceFrameId = null;
    }
    document.removeEventListener("focusin", onFocusOrInput, true);
    document.removeEventListener("input", onFocusOrInput, true);
    document.removeEventListener("keyup", onFocusOrInput, true);
    document.removeEventListener("click", onFocusOrInput, true);
    document.removeEventListener("keydown", onKeyDownCapture, true);
    document.removeEventListener("mousedown", onMouseDownCapture, true);
    if (observer) observer.disconnect();
    hideFallbackPopup();
  };
}

setupEditorAutocompleteEnhancer();

function buildSaveVarSnippet(raw, valueExpr = "''", forcedSchema = "cron_trigger") {
  const normalized = normalizeSaveVarProp(raw);
  if (!normalized.name) return "";
  const parts = normalized.parts && normalized.parts.length ? normalized.parts : CRON_VARIABLE_PARTS;
  const literal = JSON.stringify({
    name: normalized.name,
    scope: normalized.scope || "local",
    parts: parts,
    schema: forcedSchema || normalized.schema || "cron_trigger"
  });
  return `
    (() => {
      try {
        const _saveCfg = ${literal};
        const _saveName = (typeof resolveTemplateVars === 'function' ? resolveTemplateVars(String(_saveCfg.name || ''), message) : String(_saveCfg.name || '')).trim();
        const _saveScope = String(_saveCfg.scope || 'local').toLowerCase();
        const _saveSchema = String(_saveCfg.schema || '').trim().toLowerCase();
        if (_saveName && typeof setVariable === 'function') {
          const _val = ${valueExpr};
          setVariable(_saveName, _val, _saveScope, message, { schema: _saveSchema, parts: _saveCfg.parts });
          if (_val && typeof _val === 'object') {
            for (const [k, v] of Object.entries(_val)) {
              setVariable(\`\${_saveName}.\${k}\`, v, _saveScope, message);
            }
          }
        }
      } catch (err) {
        console.error('[CronScheduler] Error saving trigger variable:', err?.message || err);
      }
    })();`;
}

function buildSaveVarCondition(condition, label, saveVar, valueExpr, schema = "cron_trigger") {
  const saveSnippet = buildSaveVarSnippet(saveVar, valueExpr, schema);
  if (!saveSnippet) return { condition, label };
  return {
    condition: `${condition} && (() => { ${saveSnippet} return true; })()`,
    label
  };
}

const TIMEZONE_ABBR_MAP = {
  "UTC-12:00": "AoE / BIT (UTC-12)",
  "UTC-11:00": "SST / NUT (UTC-11)",
  "UTC-10:00": "HST / CKT (UTC-10)",
  "UTC-09:30": "MART (UTC-09:30)",
  "UTC-09:00": "AKST / HDT (UTC-9)",
  "UTC-08:00": "PST / AKDT (UTC-8)",
  "UTC-07:00": "MST / PDT (UTC-7)",
  "UTC-06:00": "CST / MDT (UTC-6)",
  "UTC-05:00": "EST / CDT (UTC-5)",
  "UTC-04:00": "EDT / AST (UTC-4)",
  "UTC-03:30": "NST (UTC-03:30)",
  "UTC-03:00": "ADT / BRT / ART (UTC-3)",
  "UTC-02:00": "FNT / GST (UTC-2)",
  "UTC-01:00": "CVT / AZOT (UTC-1)",
  "UTC+00:00": "UTC / GMT / WET",
  "UTC+01:00": "CET / BST / WAT (UTC+1)",
  "UTC+02:00": "EET / CEST / CAT / SAST (UTC+2)",
  "UTC+03:00": "MSK / EEST / EAT (UTC+3)",
  "UTC+03:30": "IRST (UTC+03:30)",
  "UTC+04:00": "GST / AZT / GET (UTC+4)",
  "UTC+04:30": "AFT (UTC+04:30)",
  "UTC+05:00": "PKT / UZT (UTC+5)",
  "UTC+05:30": "IST / SLST (UTC+05:30)",
  "UTC+05:45": "NPT (UTC+05:45)",
  "UTC+06:00": "BST / BTT / OMST (UTC+6)",
  "UTC+06:30": "MMT / CCT (UTC+06:30)",
  "UTC+07:00": "ICT / WIB (UTC+7)",
  "UTC+08:00": "CST / SGT / AWST / HKT (UTC+8)",
  "UTC+08:45": "ACWST (UTC+08:45)",
  "UTC+09:00": "JST / KST (UTC+9)",
  "UTC+09:30": "ACST (UTC+09:30)",
  "UTC+10:00": "AEST / ChST (UTC+10)",
  "UTC+10:30": "ACDT / LHST (UTC+10:30)",
  "UTC+11:00": "AEDT / SBT (UTC+11)",
  "UTC+12:00": "NZST / FJT (UTC+12)",
  "UTC+12:45": "CHAST (UTC+12:45)",
  "UTC+13:00": "NZDT / TOT (UTC+13)",
  "UTC+14:00": "LINT (UTC+14)"
};

const TIMEZONE_OPTIONS = [
  { label: "UTC-12:00 (AoE / BIT)", value: "UTC-12:00" },
  { label: "UTC-11:00 (SST / NUT)", value: "UTC-11:00" },
  { label: "UTC-10:00 (HST / CKT)", value: "UTC-10:00" },
  { label: "UTC-09:30 (MART)", value: "UTC-09:30" },
  { label: "UTC-09:00 (AKST / HDT)", value: "UTC-09:00" },
  { label: "UTC-08:00 (PST / AKDT)", value: "UTC-08:00" },
  { label: "UTC-07:00 (MST / PDT)", value: "UTC-07:00" },
  { label: "UTC-06:00 (CST / MDT)", value: "UTC-06:00" },
  { label: "UTC-05:00 (EST / CDT)", value: "UTC-05:00" },
  { label: "UTC-04:00 (EDT / AST)", value: "UTC-04:00" },
  { label: "UTC-03:30 (NST)", value: "UTC-03:30" },
  { label: "UTC-03:00 (ADT / BRT / ART)", value: "UTC-03:00" },
  { label: "UTC-02:00 (FNT / GST)", value: "UTC-02:00" },
  { label: "UTC-01:00 (CVT / AZOT)", value: "UTC-01:00" },
  { label: "UTC+00:00 (UTC / GMT / WET)", value: "UTC+00:00" },
  { label: "UTC+01:00 (CET / BST / WAT)", value: "UTC+01:00" },
  { label: "UTC+02:00 (EET / CEST / CAT / SAST)", value: "UTC+02:00" },
  { label: "UTC+03:00 (MSK / EEST / EAT)", value: "UTC+03:00" },
  { label: "UTC+03:30 (IRST)", value: "UTC+03:30" },
  { label: "UTC+04:00 (GST / AZT / GET)", value: "UTC+04:00" },
  { label: "UTC+04:30 (AFT)", value: "UTC+04:30" },
  { label: "UTC+05:00 (PKT / UZT)", value: "UTC+05:00" },
  { label: "UTC+05:30 (IST / SLST)", value: "UTC+05:30" },
  { label: "UTC+05:45 (NPT)", value: "UTC+05:45" },
  { label: "UTC+06:00 (BST / BTT / OMST)", value: "UTC+06:00" },
  { label: "UTC+06:30 (MMT / CCT)", value: "UTC+06:30" },
  { label: "UTC+07:00 (ICT / WIB)", value: "UTC+07:00" },
  { label: "UTC+08:00 (CST / SGT / AWST / HKT)", value: "UTC+08:00" },
  { label: "UTC+08:45 (ACWST)", value: "UTC+08:45" },
  { label: "UTC+09:00 (JST / KST)", value: "UTC+09:00" },
  { label: "UTC+09:30 (ACST)", value: "UTC+09:30" },
  { label: "UTC+10:00 (AEST / ChST)", value: "UTC+10:00" },
  { label: "UTC+10:30 (ACDT / LHST)", value: "UTC+10:30" },
  { label: "UTC+11:00 (AEDT / SBT)", value: "UTC+11:00" },
  { label: "UTC+12:00 (NZST / FJT)", value: "UTC+12:00" },
  { label: "UTC+12:45 (CHAST)", value: "UTC+12:45" },
  { label: "UTC+13:00 (NZDT / TOT)", value: "UTC+13:00" },
  { label: "UTC+14:00 (LINT)", value: "UTC+14:00" }
];

const DOW_UNIX_NAMES = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
  SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday"
};

const DOW_QUARTZ_NAMES = {
  1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday",
  SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday"
};

const MONTH_NAMES = {
  1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
  7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December",
  JAN: "January", FEB: "February", MAR: "March", APR: "April", MAY: "May", JUN: "June",
  JUL: "July", AUG: "August", SEP: "September", OCT: "October", NOV: "November", DEC: "December"
};

function getOrdinal(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return n;
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getTimezoneAbbr(tz) {
  return TIMEZONE_ABBR_MAP[tz] || tz || "UTC";
}

function formatNaturalCron(expr, isQuartz) {
  const tokens = expr.trim().split(/\s+/);
  let sec, min, hr, dom, mon, dow, yr;

  if (tokens.length === 5) {
    sec = "0";
    [min, hr, dom, mon, dow] = tokens;
    yr = "*";
  } else if (tokens.length === 6) {
    [sec, min, hr, dom, mon, dow] = tokens;
    yr = "*";
  } else {
    [sec, min, hr, dom, mon, dow, yr] = tokens;
  }

  let timeDesc = "";
  const secIsStar = sec === "*";
  const minIsStar = min === "*";
  const hrIsStar = hr === "*";
  const secIsStep = sec.startsWith("*/");
  const minIsStep = min.startsWith("*/");
  const hrIsStep = hr.startsWith("*/");

  if (isQuartz && secIsStar && minIsStar && hrIsStar) {
    timeDesc = "Every second";
  } else if (isQuartz && secIsStep && minIsStar && hrIsStar) {
    timeDesc = `Every ${sec.slice(2)} seconds`;
  } else if (minIsStar && hrIsStar) {
    if (isQuartz && sec !== "0") {
      timeDesc = `Every minute at :${sec.padStart(2, "0")}s`;
    } else {
      timeDesc = "Every minute";
    }
  } else if (minIsStep && hrIsStar) {
    timeDesc = `Every ${min.slice(2)} minutes`;
  } else if (!minIsStar && hrIsStar) {
    if (min === "0") {
      timeDesc = "Every hour on the hour";
    } else {
      timeDesc = `Every hour at minute ${min}`;
    }
  } else if (hrIsStep) {
    timeDesc = `Every ${hr.slice(2)} hours at :${min.padStart(2, "0")}`;
  } else if (!minIsStar && !hrIsStar) {
    const padHr = hr.padStart(2, "0");
    const padMin = min.padStart(2, "0");
    if (isQuartz && sec !== "0") {
      timeDesc = `at ${padHr}:${padMin}:${sec.padStart(2, "0")}`;
    } else {
      timeDesc = `at ${padHr}:${padMin}`;
    }
  } else {
    timeDesc = `at ${hr}:${min}`;
  }

  function formatDOWList(dowToken) {
    const map = isQuartz ? DOW_QUARTZ_NAMES : DOW_UNIX_NAMES;
    const upper = dowToken.toUpperCase();
    if (upper === "*" || upper === "?") return null;
    if (upper === "1-5" || upper === "MON-FRI") return "on weekdays (Mon-Fri)";
    if (upper === "0,6" || upper === "6,7" || upper === "SAT,SUN" || upper === "SUN,SAT") return "on weekends (Sat-Sun)";

    if (upper.endsWith("L")) {
      const d = upper.slice(0, -1);
      const day = map[d] || d;
      return `on the last ${day} of the month`;
    }
    if (upper.includes("#")) {
      const [d, n] = upper.split("#");
      const day = map[d] || d;
      return `on the ${getOrdinal(n)} ${day} of the month`;
    }

    const parts = upper.split(",");
    const names = parts.map(p => {
      if (p.includes("-")) {
        const [r1, r2] = p.split("-");
        return `${map[r1] || r1}-${map[r2] || r2}`;
      }
      return map[p] || p;
    });

    if (names.length === 1) {
      return `on ${names[0]}s`;
    }
    return `on ${names.join(", ")}`;
  }

  function formatDOM(domToken) {
    const upper = domToken.toUpperCase();
    if (upper === "*" || upper === "?") return null;
    if (upper === "L") return "on the last day of the month";
    if (upper === "LW") return "on the last weekday of the month";
    if (upper.startsWith("L-")) return `${upper.slice(2)} days before the end of the month`;
    if (upper.endsWith("W")) return `on the nearest weekday to the ${getOrdinal(upper.slice(0, -1))}`;
    if (upper.startsWith("*/")) return `every ${upper.slice(2)} days`;

    const parts = upper.split(",");
    const ords = parts.map(getOrdinal);
    return `on the ${ords.join(", ")} of the month`;
  }

  function formatMonth(monToken) {
    const upper = monToken.toUpperCase();
    if (upper === "*" || upper === "?") return null;
    const parts = upper.split(",");
    const names = parts.map(p => MONTH_NAMES[p] || p);
    return `in ${names.join(", ")}`;
  }

  const dowDesc = formatDOWList(dow);
  const domDesc = formatDOM(dom);
  const monDesc = formatMonth(mon);
  const isRecurringTime = timeDesc.startsWith("Every");

  let parts = [];

  const isSpecificDom = dom !== "*" && dom !== "?" && !dom.includes("/") && !dom.includes("-") && !dom.includes("L") && !dom.includes("W");
  const isSpecificMon = mon !== "*" && mon !== "?" && !mon.includes("/") && !mon.includes("-");

  if (isSpecificDom && isSpecificMon) {
    const monthName = MONTH_NAMES[mon.toUpperCase()] || mon;
    parts.push(`On ${monthName} ${getOrdinal(dom)} ${timeDesc}`);
  } else if (dowDesc && domDesc) {
    if (isRecurringTime) {
      parts.push(timeDesc, dowDesc, domDesc);
    } else {
      parts.push(dowDesc, domDesc, timeDesc);
    }
    if (monDesc) parts.push(monDesc);
  } else if (dowDesc) {
    if (isRecurringTime) {
      parts.push(timeDesc, dowDesc);
    } else {
      if (dowDesc.startsWith("on ") && dowDesc.endsWith("s") && !dowDesc.includes(",")) {
        const singleDay = dowDesc.slice(3, -1);
        parts.push(`Every ${singleDay} ${timeDesc}`);
      } else {
        parts.push(`${dowDesc} ${timeDesc}`);
      }
    }
    if (monDesc) parts.push(monDesc);
  } else if (domDesc) {
    if (isRecurringTime) {
      parts.push(timeDesc, domDesc);
    } else {
      parts.push(`${domDesc} ${timeDesc}`);
    }
    if (monDesc) parts.push(monDesc);
  } else {
    if (isRecurringTime) {
      parts.push(timeDesc);
    } else {
      parts.push(`Daily ${timeDesc}`);
    }
    if (monDesc) parts.push(monDesc);
  }

  if (yr && yr !== "*") {
    parts.push(`in ${yr}`);
  }

  let result = parts.join(" ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function describeCronExpression(expr, tz = "UTC+00:00") {
  if (!expr || typeof expr !== "string" || !expr.trim()) {
    return {
      isValid: false,
      error: "Expression is empty",
      frequency: "Not set",
      format: "Unknown",
      timezoneAbbr: getTimezoneAbbr(tz)
    };
  }
  const tokens = expr.trim().split(/\s+/);
  if (tokens.length < 5 || tokens.length > 7) {
    return {
      isValid: false,
      error: `Expected 5, 6, or 7 fields (found ${tokens.length})`,
      frequency: "Invalid Expression",
      format: "Unknown",
      timezoneAbbr: getTimezoneAbbr(tz)
    };
  }

  let isQuartz = false;
  let format = "";

  if (tokens.length === 5) {
    isQuartz = false;
    format = "UNIX (5-part)";
  } else if (tokens.length === 6) {
    isQuartz = true;
    format = "Quartz (6-part)";
  } else {
    isQuartz = true;
    format = "Quartz (7-part)";
  }

  const validTokenPattern = /^[0-9a-zA-Z\*\?\,\-\/\#]+$/;
  for (const t of tokens) {
    if (!validTokenPattern.test(t)) {
      return {
        isValid: false,
        error: `Invalid character in field '${t}'`,
        frequency: "Invalid Expression",
        format,
        timezoneAbbr: getTimezoneAbbr(tz)
      };
    }
  }

  const tzAbbr = getTimezoneAbbr(tz);
  const freq = formatNaturalCron(expr, isQuartz);

  return {
    isValid: true,
    format,
    frequency: freq,
    timezoneAbbr: tzAbbr,
    summary: `${freq} [${tzAbbr}]`
  };
}

function toBool(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  if (typeof val === "number") return val !== 0;
  return false;
}

module.exports = function (DBFMod) {
  const nodeConfig = {
    type: "CronTrigger",
    aliases: [
      "Events/CronTrigger",
      "Scheduling/CronTrigger",
      "When Cron Schedule Triggers",
      "Cron Trigger",
      "Quartz Trigger"
    ],
    title: "When Cron Schedule Triggers",
    color: "#10b981",
    bgcolor: "#064e3b",
    size: [290, 130],
    description: "Starts a flow based on recurring 5-part UNIX or 6/7-part Quartz CRON schedules with exact timezone precision.",
    inputs: [],
    outputs: [
      {
        name: "Output",
        type: "event"
      }
    ],
    properties: {
      cronExpression: "0 0 * * *",
      timezone: "UTC+00:00",
      runOnStartup: false,
      logToConsole: false,
      saveVar: ""
    },
    onNodeCreated() {
      if (this.outputs && this.outputs.length > 0) {
        this.outputs[0].name = "Output";
      }
      registerCronNodeVars(this);
    },
    onConfigure() {
      if (this.outputs && this.outputs.length > 0) {
        this.outputs[0].name = "Output";
      }
      registerCronNodeVars(this);
    },
    autoTitle(node) {
      registerCronNodeVars(node);
      return "When Cron Schedule Triggers";
    },
    onPropertyChanged(name, value) {
      if (name === "saveVar") {
        registerCronVarName(value);
      }
      registerCronNodeVars(this);
      if (this.graph && typeof this.graph.setDirtyCanvas === "function") {
        this.graph.setDirtyCanvas(true, true);
      }
    },
    drawForeground(ctx) {
      const expr = String(this.properties?.cronExpression || "0 0 * * *").trim();
      const tz = String(this.properties?.timezone || "UTC+00:00").trim();
      const startup = toBool(this.properties?.runOnStartup);
      const logConsole = toBool(this.properties?.logToConsole);
      const desc = describeCronExpression(expr, tz);

      // Header Badge
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 11px Inter, Lexend, system-ui, sans-serif";
      ctx.fillText("CRON / QUARTZ TRIGGER", 12, 22);

      // Line 1: Expression
      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px Inter, Lexend, system-ui, sans-serif";
      const displayExpr = expr.length > 25 ? expr.slice(0, 22) + "..." : expr;
      ctx.fillText(`Expr: ${displayExpr}`, 12, 44);

      // Line 2: Validity Status
      ctx.font = "bold 11px Inter, Lexend, system-ui, sans-serif";
      if (desc.isValid) {
        ctx.fillStyle = "#10b981";
        ctx.fillText(`✓ Valid ${desc.format}`, 12, 64);
      } else {
        ctx.fillStyle = "#f87171";
        ctx.fillText(`✗ Invalid Expression`, 12, 64);
      }

      // Line 3: Frequency
      ctx.fillStyle = "#38bdf8";
      ctx.font = "11px Inter, Lexend, system-ui, sans-serif";
      const displayFreq = desc.frequency.length > 32 ? desc.frequency.slice(0, 29) + "..." : desc.frequency;
      ctx.fillText(`Freq: ${displayFreq}`, 12, 84);

      // Line 4: Timezone Abbr + Badges
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Inter, Lexend, system-ui, sans-serif";
      let badges = "";
      if (startup) badges += " [+Startup]";
      if (logConsole) badges += " [+Log]";
      const tzDisplay = `TZ: ${desc.timezoneAbbr}${badges}`;
      const displayTz = tzDisplay.length > 34 ? tzDisplay.slice(0, 31) + "..." : tzDisplay;
      ctx.fillText(displayTz, 12, 104);
    },
    modalFields(node) {
      registerCronNodeVars(node);
      const expr = String(node.properties.cronExpression || "0 0 * * *").trim();
      const tz = String(node.properties.timezone || "UTC+00:00").trim();
      const desc = describeCronExpression(expr, tz);

      // Validator goes under the field in help
      const statusHelp = desc.isValid
        ? `✓ Valid ${desc.format} • ${desc.frequency} [${desc.timezoneAbbr}]`
        : `✗ Invalid CRON/Quartz expression: ${desc.error} (Supports 5-part UNIX or 6/7-part Quartz).`;

      // Live DOM observer to update the validator under the field immediately as the user types
      if (typeof document !== "undefined") {
        setTimeout(() => {
          try {
            const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
            const input = inputs.find(el =>
              el.name === "cronExpression" ||
              el.getAttribute("data-property") === "cronExpression" ||
              (el.placeholder && el.placeholder.includes("0 0 12 ? * WED")) ||
              el.value === node.properties.cronExpression
            );
            if (!input || input.__cronLiveHooked) return;
            input.__cronLiveHooked = true;

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

            // Search for existing help element in parent or field container
            const candidateParents = [parent, parent?.parentElement, input.closest && input.closest(".form-group, .field, .form-field, .modal-field, div")].filter(Boolean);
            let helpEl = null;
            for (const p of candidateParents) {
              helpEl = Array.from(p.children).find(el =>
                el !== input && (
                  el.classList.contains("cron-live-help") ||
                  el.classList.contains("help") ||
                  el.classList.contains("field-help") ||
                  el.tagName === "SMALL" ||
                  el.tagName === "P" ||
                  (el.textContent && (el.textContent.includes("Valid") || el.textContent.includes("Invalid") || el.textContent.includes("Supports")))
                )
              );
              if (helpEl) break;
            }

            const updateLiveHelp = () => {
              const currentVal = input.value;
              const selects = Array.from(document.querySelectorAll("select"));
              const tzSelect = selects.find(s =>
                s.name === "timezone" ||
                s.getAttribute("data-property") === "timezone" ||
                Array.from(s.options).some(o => o.value === "UTC+00:00")
              );
              const currentTz = tzSelect ? tzSelect.value : (node.properties.timezone || "UTC+00:00");
              const liveDesc = describeCronExpression(currentVal, currentTz);

              if (parent) {
                parent.style.display = "flex";
                parent.style.flexDirection = "column";
                parent.style.alignItems = "stretch";
                parent.style.width = "100%";
              }
              input.style.width = "100%";
              input.style.minWidth = "0";
              input.style.boxSizing = "border-box";

              if (!helpEl && parent) {
                helpEl = document.createElement("div");
                helpEl.className = "field-help cron-live-help";
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

                if (liveDesc.isValid) {
                  helpEl.textContent = `✓ Valid ${liveDesc.format} • ${liveDesc.frequency} [${liveDesc.timezoneAbbr}]`;
                  helpEl.style.color = "#10b981";
                } else {
                  helpEl.textContent = `✗ Invalid: ${liveDesc.error} (Supports 5-part UNIX or 6/7-part Quartz).`;
                  helpEl.style.color = "#f87171";
                }
              }
            };

            input.addEventListener("input", updateLiveHelp);
            input.addEventListener("change", updateLiveHelp);
            input.addEventListener("keyup", updateLiveHelp);

            const selects = Array.from(document.querySelectorAll("select"));
            const tzSelect = selects.find(s =>
              s.name === "timezone" ||
              s.getAttribute("data-property") === "timezone" ||
              Array.from(s.options).some(o => o.value === "UTC+00:00")
            );
            if (tzSelect && !tzSelect.__cronTzHooked) {
              tzSelect.__cronTzHooked = true;
              tzSelect.addEventListener("change", updateLiveHelp);
            }

            // Also watch any variableSave input inside the CronTrigger modal so custom variable names register live
            inputs.forEach(el => {
              if (el === input || el.__cronVarSaveHooked) return;
              el.__cronVarSaveHooked = true;
              const onVarInput = () => {
                const v = String(el.value || "").trim();
                if (v && /^[a-zA-Z0-9_-]+$/.test(v)) {
                  registerCronVarName(v);
                }
              };
              el.addEventListener("input", onVarInput);
              el.addEventListener("change", onVarInput);
              onVarInput();
            });
          } catch (_) {}
        }, 50);
      }

      return [
        {
          label: "CRON / Quartz Expression *",
          property: "cronExpression",
          value: node.properties.cronExpression || "0 0 * * *",
          type: "text",
          placeholder: "e.g. 0 0 * * * or 0 0 12 ? * WED",
          help: statusHelp
        },
        {
          label: "Timezone *",
          property: "timezone",
          value: node.properties.timezone || "UTC+00:00",
          type: "select",
          options: TIMEZONE_OPTIONS,
          help: `Evaluation offset for schedule times (Selected: ${desc.timezoneAbbr}).`
        },
        {
          label: "Run Once on Bot Startup",
          property: "runOnStartup",
          value: toBool(node.properties.runOnStartup),
          type: "boolean",
          help: "When enabled, triggers this flow immediately once the bot logs into Discord (Disabled by default)."
        },
        {
          label: "Log Schedule Execution to Console",
          property: "logToConsole",
          value: toBool(node.properties.logToConsole),
          type: "boolean",
          help: "When enabled, prints a confirmation message to the bot console whenever this schedule triggers (Disabled by default)."
        },
        {
          label: "Save Trigger Info to Variable (optional)",
          property: "saveVar",
          value: node.properties.saveVar,
          type: "variableSave",
          saveLabel: "the schedule trigger info",
          autoLabel: "cron_trigger_info",
          saveSchema: "cron_trigger",
          parts: CRON_VARIABLE_PARTS,
          schemaParts: CRON_VARIABLE_PARTS,
          help: "Stores schedule details into a variable. Access sub-variables with {cron_trigger_info.runCount}, {cron_trigger_info.timestamp}, {cron_trigger_info.frequency}, etc."
        }
      ];
    },
    codegen: {
      role: "event",
      buildCondition(nodeData, ctx) {
        registerCronNodeVars(nodeData);
        const id = String(nodeData?.id ?? "").trim();
        const idEsc = escapeJsStr(id, ctx);
        const expr = String(nodeData?.properties?.cronExpression || "0 0 * * *").trim();
        const exprEsc = escapeJsStr(expr, ctx);
        const tz = String(nodeData?.properties?.timezone || "UTC+00:00").trim();
        const tzEsc = escapeJsStr(tz, ctx);
        const desc = describeCronExpression(expr, tz);
        const condition = `(message.__eventType === 'cronTrigger' && (String(message.__eventPayload?.nodeId || '').trim() === '${idEsc}' || String(message.__eventPayload?.runtimeId || '').trim() === '${idEsc}' || String(message.__eventPayload?.originalId || '').trim() === '${idEsc}' || message.__eventPayload?.nodeId == '${idEsc}' || (message.__eventPayload?.cronExpression === '${exprEsc}' && message.__eventPayload?.timezone === '${tzEsc}' && (!message.__eventPayload?.runtimeId || String(message.__eventPayload?.runtimeId) === '${idEsc}'))))`;
        const label = `When Cron Schedule Triggers (${expr} - ${desc.timezoneAbbr})`;
        return buildSaveVarCondition(
          condition,
          label,
          nodeData?.properties?.saveVar,
          `(message.__eventPayload || {})`,
          "cron_trigger"
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
