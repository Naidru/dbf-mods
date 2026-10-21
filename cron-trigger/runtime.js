// ============================================================================
// DBF Cron Trigger Mod - Bot Runtime Engine
// ============================================================================
// Pure, zero-dependency background CRON scheduler running inside bot.js.
// Automatically reads CronTrigger nodes from the flow, evaluates 5-part CRON
// schedules at each minute boundary, and triggers the connected actions.
// ============================================================================

globalThis.__dbfCronRuntimeLoaded = true;

(function initDbfCronBotRuntime() {
  if (globalThis.__dbfCronSchedulerEngineInit) return;
  globalThis.__dbfCronSchedulerEngineInit = true;

  const fs = typeof require !== "undefined" ? require("fs") : null;
  const path = typeof require !== "undefined" ? require("path") : null;

  if (!fs || !path) {
    console.warn("[Cron] File system access not available. Cron scheduler skipped.");
    return;
  }

  const scheduledJobs = new Map();
  let minuteTimer = null;
  let activeConfigPath = null;
  let configWatchTimer = null;

  // --------------------------------------------------------------------------
  // 1. CRON Expression Parser & Matcher (5-Part Standard)
  // --------------------------------------------------------------------------
  const MONTH_NAMES = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };

  const DAY_NAMES = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
  };

  function parseCronField(field, min, max, nameMap = {}) {
    const values = new Set();
    const parts = String(field || "").trim().split(",");

    for (const rawPart of parts) {
      let part = rawPart.trim().toUpperCase();
      if (!part) continue;

      for (const [name, num] of Object.entries(nameMap)) {
        part = part.replace(new RegExp(name, "g"), String(num));
      }

      // Step syntax: */5 or 10-30/5
      const stepMatch = part.match(/^(\*|(?:\d+)(?:-\d+)?)\/(\d+)$/);
      if (stepMatch) {
        const step = Math.max(1, parseInt(stepMatch[2], 10) || 1);
        let rangeMin = min;
        let rangeMax = max;
        if (stepMatch[1] !== "*") {
          const rangeParts = stepMatch[1].split("-");
          rangeMin = Math.max(min, parseInt(rangeParts[0], 10) || min);
          rangeMax = rangeParts.length > 1 ? Math.min(max, parseInt(rangeParts[1], 10) || max) : max;
        }
        for (let i = rangeMin; i <= rangeMax; i += step) values.add(i);
        continue;
      }

      // Wildcard *
      if (part === "*") {
        for (let i = min; i <= max; i++) values.add(i);
        continue;
      }

      // Range syntax: 1-5
      const rangeMatch = part.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = Math.max(min, parseInt(rangeMatch[1], 10));
        const end = Math.min(max, parseInt(rangeMatch[2], 10));
        for (let i = start; i <= end; i++) values.add(i);
        continue;
      }

      // Exact number
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= min && num <= max) {
        values.add(num);
      }
    }
    return values;
  }

  function compileCronPattern(expression) {
    const raw = String(expression || "").trim();
    const fields = raw.split(/\s+/);
    if (fields.length !== 5) {
      return null;
    }

    try {
      const minutes = parseCronField(fields[0], 0, 59);
      const hours = parseCronField(fields[1], 0, 23);
      const daysOfMonth = parseCronField(fields[2], 1, 31);
      const months = parseCronField(fields[3], 1, 12, MONTH_NAMES);
      const daysOfWeek = parseCronField(fields[4], 0, 7, DAY_NAMES);
      if (daysOfWeek.has(7)) daysOfWeek.add(0);

      return {
        expression: raw,
        minutes,
        hours,
        daysOfMonth,
        months,
        daysOfWeek
      };
    } catch (_) {
      return null;
    }
  }

  function parseOffsetMinutes(tzStr) {
    const match = String(tzStr || "").match(/UTC([+-]\d{2}):(\d{2})/i);
    if (!match) return 0;
    const sign = match[1][0] === "-" ? -1 : 1;
    const hours = parseInt(match[1].slice(1), 10);
    const minutes = parseInt(match[2], 10);
    return sign * (hours * 60 + minutes);
  }

  function getTimeParts(date, timezone = "UTC+00:00 (UTC / GMT)") {
    const offsetMin = parseOffsetMinutes(timezone);
    const target = new Date(date.getTime() + offsetMin * 60000);
    return {
      minute: target.getUTCMinutes(),
      hour: target.getUTCHours(),
      dayOfMonth: target.getUTCDate(),
      month: target.getUTCMonth() + 1,
      dayOfWeek: target.getUTCDay()
    };
  }

  function matchesCron(compiled, date, timezone = "UTC+00:00 (UTC / GMT)") {
    if (!compiled) return false;
    const parts = getTimeParts(date, timezone);
    return (
      compiled.minutes.has(parts.minute) &&
      compiled.hours.has(parts.hour) &&
      compiled.daysOfMonth.has(parts.dayOfMonth) &&
      compiled.months.has(parts.month) &&
      compiled.daysOfWeek.has(parts.dayOfWeek)
    );
  }

  // --------------------------------------------------------------------------
  // 2. Discover and Load Cron Trigger Nodes
  // --------------------------------------------------------------------------
  function findProjectConfigFile() {
    const candidates = [
      path.join(process.cwd(), "bot.config.json"),
      path.join(__dirname, "bot.config.json"),
      path.join(__dirname, "..", "bot.config.json"),
      path.join(__dirname, "..", "..", "bot.config.json")
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  function loadCronNodesFromConfig(configPath) {
    if (!configPath || !fs.existsSync(configPath)) return [];
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      const cfg = JSON.parse(raw);
      const nodes = [];

      if (cfg.flow && Array.isArray(cfg.flow.nodes)) {
        nodes.push(...cfg.flow.nodes);
      }

      if (cfg.flowTabs && Array.isArray(cfg.flowTabs.tabs)) {
        cfg.flowTabs.tabs.forEach((tab) => {
          if (!tab?.disabled && tab?.flow && Array.isArray(tab.flow.nodes)) {
            nodes.push(...tab.flow.nodes);
          }
        });
      }

      return nodes.filter(
        (n) => n && (n.type === "CronTrigger" || n.type === "Scheduling/CronTrigger") && !n.disabled
      );
    } catch (_) {
      return [];
    }
  }

  function reloadScheduledJobs() {
    activeConfigPath = findProjectConfigFile();
    if (!activeConfigPath) return;

    const cronNodes = loadCronNodesFromConfig(activeConfigPath);
    const seenIds = new Set();

    cronNodes.forEach((node) => {
      const id = String(node.id || "").trim();
      if (!id) return;
      seenIds.add(id);

      const props = node.properties || {};
      const expression = String(props.cronExpression || "* * * * *").trim();
      const timezone = String(props.timezone || "UTC+00:00 (UTC / GMT)").trim();
      const runOnStartup = !!props.runOnStartup;

      const compiled = compileCronPattern(expression);

      const existing = scheduledJobs.get(id);
      if (existing) {
        existing.cronExpression = expression;
        existing.timezone = timezone;
        existing.runOnStartup = runOnStartup;
        existing.compiled = compiled;
      } else {
        scheduledJobs.set(id, {
          nodeId: id,
          cronExpression: expression,
          timezone,
          runOnStartup,
          compiled,
          runCount: 0,
          lastMinuteKey: null,
          didStartupRun: false
        });

        if (compiled) {
          console.log(`[Cron] Scheduled: (${expression}) [${timezone}]`);
        }
      }
    });

    for (const [id] of scheduledJobs.entries()) {
      if (!seenIds.has(id)) {
        scheduledJobs.delete(id);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. Flow Execution Dispatcher
  // --------------------------------------------------------------------------
  function resolveFlowRunner() {
    if (typeof runFlowWithMessage === "function") {
      globalThis.__dbfRunFlowWithMessage = runFlowWithMessage;
      return runFlowWithMessage;
    }
    if (typeof globalThis.__dbfRunFlowWithMessage === "function") {
      return globalThis.__dbfRunFlowWithMessage;
    }
    return null;
  }

  function resolveDiscordClient() {
    if (typeof client !== "undefined" && client && typeof client.on === "function") {
      globalThis.__dbfDiscordClient = client;
      return client;
    }
    if (globalThis.__dbfDiscordClient) {
      return globalThis.__dbfDiscordClient;
    }
    return null;
  }

  async function triggerCronJob(job, reason = "schedule") {
    const flowRunner = resolveFlowRunner();
    const botClient = resolveDiscordClient();

    if (!flowRunner) return false;

    job.runCount++;

    const defaultGuild = botClient?.guilds?.cache?.first?.() || null;
    const defaultChannel =
      defaultGuild?.channels?.cache?.find(
        (c) => c && typeof c.isTextBased === "function" && c.isTextBased()
      ) || null;

    const payload = {
      nodeId: job.nodeId,
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      timestamp: new Date().toISOString(),
      runCount: job.runCount,
      reason
    };

    const stub = {
      id: `cron_${job.nodeId}_${Date.now()}`,
      content: "",
      author: botClient?.user || null,
      guild: defaultGuild,
      channel: defaultChannel,
      client: botClient,
      reply: async () => {},
      __eventType: "cronTrigger",
      __eventPayload: payload
    };

    console.log(`[Cron] Executing: (${job.cronExpression}) [${reason}]`);

    try {
      await flowRunner(stub, "cronTrigger", payload);
      return true;
    } catch (err) {
      console.error(`[Cron] Flow execution failed:`, err?.message || err);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 4. Minute Alignment Tick Loop
  // --------------------------------------------------------------------------
  function checkAndFireScheduledJobs() {
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = String(now.getUTCMonth() + 1).padStart(2, "0");
    const utcDay = String(now.getUTCDate()).padStart(2, "0");
    const utcHour = String(now.getUTCHours()).padStart(2, "0");
    const utcMin = String(now.getUTCMinutes()).padStart(2, "0");
    const minuteKey = `${utcYear}-${utcMonth}-${utcDay}T${utcHour}:${utcMin}Z`;

    for (const job of scheduledJobs.values()) {
      if (!job.compiled) continue;
      if (job.lastMinuteKey === minuteKey) continue;

      if (matchesCron(job.compiled, now, job.timezone)) {
        job.lastMinuteKey = minuteKey;
        void triggerCronJob(job, "schedule");
      }
    }
  }

  function scheduleNextMinuteTick() {
    if (minuteTimer) clearTimeout(minuteTimer);

    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 30;

    minuteTimer = setTimeout(() => {
      try {
        checkAndFireScheduledJobs();
      } catch (err) {
        console.error("[Cron] Minute tick error:", err);
      } finally {
        scheduleNextMinuteTick();
      }
    }, Math.max(50, msToNextMinute));

    if (minuteTimer && typeof minuteTimer.unref === "function") {
      minuteTimer.unref();
    }
  }

  // --------------------------------------------------------------------------
  // 5. Bot Startup & Auto Reload
  // --------------------------------------------------------------------------
  function onBotReady() {
    reloadScheduledJobs();

    setTimeout(() => {
      for (const job of scheduledJobs.values()) {
        if (job.runOnStartup && !job.didStartupRun) {
          job.didStartupRun = true;
          void triggerCronJob(job, "startup");
        }
      }
    }, 1200);
  }

  const botClient = resolveDiscordClient();
  if (botClient && typeof botClient.on === "function") {
    if (typeof botClient.isReady === "function" && botClient.isReady()) {
      onBotReady();
    } else {
      botClient.once("ready", onBotReady);
      botClient.once("clientReady", onBotReady);
    }
  } else {
    reloadScheduledJobs();
    setTimeout(onBotReady, 2000);
  }

  scheduleNextMinuteTick();

  if (activeConfigPath && fs.existsSync(activeConfigPath)) {
    try {
      fs.watch(activeConfigPath, () => {
        if (configWatchTimer) clearTimeout(configWatchTimer);
        configWatchTimer = setTimeout(() => {
          reloadScheduledJobs();
        }, 500);
      });
    } catch (_) {}
  }
})();
