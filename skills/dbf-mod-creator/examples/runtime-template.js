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

  // Wait up to maxWaitMs if client is still logging in
  async function waitForClientReady(client, maxWaitMs = 5000) {
    if (!client) return;
    if (client.isReady && typeof client.isReady === "function" && client.isReady()) return;
    if (client.user && client.guilds?.cache?.size) return;

    await new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, maxWaitMs);

      const onReady = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve();
        }
      };

      const readyEvent = (typeof Events !== "undefined" && Events?.ClientReady) ? Events.ClientReady : "clientReady";
      if (typeof client.once === "function") {
        client.once(readyEvent, onReady);
      } else {
        setTimeout(onReady, 1000);
      }
    });
  }

  // Resolve active text channel across all guilds with multi-guild fallback
  async function resolveBestGuildAndChannel(botClient) {
    if (!botClient) return { guild: null, channel: null };
    await waitForClientReady(botClient, 5000);

    let targetGuild = null;
    let targetChannel = null;

    // 1. Search botClient.channels.cache directly across all guilds
    if (botClient.channels?.cache?.size) {
      targetChannel = botClient.channels.cache.find(
        (c) => c && typeof c.send === "function" && (c.isTextBased?.() || c.type === 0 || c.type === "GUILD_TEXT")
      ) || null;
      if (targetChannel && targetChannel.guild) {
        targetGuild = targetChannel.guild;
      }
    }

    // 2. Iterate all cached guilds
    if (!targetChannel && botClient.guilds?.cache?.size) {
      for (const guild of botClient.guilds.cache.values()) {
        if (!guild) continue;
        if (guild.channels?.cache?.size) {
          const ch = guild.channels.cache.find(
            (c) => c && typeof c.send === "function" && (c.isTextBased?.() || c.type === 0 || c.type === "GUILD_TEXT")
          );
          if (ch) {
            targetGuild = guild;
            targetChannel = ch;
            break;
          }
        }
      }
    }

    if (!targetGuild && botClient.guilds?.cache?.size) {
      targetGuild = botClient.guilds.cache.first() || null;
    }

    return { guild: targetGuild, channel: targetChannel };
  }

  // Dispatch a custom event into DBF's flow engine with complete stub message
  async function dispatchCustomEvent(nodeId, eventType, customData = {}) {
    const flowRunner = resolveFlowRunner();
    const botClient = resolveDiscordClient();
    if (!flowRunner) return false;

    const { guild: targetGuild, channel: targetChannel } = await resolveBestGuildAndChannel(botClient);

    const safeGuild = targetGuild || {
      id: "0",
      name: "Default Guild",
      channels: { cache: new Map(), fetch: async () => new Map() },
      members: { cache: new Map(), fetch: async () => new Map(), me: null }
    };

    const fallbackChannel = {
      id: "0",
      name: "console-fallback",
      guild: safeGuild,
      isTextBased: () => true,
      send: async (msgPayload) => {
        const text = typeof msgPayload === "string" ? msgPayload : msgPayload?.content || JSON.stringify(msgPayload);
        console.warn(`[CustomMod:ChannelSend] ${text}`);
        return { id: `msg_${Date.now()}`, content: text, channel: fallbackChannel, guild: safeGuild };
      }
    };

    const actualChannel = targetChannel || fallbackChannel;
    const authorUser = botClient?.user || { id: "0", username: "Bot", bot: true };
    const botMember = safeGuild?.members?.me || safeGuild?.members?.cache?.get(authorUser.id) || {
      id: authorUser.id,
      user: authorUser,
      permissions: { has: () => true },
      roles: { cache: new Map() }
    };

    const payload = {
      nodeId: String(nodeId).trim(),
      timestamp: new Date().toISOString(),
      ...customData
    };

    const stub = {
      id: `${eventType}_${nodeId}_${Date.now()}`,
      content: "",
      author: authorUser,
      user: authorUser,
      guild: safeGuild,
      guildId: safeGuild.id || "0",
      channel: actualChannel,
      channelId: actualChannel.id || "0",
      member: botMember,
      client: botClient,
      reply: async (msgPayload, ...rest) => {
        if (typeof actualChannel.send === "function") {
          return actualChannel.send(msgPayload, ...rest);
        }
        return fallbackChannel.send(msgPayload, ...rest);
      },
      send: async (msgPayload, ...rest) => {
        if (typeof actualChannel.send === "function") {
          return actualChannel.send(msgPayload, ...rest);
        }
        return fallbackChannel.send(msgPayload, ...rest);
      },
      __eventType: eventType,
      __eventPayload: payload
    };

    try {
      await flowRunner(stub, eventType, payload);
      return true;
    } catch (err) {
      console.error(`[CustomMod] Flow execution error:`, err?.stack || err?.message || err);
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
