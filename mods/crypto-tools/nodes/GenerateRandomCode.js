// ============================================================================
// Generate Random Code & Cryptographic Token Action Node
// ============================================================================
// Clean-room implementation for Discord Bot Factory (DBF).
// Uses pure native Node.js crypto (crypto.randomInt, crypto.randomBytes,
// crypto.randomUUID, crypto.createHash) without any external npm packages.
//
// Supported Formats:
// 1. Formatted Alphanumeric (XXXX-XXXX or custom pattern)
// 2. Numeric PIN (4-8 digits or custom length, uniform cryptographically secure)
// 3. UUID v4 (RFC 4122 compliant)
// 4. SHA-256 hash (of input source text or cryptographically random entropy)
// 5. MD5 hash (of input source text or cryptographically random entropy)
// 6. Random Hex bytes (custom byte count)
//
// Supports full sub-variable access and editor auto-suggestions:
// {generated_code.code}, {generated_code.value}, {generated_code.format},
// {generated_code.length}, {generated_code.timestamp}
// ============================================================================

const CRYPTO_VARIABLE_PARTS = [
  {
    name: "code",
    label: "Generated Code / Hash",
    type: "string",
    description: "The full generated random code, PIN, UUID, hash, or hex string."
  },
  {
    name: "value",
    label: "Raw Value",
    type: "string",
    description: "Alias for the generated code string."
  },
  {
    name: "format",
    label: "Format Used",
    type: "string",
    description: "The format used (alphanumeric, pin, uuid, sha256, md5, hex)."
  },
  {
    name: "length",
    label: "Code Length",
    type: "number",
    description: "Character length of the generated string."
  },
  {
    name: "timestamp",
    label: "Timestamp",
    type: "string",
    description: "ISO-8601 timestamp of when the code was generated."
  }
];

const CRYPTO_VAR_DESCRIPTION =
  "Saved random code / hash token (supports .code, .value, .format, .length, .timestamp).";

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
    return { name: "", scope: "local", parts: CRYPTO_VARIABLE_PARTS, schema: "crypto_token" };
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
    return { name: trimmed, scope: "local", parts: CRYPTO_VARIABLE_PARTS, schema: "crypto_token" };
  }
  if (typeof raw === "object") {
    const scope = String(raw.scope || "").toLowerCase() === "global" ? "global" : "local";
    const parts = Array.isArray(raw.parts) && raw.parts.length ? raw.parts : CRYPTO_VARIABLE_PARTS;
    return {
      name: String(raw.name || "").trim(),
      scope,
      parts,
      schema: String(raw.schema || "crypto_token").trim().toLowerCase()
    };
  }
  return { name: "", scope: "local", parts: CRYPTO_VARIABLE_PARTS, schema: "crypto_token" };
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
// Known Crypto Variable Registry & Editor Sub-Variable Autocomplete Enhancer
// ============================================================================

function getSharedCustomModVarsMap() {
  if (!globalThis.__dbfCustomModVars || !(globalThis.__dbfCustomModVars instanceof Map)) {
    globalThis.__dbfCustomModVars = new Map();
  }
  return globalThis.__dbfCustomModVars;
}

function getKnownCryptoVarsMap() {
  const sharedMap = getSharedCustomModVarsMap();
  if (!globalThis.__dbfCryptoTokenVars || !(globalThis.__dbfCryptoTokenVars instanceof Map)) {
    globalThis.__dbfCryptoTokenVars = new Map();
    const defaultEntry = {
      name: "generated_code",
      scope: "local",
      schema: "crypto_token",
      description: CRYPTO_VAR_DESCRIPTION,
      parts: CRYPTO_VARIABLE_PARTS
    };
    globalThis.__dbfCryptoTokenVars.set("generated_code", defaultEntry);
    sharedMap.set("generated_code", defaultEntry);

    if (typeof localStorage !== "undefined") {
      try {
        const saved = JSON.parse(localStorage.getItem("__dbf_crypto_token_vars") || "[]");
        const validSaved = [];
        if (Array.isArray(saved)) {
          saved.forEach((entry) => {
            if (entry && isValidVarName(entry.name)) {
              const item = {
                name: String(entry.name).trim(),
                scope: entry.scope === "global" ? "global" : "local",
                schema: "crypto_token",
                description: CRYPTO_VAR_DESCRIPTION,
                parts: CRYPTO_VARIABLE_PARTS
              };
              const key = item.name.toLowerCase();
              globalThis.__dbfCryptoTokenVars.set(key, item);
              sharedMap.set(key, item);
              validSaved.push({ name: item.name, scope: item.scope });
            }
          });
        }
        localStorage.setItem("__dbf_crypto_token_vars", JSON.stringify(validSaved));
      } catch (_) {}
    }
  }
  return globalThis.__dbfCryptoTokenVars;
}

