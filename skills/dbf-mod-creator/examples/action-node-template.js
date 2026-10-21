// ============================================================================
// DBF Action Node Template (Single-Slot & Multi-Branch Examples)
// ============================================================================
// Copy this template when creating custom action or logic nodes that execute
// inside a flow, save structured sub-variables, and optionally branch to
// "Success" / "Failed" output pins.
// ============================================================================

const ACTION_VARIABLE_PARTS = [
  {
    name: "input",
    label: "Input Value",
    type: "string",
    description: "The resolved input value passed into the action."
  },
  {
    name: "processedAt",
    label: "Processed Timestamp",
    type: "string",
    description: "ISO-8601 timestamp of when the action executed."
  }
];

const ACTION_VAR_DESCRIPTION =
  "Saved custom action output (supports .input, .processedAt).";

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
  if (!raw && raw !== 0) {
    return { name: "", scope: "local", parts: ACTION_VARIABLE_PARTS, schema: "custom_action" };
  }
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
    return { name: trimmed, scope: "local", parts: ACTION_VARIABLE_PARTS, schema: "custom_action" };
  }
  if (typeof raw === "object") {
    const scope = String(raw.scope || "").toLowerCase() === "global" ? "global" : "local";
    const parts = Array.isArray(raw.parts) && raw.parts.length ? raw.parts : ACTION_VARIABLE_PARTS;
    return {
      name: String(raw.name || "").trim(),
      scope,
      parts,
      schema: String(raw.schema || "custom_action").trim().toLowerCase()
    };
  }
  return { name: "", scope: "local", parts: ACTION_VARIABLE_PARTS, schema: "custom_action" };
}

function isValidVarName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (/^[0-9]+$/.test(trimmed)) return false;
  if (/^[Xx]+-[Xx]+/.test(trimmed)) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(trimmed);
}

// ============================================================================
// Shared Custom Mod Variable Registry & Editor Sub-Variable Autocomplete Enhancer
// ============================================================================

function getSharedCustomModVarsMap() {
  if (!globalThis.__dbfCustomModVars || !(globalThis.__dbfCustomModVars instanceof Map)) {
    globalThis.__dbfCustomModVars = new Map();
  }
  return globalThis.__dbfCustomModVars;
}

function registerCustomActionVarName(rawSaveVar) {
  const norm = normalizeSaveVarProp(rawSaveVar);
  if (!norm.name || !isValidVarName(norm.name)) return;
  const sharedMap = getSharedCustomModVarsMap();
  sharedMap.set(norm.name.toLowerCase(), {
    name: norm.name,
    scope: norm.scope || "local",
    schema: "custom_action",
    description: ACTION_VAR_DESCRIPTION,
    parts: ACTION_VARIABLE_PARTS
  });
}

