// ============================================================================
// DBF Bot Runtime Template (runtime.js)
// ============================================================================
// Injected inside runFlowWithMessage() in bot.js.
// ALWAYS guard with a globalThis flag so initialization only happens once.
// ============================================================================

globalThis.__dbfCustomModRuntimeLoaded = true;

(function initCustomModBotRuntime() {
  // CRITICAL: Guard against re-execution on every runFlowWithMessage() call
  if (globalThis.__dbfCustomModEngineInit) return;
  globalThis.__dbfCustomModEngineInit = true;

  const fs = typeof require !== "undefined" ? require("fs") : null;
  const path = typeof require !== "undefined" ? require("path") : null;
  if (!fs || !path) return;

  // Capture runFlowWithMessage and client references from enclosing bot.js scope
  function resolveFlowRunner() {
    if (typeof runFlowWithMessage === "function") {
      globalThis.__dbfRunFlowWithMessage = runFlowWithMessage;
      return runFlowWithMessage;
    }
    return globalThis.__dbfRunFlowWithMessage || null;
  }

  function resolveDiscordClient() {
    if (typeof client !== "undefined" && client && typeof client.on === "function") {
      globalThis.__dbfDiscordClient = client;
      return client;
    }
    return globalThis.__dbfDiscordClient || null;
  }

  // Locate project bot.config.json
  function findProjectConfigFile() {
    const candidates = [
      path.join(process.cwd(), "bot.config.json"),
      path.join(__dirname, "bot.config.json"),
      path.join(__dirname, "..", "bot.config.json")
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  // Load all active (non-disabled) nodes of a specific type across all flow tabs
  function loadNodesByType(configPath, targetType) {
    if (!configPath || !fs.existsSync(configPath)) return [];
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const nodes = [];
      const seenIds = new Set();

      const collect = (node) => {
        if (!node || node.disabled) return;
        const id = String(node.id ?? "").trim();
        if (!id || seenIds.has(id)) return;
        if (node.type === targetType) {
          seenIds.add(id);
          nodes.push(node);
        }
      };

      if (cfg.flowTabs && Array.isArray(cfg.flowTabs.tabs)) {
        cfg.flowTabs.tabs.forEach((tab) => {
          if (tab && !tab.disabled && tab.flow && Array.isArray(tab.flow.nodes)) {
            tab.flow.nodes.forEach(collect);
          }
        });
      }
      if (cfg.flow && Array.isArray(cfg.flow.nodes)) {
        cfg.flow.nodes.forEach(collect);
      }
      return nodes;
    } catch (_) {
      return [];
    }
  }

  // Dispatch a custom event into DBF's flow engine
  async function dispatchCustomEvent(nodeId, eventType, customData = {}) {
    const flowRunner = resolveFlowRunner();
    const botClient = resolveDiscordClient();
    if (!flowRunner) return false;

    const defaultGuild = botClient?.guilds?.cache?.first?.() || null;
    const defaultChannel =
      defaultGuild?.channels?.cache?.find(
        (c) => c && typeof c.isTextBased === "function" && c.isTextBased()
      ) || null;

    const payload = {
      nodeId: String(nodeId),
      timestamp: new Date().toISOString(),
      ...customData
    };

    const stub = {
      id: `${eventType}_${nodeId}_${Date.now()}`,
      content: "",
      author: botClient?.user || null,
      guild: defaultGuild,
      channel: defaultChannel,
      client: botClient,
      reply: async () => {},
      __eventType: eventType,
      __eventPayload: payload
    };

    try {
      await flowRunner(stub, eventType, payload);
      return true;
    } catch (err) {
      console.error(`[CustomMod] Flow execution error:`, err?.message || err);
      return false;
    }
  }

  // Attach to Discord Client ready event (with discord.js v15 clientReady compatibility)
  function attachClientHooks() {
    const botClient = resolveDiscordClient();
    if (!botClient || botClient.__customModHooked) return;
    botClient.__customModHooked = true;

    const readyEvent = (typeof Events !== "undefined" && Events.ClientReady) ? Events.ClientReady : "clientReady";
    const onReady = () => {
      const configPath = findProjectConfigFile();
      const activeNodes = loadNodesByType(configPath, "CustomStarterEvent");
      console.log(`[CustomMod] Bot ready. Found ${activeNodes.length} active CustomStarterEvent node(s).`);
    };

    if (botClient.isReady && botClient.isReady()) {
      onReady();
    } else {
      botClient.once(readyEvent, onReady);
    }
  }

  // Periodic poll or initial hook
  attachClientHooks();
  setInterval(attachClientHooks, 3000);
})();