function registerCryptoVarName(rawSaveVar) {
  const norm = normalizeSaveVarProp(rawSaveVar);
  if (!norm.name || !isValidVarName(norm.name)) return;
  const cryptoMap = getKnownCryptoVarsMap();
  const sharedMap = getSharedCustomModVarsMap();
  const key = norm.name.toLowerCase();
  const entry = {
    name: norm.name,
    scope: norm.scope || "local",
    schema: "crypto_token",
    description: CRYPTO_VAR_DESCRIPTION,
    parts: CRYPTO_VARIABLE_PARTS
  };
  cryptoMap.set(key, entry);
  sharedMap.set(key, entry);
  if (typeof localStorage !== "undefined") {
    try {
      const serializable = Array.from(cryptoMap.values()).map((v) => ({
        name: v.name,
        scope: v.scope
      }));
      localStorage.setItem("__dbf_crypto_token_vars", JSON.stringify(serializable));
    } catch (_) {}
  }
}

function registerCryptoNodeVars(node) {
  if (!node) return;
  if (node.properties && node.properties.saveVar) {
    registerCryptoVarName(node.properties.saveVar);
  }
  const graphNodes = node.graph && Array.isArray(node.graph._nodes) ? node.graph._nodes : null;
  if (graphNodes) {
    graphNodes.forEach((n) => {
      if (n && n.type === "GenerateRandomCode" && n.properties && n.properties.saveVar) {
        registerCryptoVarName(n.properties.saveVar);
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
      scheduleEnhance();
    });
  }

  function scanGlobalGraphVars() {
    getKnownCryptoVarsMap();
    const sharedMap = getSharedCustomModVarsMap();
    try {
      if (typeof LGraphCanvas !== "undefined" && LGraphCanvas.active_canvas?.graph?._nodes) {
        LGraphCanvas.active_canvas.graph._nodes.forEach((n) => {
          if (!n || !n.properties?.saveVar) return;
          if (n.type === "GenerateRandomCode") {
            registerCryptoVarName(n.properties.saveVar);
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
    const partsList = Array.isArray(varMeta.parts) ? varMeta.parts : CRYPTO_VARIABLE_PARTS;
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
        const partsList = Array.isArray(varMeta.parts) ? varMeta.parts : CRYPTO_VARIABLE_PARTS;
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
            description: varMeta.description || CRYPTO_VAR_DESCRIPTION
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

      // Clear custom sub-variable selection when user interacts with any native DBF variable row
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

function buildSaveVarSnippet(raw, valueExpr = "''", forcedSchema = "crypto_token") {
  const normalized = normalizeSaveVarProp(raw);
  if (!normalized.name) return "";
  const parts = normalized.parts && normalized.parts.length ? normalized.parts : CRYPTO_VARIABLE_PARTS;
  const literal = JSON.stringify({
    name: normalized.name,
    scope: normalized.scope || "local",
    parts: parts,
    schema: forcedSchema || normalized.schema || "crypto_token"
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
          const _mainVal = (_val && typeof _val === 'object' && 'code' in _val) ? _val.code : _val;
          setVariable(_saveName, _mainVal, _saveScope, message, { schema: _saveSchema, parts: _saveCfg.parts });
          if (_val && typeof _val === 'object') {
            for (const [k, v] of Object.entries(_val)) {
              setVariable(\`\${_saveName}.\${k}\`, v, _saveScope, message);
            }
          }
        }
      } catch (err) {
        console.error('[CryptoTools] Error saving generated variable:', err?.message || err);
      }
    })();`;
}

// ============================================================================
// Live Sample Preview Generator (Used in Editor Modal & Canvas)
// ============================================================================

function generateSamplePreview(props) {
  const format = String(props?.format || "alphanumeric");
  let result = "";

  const getRandomInt = (min, max) => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return min + (buf[0] % (max - min));
    }
    return Math.floor(Math.random() * (max - min)) + min;
  };

  const getRandomBytesHex = (bytes) => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint8Array(bytes);
      window.crypto.getRandomValues(buf);
      return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = "";
    for (let i = 0; i < bytes; i++) {
      h += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    }
    return h;
  };

  if (format === "alphanumeric") {
    const rawPattern = String(props?.pattern || "").trim() || "XXXX-XXXX";
    const upperCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const lowerCharset = "abcdefghijklmnopqrstuvwxyz0123456789";
    const upperAlpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowerAlpha = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const allCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let out = "";
    for (let i = 0; i < rawPattern.length; i++) {
      const ch = rawPattern[i];
      if (ch === "\\" && i + 1 < rawPattern.length) {
        out += rawPattern[++i];
      } else if (ch === "X") {
        out += upperCharset[getRandomInt(0, upperCharset.length)];
      } else if (ch === "x") {
        out += lowerCharset[getRandomInt(0, lowerCharset.length)];
      } else if (ch === "A") {
        out += upperAlpha[getRandomInt(0, upperAlpha.length)];
      } else if (ch === "a") {
        out += lowerAlpha[getRandomInt(0, lowerAlpha.length)];
      } else if (ch === "#" || ch === "9") {
        out += digits[getRandomInt(0, digits.length)];
      } else if (ch === "*") {
        out += allCharset[getRandomInt(0, allCharset.length)];
      } else {
        out += ch;
      }
    }
    result = out;
  } else if (format === "pin") {
    const len = Math.max(1, Math.min(64, parseInt(props?.pinLength, 10) || 6));
    let out = "";
    for (let i = 0; i < len; i++) {
      out += getRandomInt(0, 10);
    }
    result = out;
  } else if (format === "uuid") {
    if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
      result = window.crypto.randomUUID();
    } else {
      const h = getRandomBytesHex(16);
      result = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
    }
  } else if (format === "sha256") {
    const source = String(props?.inputSource || "").trim();
    if (source) {
      result = `[SHA-256 hash of '${source.length > 15 ? source.slice(0, 12) + "..." : source}']`;
    } else {
      result = getRandomBytesHex(32);
    }
  } else if (format === "md5") {
    const source = String(props?.inputSource || "").trim();
    if (source) {
      result = `[MD5 hash of '${source.length > 15 ? source.slice(0, 12) + "..." : source}']`;
    } else {
      result = getRandomBytesHex(16);
    }
  } else if (format === "hex") {
    const bytes = Math.max(1, Math.min(2048, parseInt(props?.byteCount, 10) || 16));
    result = getRandomBytesHex(bytes);
  }

  return result;
}

// ============================================================================
// DBF Mod Node Export
// ============================================================================

module.exports = function (DBFMod) {
  setupEditorAutocompleteEnhancer();

  DBFMod.registerActionNode("Crypto", {
    type: "GenerateRandomCode",
    aliases: [
      "Crypto/GenerateRandomCode",
      "Utility/GenerateRandomCode",
      "Generate Random Code",
      "Random Code Generator",
      "Crypto Tools",
      "GenerateRandomCode",
      "Random Token Generator"
    ],
    title: "Generate Random Code",
    color: "#0284c7",
    bgcolor: "#082f49",
    size: [260, 110],
    description:
      "Generates cryptographically secure random codes, PINs, UUIDs, SHA-256/MD5 hashes, and hex bytes using pure Node.js crypto.",
    inputs: [{ name: "Trigger", type: "event" }],
    outputs: [{ name: "Output", type: "event" }],
    properties: {
      format: "alphanumeric",
      pattern: "XXXX-XXXX",
      pinLength: 6,
      byteCount: 16,
      inputSource: "",
      saveVar: ""
    },
    onNodeCreated() {
      registerCryptoNodeVars(this);
    },
    onConfigure() {
      registerCryptoNodeVars(this);
    },
    autoTitle(node) {
      registerCryptoNodeVars(node);
      const fmt = String(node?.properties?.format || "alphanumeric");
      const fmtLabels = {
        alphanumeric: `Alphanumeric (${node?.properties?.pattern || "XXXX-XXXX"})`,
        pin: `PIN (${node?.properties?.pinLength || 6} digits)`,
        uuid: "UUID v4",
        sha256: "SHA-256 Hash",
        md5: "MD5 Hash",
        hex: `Hex (${node?.properties?.byteCount || 16} bytes)`
      };
      return `Generate: ${fmtLabels[fmt] || fmt}`;
    },
    onPropertyChanged(name, value) {
      if (name === "saveVar") {
        registerCryptoVarName(value);
      }
      registerCryptoNodeVars(this);
      if (this.graph && typeof this.graph.setDirtyCanvas === "function") {
        this.graph.setDirtyCanvas(true, true);
      }
    },
    drawForeground(ctx) {
      registerCryptoNodeVars(this);
      const fmt = String(this.properties?.format || "alphanumeric");
      let summary = "";
      if (fmt === "alphanumeric") {
        summary = `Pattern: ${this.properties?.pattern || "XXXX-XXXX"}`;
      } else if (fmt === "pin") {
        summary = `PIN: ${this.properties?.pinLength || 6} digits`;
      } else if (fmt === "uuid") {
        summary = "Format: UUID v4";
      } else if (fmt === "sha256") {
        summary = "Hash: SHA-256";
      } else if (fmt === "md5") {
        summary = "Hash: MD5";
      } else if (fmt === "hex") {
        summary = `Hex: ${this.properties?.byteCount || 16} bytes (${(this.properties?.byteCount || 16) * 2} chars)`;
      }

      const saveVarNorm = normalizeSaveVarProp(this.properties?.saveVar);
      const varLabel = saveVarNorm.name ? `→ {${saveVarNorm.name}}` : "→ [No var saved]";

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Inter, Lexend, system-ui, sans-serif";
      const displaySummary = summary.length > 34 ? summary.slice(0, 31) + "..." : summary;
      ctx.fillText(displaySummary, 12, this.size[1] - 32);

      ctx.fillStyle = saveVarNorm.name ? "#38bdf8" : "#64748b";
      ctx.font = "bold 11px Inter, Lexend, system-ui, sans-serif";
      const displayVar = varLabel.length > 34 ? varLabel.slice(0, 31) + "..." : varLabel;
      ctx.fillText(displayVar, 12, this.size[1] - 16);
    },
    modalFields(node) {
      registerCryptoNodeVars(node);

      if (typeof document !== "undefined") {
        setTimeout(() => {
          try {
            const selects = Array.from(document.querySelectorAll("select"));
            const textInputs = Array.from(document.querySelectorAll('input[type="text"]'));

            const formatSelect = selects.find(
              (s) =>
                s.name === "format" ||
                s.getAttribute("data-property") === "format" ||
                Array.from(s.options).some((o) => o.value === "alphanumeric")
            );

            const patternInput = textInputs.find(
              (el) =>
                el.name === "pattern" ||
                el.getAttribute("data-property") === "pattern" ||
                (el.placeholder && el.placeholder.includes("XXXX-XXXX"))
            );

            const inputSourceInput = textInputs.find(
              (el) =>
                el.name === "inputSource" ||
                el.getAttribute("data-property") === "inputSource" ||
                (el.placeholder && el.placeholder.includes("hash random bytes"))
            );

            const getFieldContainer = (inputEl) => {
              if (!inputEl) return null;
              let cur = inputEl;
              while (cur && cur !== document.body) {
                if (
                  cur.classList &&
                  (cur.classList.contains("field") ||
                    cur.classList.contains("modal-field") ||
                    cur.classList.contains("form-group") ||
                    cur.classList.contains("field-container"))
                ) {
                  return cur;
                }
                if (
                  cur.parentElement &&
                  (cur.parentElement.classList.contains("modal-body") ||
                    cur.parentElement.classList.contains("modal-content") ||
                    cur.parentElement.tagName === "FORM")
                ) {
                  return cur;
                }
                cur = cur.parentElement;
              }
              return inputEl.parentElement || inputEl;
            };

            const inputSourceContainer = getFieldContainer(inputSourceInput);

            const updateHashFieldVisibility = () => {
              const currentFormat = formatSelect ? formatSelect.value : node.properties.format || "alphanumeric";
              const isHashFormat = currentFormat === "sha256" || currentFormat === "md5";
              if (inputSourceContainer) {
                inputSourceContainer.style.display = isHashFormat ? "" : "none";
              }
            };

            // Enforce Flexbox column protection ONLY on patternInput so we never touch variableSave layout
            if (patternInput) {
              const parent = patternInput.parentElement || patternInput.parentNode;
              if (parent) {
                parent.style.display = "flex";
                parent.style.flexDirection = "column";
                parent.style.alignItems = "stretch";
                parent.style.width = "100%";
              }
              patternInput.style.width = "100%";
              patternInput.style.minWidth = "0";
              patternInput.style.boxSizing = "border-box";
            }

            const targetAnchor = patternInput || formatSelect;
            if (targetAnchor) {
              const parent = targetAnchor.parentElement || targetAnchor.parentNode;
              let previewEl = parent ? parent.querySelector(".crypto-live-preview") : null;
              if (!previewEl && parent) {
                previewEl = document.createElement("div");
                previewEl.className = "field-help crypto-live-preview";
                previewEl.style.display = "block";
                previewEl.style.width = "100%";
                previewEl.style.boxSizing = "border-box";
                previewEl.style.marginTop = "6px";
                previewEl.style.padding = "6px 10px";
                previewEl.style.borderRadius = "4px";
                previewEl.style.background = "rgba(14, 165, 233, 0.12)";
                previewEl.style.border = "1px solid rgba(14, 165, 233, 0.35)";
                previewEl.style.fontFamily = "monospace";
                previewEl.style.fontSize = "12px";
                previewEl.style.lineHeight = "1.4";
                previewEl.style.wordBreak = "break-all";
                previewEl.style.clear = "both";

                if (targetAnchor.nextSibling) {
                  parent.insertBefore(previewEl, targetAnchor.nextSibling);
                } else {
                  parent.appendChild(previewEl);
                }
              }

              const updatePreview = () => {
                if (!previewEl) return;
                const currentFormat = formatSelect ? formatSelect.value : node.properties.format || "alphanumeric";
                const currentPattern = patternInput ? patternInput.value : node.properties.pattern || "XXXX-XXXX";
                const sample = generateSamplePreview({
                  format: currentFormat,
                  pattern: currentPattern,
                  pinLength: node.properties.pinLength,
                  byteCount: node.properties.byteCount,
                  inputSource: inputSourceInput ? inputSourceInput.value : node.properties.inputSource
                });
                previewEl.textContent = `Sample Output: ${sample}`;
                previewEl.style.color = "#38bdf8";
              };

              updatePreview();
              updateHashFieldVisibility();

              if (formatSelect && !formatSelect.__cryptoHooked) {
                formatSelect.__cryptoHooked = true;
                formatSelect.addEventListener("change", () => {
                  updatePreview();
                  updateHashFieldVisibility();
                });
              }
              if (patternInput && !patternInput.__cryptoHooked) {
                patternInput.__cryptoHooked = true;
                patternInput.addEventListener("input", updatePreview);
                patternInput.addEventListener("change", updatePreview);
              }
              if (inputSourceInput && !inputSourceInput.__cryptoInputHooked) {
                inputSourceInput.__cryptoInputHooked = true;
                inputSourceInput.addEventListener("input", updatePreview);
                inputSourceInput.addEventListener("change", updatePreview);
              }
            } else {
              updateHashFieldVisibility();
            }

            // Watch variableSave text input inside the modal so custom variable names register live
            textInputs.forEach((el) => {
              if (el === patternInput || el === inputSourceInput || el.__cryptoVarSaveHooked) return;
              if (
                el.placeholder &&
                (el.placeholder.includes("XXXX-XXXX") || el.placeholder.includes("hash random bytes"))
              ) {
                return;
              }
              el.__cryptoVarSaveHooked = true;
              const onVarInput = () => {
                const v = String(el.value || "").trim();
                if (isValidVarName(v)) {
                  registerCryptoVarName(v);
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
          label: "Generation Format *",
          property: "format",
          value: node.properties.format || "alphanumeric",
          type: "select",
          options: [
            { label: "Formatted Alphanumeric (e.g. XXXX-XXXX)", value: "alphanumeric" },
            { label: "Numeric PIN (4-8 digits)", value: "pin" },
            { label: "UUID v4", value: "uuid" },
            { label: "SHA-256 Hash", value: "sha256" },
            { label: "MD5 Hash", value: "md5" },
            { label: "Random Hex Bytes", value: "hex" }
          ],
          help: "Choose the cryptographic format to generate."
        },
        {
          label: "Format Pattern",
          property: "pattern",
          value: node.properties.pattern ?? "XXXX-XXXX",
          type: "text",
          placeholder: "e.g. XXXX-XXXX or DBF-####-****",
          help: "Pattern tokens: X (uppercase alphanumeric), x (lowercase alphanumeric), A (A-Z), a (a-z), # or 9 (0-9), * (any alphanumeric). Escape literal tokens with \\ (e.g. \\X). Defaults to XXXX-XXXX.",
          showWhen: { property: "format", equals: "alphanumeric" }
        },
        {
          label: "PIN Length (Digits)",
          property: "pinLength",
          value: node.properties.pinLength ?? 6,
          type: "number",
          min: 1,
          max: 64,
          step: 1,
          placeholder: "6",
          help: "Number of numeric digits to generate (commonly 4 to 8 digits, e.g. 6 for 2FA-style codes).",
          showWhen: { property: "format", equals: "pin" }
        },
        {
          label: "Hex Byte Count",
          property: "byteCount",
          value: node.properties.byteCount ?? 16,
          type: "number",
          min: 1,
          max: 2048,
          step: 1,
          placeholder: "16",
          help: "Number of random bytes (e.g. 16 bytes = 32 hex characters, 32 bytes = 64 hex characters).",
          showWhen: { property: "format", equals: "hex" }
        },
        {
          label: "Input Text to Hash (Optional)",
          property: "inputSource",
          value: node.properties.inputSource || "",
          type: "text",
          placeholder: "Leave empty to hash random bytes, or enter text / {variable}",
          help: "Used for SHA-256 and MD5 hashes. When left blank, hashes cryptographically random entropy.",
          showWhen: {
            anyOf: [
              { property: "format", equals: "sha256" },
              { property: "format", equals: "md5" }
            ]
          }
        },
        {
          label: "Save Result to Variable",
          property: "saveVar",
          value: node.properties.saveVar,
          type: "variableSave",
          saveLabel: "the generated random code or hash",
          autoLabel: "generated_code",
          saveSchema: "crypto_token",
          parts: CRYPTO_VARIABLE_PARTS,
          schemaParts: CRYPTO_VARIABLE_PARTS,
          help: "Stores the generated string in a flow variable. Access sub-variables with {generated_code.code}, {generated_code.format}, {generated_code.length}, {generated_code.timestamp}, etc."
        }
      ];
    },
    codegen: {
      role: "action",
      buildAction(nodeData, ctx, helpers = {}) {
        registerCryptoNodeVars(nodeData);
        const suffix = getSuffix(nodeData, ctx);
        const formatEsc = escapeJsStr(nodeData?.properties?.format || "alphanumeric", ctx);
        const patternEsc = escapeJsStr(nodeData?.properties?.pattern ?? "XXXX-XXXX", ctx);
        const pinLengthEsc = escapeJsStr(String(nodeData?.properties?.pinLength ?? 6), ctx);
        const byteCountEsc = escapeJsStr(String(nodeData?.properties?.byteCount ?? 16), ctx);
        const inputSourceEsc = escapeJsStr(nodeData?.properties?.inputSource || "", ctx);

        const saveSnippet = buildSaveVarSnippet(
          nodeData?.properties?.saveVar,
          `_result${suffix}`,
          "crypto_token"
        );

        return {
          code: `
    let _code${suffix} = '';
    let _format${suffix} = '${formatEsc}';
    try {
      const _c = (typeof crypto !== 'undefined' && crypto.randomBytes) ? crypto : require('crypto');

      if (_format${suffix} === 'alphanumeric') {
        const _rawPattern = '${patternEsc}' || 'XXXX-XXXX';
        const _pattern = resolveTemplateVars(_rawPattern, message).trim() || 'XXXX-XXXX';
        const _upperCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const _lowerCharset = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const _upperAlpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const _lowerAlpha = 'abcdefghijklmnopqrstuvwxyz';
        const _digits = '0123456789';
        const _allCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        let _out = '';
        for (let _i = 0; _i < _pattern.length; _i++) {
          const _ch = _pattern[_i];
          if (_ch === '\\\\' && _i + 1 < _pattern.length) {
            _out += _pattern[++_i];
          } else if (_ch === 'X') {
            _out += _upperCharset[_c.randomInt(0, _upperCharset.length)];
          } else if (_ch === 'x') {
            _out += _lowerCharset[_c.randomInt(0, _lowerCharset.length)];
          } else if (_ch === 'A') {
            _out += _upperAlpha[_c.randomInt(0, _upperAlpha.length)];
          } else if (_ch === 'a') {
            _out += _lowerAlpha[_c.randomInt(0, _lowerAlpha.length)];
          } else if (_ch === '#' || _ch === '9') {
            _out += _digits[_c.randomInt(0, _digits.length)];
          } else if (_ch === '*') {
            _out += _allCharset[_c.randomInt(0, _allCharset.length)];
          } else {
            _out += _ch;
          }
        }
        _code${suffix} = _out;
      } else if (_format${suffix} === 'pin') {
        const _pinLen = Math.max(1, Math.min(64, parseInt('${pinLengthEsc}', 10) || 6));
        let _out = '';
        for (let _i = 0; _i < _pinLen; _i++) {
          _out += _c.randomInt(0, 10);
        }
        _code${suffix} = _out;
      } else if (_format${suffix} === 'uuid') {
        if (typeof _c.randomUUID === 'function') {
          _code${suffix} = _c.randomUUID();
        } else {
          const _buf = _c.randomBytes(16);
          _buf[6] = (_buf[6] & 0x0f) | 0x40;
          _buf[8] = (_buf[8] & 0x3f) | 0x80;
          const _h = _buf.toString('hex');
          _code${suffix} = \`\${_h.slice(0, 8)}-\${_h.slice(8, 12)}-\${_h.slice(12, 16)}-\${_h.slice(16, 20)}-\${_h.slice(20, 32)}\`;
        }
      } else if (_format${suffix} === 'sha256') {
        const _rawInput = '${inputSourceEsc}';
        const _resolved = resolveTemplateVars(_rawInput, message);
        if (_resolved && _resolved.length > 0) {
          _code${suffix} = _c.createHash('sha256').update(_resolved, 'utf8').digest('hex');
        } else {
          _code${suffix} = _c.createHash('sha256').update(_c.randomBytes(32)).digest('hex');
        }
      } else if (_format${suffix} === 'md5') {
        const _rawInput = '${inputSourceEsc}';
        const _resolved = resolveTemplateVars(_rawInput, message);
        if (_resolved && _resolved.length > 0) {
          _code${suffix} = _c.createHash('md5').update(_resolved, 'utf8').digest('hex');
        } else {
          _code${suffix} = _c.createHash('md5').update(_c.randomBytes(16)).digest('hex');
        }
      } else if (_format${suffix} === 'hex') {
        const _byteCount = Math.max(1, Math.min(2048, parseInt('${byteCountEsc}', 10) || 16));
        _code${suffix} = _c.randomBytes(_byteCount).toString('hex');
      }

      const _result${suffix} = {
        code: _code${suffix},
        value: _code${suffix},
        format: _format${suffix},
        length: typeof _code${suffix} === 'string' ? _code${suffix}.length : 0,
        timestamp: new Date().toISOString()
      };
      ${saveSnippet}
    } catch (_err${suffix}) {
      console.warn('GenerateRandomCode node error:', _err${suffix}?.message || _err${suffix});
    }`
        };
      }
    }
  });
};