function registerCustomActionNodeVars(node) {
  if (!node) return;
  if (node.properties && node.properties.saveVar) {
    registerCustomActionVarName(node.properties.saveVar);
  }
  const graphNodes = node.graph && Array.isArray(node.graph._nodes) ? node.graph._nodes : null;
  if (graphNodes) {
    graphNodes.forEach((n) => {
      if (n && n.type === "CustomBranchingAction" && n.properties && n.properties.saveVar) {
        registerCustomActionVarName(n.properties.saveVar);
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
  const bracePrefixRegex = /\{[a-zA-Z0-9_.-]*$/;
  let newBefore;
  if (prefixRegex.test(before)) {
    newBefore = before.replace(prefixRegex, fullToken);
  } else if (bracePrefixRegex.test(before)) {
    newBefore = before.replace(bracePrefixRegex, fullToken);
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

  function syncAllKnownModVars() {
    const sharedMap = getSharedCustomModVarsMap();
    try {
      if (typeof LGraphCanvas !== "undefined" && LGraphCanvas.active_canvas?.graph?._nodes) {
        LGraphCanvas.active_canvas.graph._nodes.forEach((n) => {
          if (!n || !n.properties?.saveVar) return;
          if (n.type === "CustomBranchingAction") {
            registerCustomActionVarName(n.properties.saveVar);
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
    const partsList = Array.isArray(varMeta.parts) ? varMeta.parts : ACTION_VARIABLE_PARTS;
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
      const knownMap = syncAllKnownModVars();
      const currentInput =
        (document.activeElement &&
          (document.activeElement.tagName === "TEXTAREA" ||
            document.activeElement.tagName === "INPUT") &&
          document.activeElement) ||
        activeInputEl;
      const cursorQuery = getCursorVarQuery(currentInput);

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

      hideFallbackPopup();

      const firstBaseItem = matchedBases[0].baseItem;
      const firstVarName = matchedBases[0].varMeta.name;
      const listContainer = firstBaseItem.parentElement;
      if (!listContainer) return;

      let popupContainer = listContainer.parentElement;
      let insertBtnEl = null;
      while (popupContainer && popupContainer !== document.body) {
        const btns = Array.from(popupContainer.querySelectorAll("button"));
        insertBtnEl = btns.find((b) => (b.textContent || "").trim() === "Insert") || null;
        if (insertBtnEl) break;
        popupContainer = popupContainer.parentElement;
      }
      if (!popupContainer) {
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
        const partsList = Array.isArray(varMeta.parts) ? varMeta.parts : ACTION_VARIABLE_PARTS;
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
            description: varMeta.description || ACTION_VAR_DESCRIPTION
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
        const row = e.target && e.target.closest ? e.target.closest("button, [role='option'], li") : null;
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

function buildSaveVarSnippet(raw, valueExpr = "''", forcedSchema = "custom_action") {
  const normalized = normalizeSaveVarProp(raw);
  if (!normalized.name) return "";
  const parts = normalized.parts && normalized.parts.length ? normalized.parts : ACTION_VARIABLE_PARTS;
  const literal = JSON.stringify({
    name: normalized.name,
    scope: normalized.scope || "local",
    parts: parts,
    schema: forcedSchema || normalized.schema || "custom_action"
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

module.exports = function (DBFMod) {
  setupEditorAutocompleteEnhancer();

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
    inputs: [{ name: "Trigger", type: "event" }],
    outputs: [
      { name: "Success", type: "event" },
      { name: "Failed", type: "event" }
    ],
    properties: {
      inputValue: "",
      saveVar: ""
    },
    onNodeCreated() {
      registerCustomActionNodeVars(this);
    },
    onConfigure() {
      registerCustomActionNodeVars(this);
    },
    autoTitle(node) {
      registerCustomActionNodeVars(node);
      return "Custom Branching Action";
    },
    onPropertyChanged(name, value) {
      if (name === "saveVar") {
        registerCustomActionVarName(value);
      }
      registerCustomActionNodeVars(this);
      if (this.graph && typeof this.graph.setDirtyCanvas === "function") {
        this.graph.setDirtyCanvas(true, true);
      }
    },
    drawForeground(ctx) {
      registerCustomActionNodeVars(this);
      const val = String(this.properties?.inputValue || "").trim();
      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px Inter, Lexend, system-ui, sans-serif";
      const display = val ? (val.length > 28 ? val.slice(0, 25) + "..." : val) : "Configure input";
      ctx.fillText(display, 12, this.size[1] - 20);
    },
    modalFields(node) {
      registerCustomActionNodeVars(node);

      if (typeof document !== "undefined") {
        setTimeout(() => {
          try {
            const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));
            const inputField = textInputs.find(
              (el) =>
                el.name === "inputValue" ||
                el.getAttribute("data-property") === "inputValue" ||
                (el.placeholder && el.placeholder.includes("Enter text or {variable}"))
            );

            // Watch variableSave text input inside the modal so custom variable names register live
            textInputs.forEach((el) => {
              if (el === inputField || el.__customVarSaveHooked) return;
              el.__customVarSaveHooked = true;
              const onVarInput = () => {
                const v = String(el.value || "").trim();
                if (isValidVarName(v)) {
                  registerCustomActionVarName(v);
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
          autoLabel: "action_result",
          saveSchema: "custom_action",
          parts: ACTION_VARIABLE_PARTS,
          schemaParts: ACTION_VARIABLE_PARTS
        }
      ];
    },
    codegen: {
      role: "action",
      buildAction(nodeData, ctx, helpers = {}) {
        registerCustomActionNodeVars(nodeData);
        const suffix = getSuffix(nodeData, ctx);
        const inputEsc = escapeJsStr(nodeData?.properties?.inputValue || "", ctx);
        const saveSnippet = buildSaveVarSnippet(
          nodeData?.properties?.saveVar,
          `_result${suffix}`,
          "custom_action"
        );

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
