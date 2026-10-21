// ============================================================================
// Cron & Quartz Schedule Trigger Bot Runtime (runtime.js)
// ============================================================================
// Clean-room implementation for Discord Bot Factory (DBF).
// Runs inside bot.js, evaluates schedules, and triggers matching flows.
// Zero external npm dependencies. Pure standard Node.js.
// ============================================================================

globalThis.__dbfCronSchedulerRuntimeLoaded = true;

(function initCronSchedulerRuntime() {
  // Guard against multiple initializations
  if (globalThis.__dbfCronSchedulerEngineInit) return;
  globalThis.__dbfCronSchedulerEngineInit = true;

  const fs = typeof require !== "undefined" ? require("fs") : null;
  const path = typeof require !== "undefined" ? require("path") : null;
  if (!fs || !path) return;

  const MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
    7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December",
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };

  const DOW_QUARTZ = {
    SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7
  };

  const DOW_UNIX = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
  };

  const DOW_UNIX_NAMES = {
    0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday",
    SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday"
  };

  const DOW_QUARTZ_NAMES = {
    1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday",
    SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday"
  };

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

  const runCountMap = new Map();
  const executedKeys = new Map();
  let startupDispatched = false;
  let cachedMtime = 0;
  let cachedNodes = [];

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

  let lastStatCheck = 0;
  let cachedBotJsMtime = 0;
  let cachedRuntimeIdMap = new Map();

  function toBool(val) {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const s = val.trim().toLowerCase();
      return s === "true" || s === "1" || s === "yes";
    }
    if (typeof val === "number") return val !== 0;
    return false;
  }

  function findProjectConfigFile() {
    const candidates = [
      process.env.DBF_CONFIG_PATH,
      globalThis.__dbfConfigPath,
      path.join(process.cwd(), "bot.config.json"),
      path.join(process.cwd(), "..", "bot.config.json"),
      path.join(__dirname, "bot.config.json"),
      path.join(__dirname, "..", "bot.config.json"),
      path.join(__dirname, "..", "..", "bot.config.json"),
      path.join(__dirname, "..", "..", "..", "bot.config.json")
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  const CRON_NODE_TYPES = new Set([
    "CronTrigger",
    "Events/CronTrigger",
    "Scheduling/CronTrigger",
    "When Cron Schedule Triggers",
    "Cron Trigger",
    "Quartz Trigger"
  ]);

  function isCronTriggerType(type) {
    if (!type || typeof type !== "string") return false;
    return CRON_NODE_TYPES.has(type) || type.includes("CronTrigger");
  }

  function isDisabledFlag(val) {
    return val === true || val === "true" || val === 1;
  }

  function isEnabledFlag(val) {
    if (val === undefined || val === null) return true;
    return val !== false && val !== "false" && val !== 0;
  }

  // In multi-tab DBF projects, DBF compiles nodes with a sequential runtimeId in bot.js
  // while bot.config.json keeps the per-tab node.id. Extract the exact mapping from bot.js.
  function getRuntimeIdMap(configPath) {
    try {
      const botJsCandidates = [
        configPath ? path.join(path.dirname(configPath), "bot.js") : null,
        typeof process !== "undefined" && Array.isArray(process.argv) && process.argv[1] ? process.argv[1] : null,
        path.join(process.cwd(), "bot.js")
      ].filter(Boolean);

      let botJsPath = null;
      for (const candidate of botJsCandidates) {
        if (fs.existsSync(candidate) && candidate.endsWith(".js")) {
          botJsPath = candidate;
          break;
        }
      }
      if (!botJsPath) return cachedRuntimeIdMap;

      const stat = fs.statSync(botJsPath);
      if (stat.mtimeMs === cachedBotJsMtime && cachedRuntimeIdMap.size > 0) {
        return cachedRuntimeIdMap;
      }

      const content = fs.readFileSync(botJsPath, "utf8");
      const map = new Map();
      const metaRegex = /\{\s*id:\s*'([^']+)'\s*,\s*runtimeId:\s*'([^']+)'[^{}]*type:\s*'([^']+)'[^{}]*tabId:\s*'([^']*)'\s*\}/g;
      let match;
      while ((match = metaRegex.exec(content)) !== null) {
        const origId = match[1].trim();
        const rtId = match[2].trim();
        const nType = match[3].trim();
        const tId = match[4].trim();
        if (isCronTriggerType(nType)) {
          if (tId) {
            map.set(`${tId}:${origId}`, rtId);
          }
          if (!map.has(`*:${origId}`)) {
            map.set(`*:${origId}`, rtId);
          }
        }
      }

      cachedBotJsMtime = stat.mtimeMs;
      cachedRuntimeIdMap = map;
      return cachedRuntimeIdMap;
    } catch (_) {
      return cachedRuntimeIdMap;
    }
  }

  function getActiveCronNodes() {
    const configPath = findProjectConfigFile();
    if (!configPath || !fs.existsSync(configPath)) return [];
    try {
      const now = Date.now();
      // In large projects, throttle statSync to at most once every 1500ms to eliminate synchronous I/O overhead
      if (now - lastStatCheck < 1500 && cachedNodes.length > 0) {
        return cachedNodes;
      }
      lastStatCheck = now;

      const stat = fs.statSync(configPath);
      const runtimeIdMap = getRuntimeIdMap(configPath);
      if (stat.mtimeMs === cachedMtime && cachedNodes.length > 0) {
        // Ensure runtimeIds stay updated if bot.js was regenerated
        cachedNodes.forEach((node) => {
          const origId = String(node.id ?? "").trim();
          const tabKey = String(node.__tabKey || "root");
          node.__runtimeId = runtimeIdMap.get(`${tabKey}:${origId}`) || runtimeIdMap.get(`*:${origId}`) || origId;
        });
        return cachedNodes;
      }

      const raw = fs.readFileSync(configPath, "utf8");
      const cfg = JSON.parse(raw);
      const nodes = [];
      const seenCompositeKeys = new Set();

      const collect = (node, tabKey = "root") => {
        if (!node) return;
        if (isDisabledFlag(node.disabled) || !isEnabledFlag(node.enabled)) return;
        if (!isCronTriggerType(node.type)) return;

        const id = String(node.id ?? "").trim();
        if (!id) return;

        // Composite key ensures nodes in different tabs with identical LiteGraph IDs are not dropped
        const compositeKey = `${tabKey}_${id}`;
        if (seenCompositeKeys.has(compositeKey)) return;
        seenCompositeKeys.add(compositeKey);

        // Store tab, composite uniqueId, and compiled runtimeId
        node.__tabKey = tabKey;
        node.__uniqueId = compositeKey;
        node.__runtimeId = runtimeIdMap.get(`${tabKey}:${id}`) || runtimeIdMap.get(`*:${id}`) || id;
        nodes.push(node);
      };

      // 1. Support multi-tab flow structures (flowTabs as object or array)
      const tabs = Array.isArray(cfg.flowTabs)
        ? cfg.flowTabs
        : (cfg.flowTabs && Array.isArray(cfg.flowTabs.tabs) ? cfg.flowTabs.tabs : (Array.isArray(cfg.tabs) ? cfg.tabs : []));

      tabs.forEach((tab, index) => {
        if (!tab) return;
        if (isDisabledFlag(tab.disabled) || !isEnabledFlag(tab.enabled)) return;
        const tabKey = String(tab.id || tab.name || `tab_${index}`);

        const tabNodes = Array.isArray(tab.flow?.nodes)
          ? tab.flow.nodes
          : (Array.isArray(tab.nodes)
            ? tab.nodes
            : (Array.isArray(tab.flow?.graph?.nodes)
              ? tab.flow.graph.nodes
              : (Array.isArray(tab.graph?.nodes) ? tab.graph.nodes : [])));

        tabNodes.forEach((n) => collect(n, tabKey));
      });

      // 2. Support root/single flow structures
      const rootNodes = Array.isArray(cfg.flow?.nodes)
        ? cfg.flow.nodes
        : (Array.isArray(cfg.nodes)
          ? cfg.nodes
          : (Array.isArray(cfg.flow?.graph?.nodes)
            ? cfg.flow.graph.nodes
            : (Array.isArray(cfg.graph?.nodes) ? cfg.graph.nodes : [])));

      rootNodes.forEach((n) => collect(n, "root"));

      // 3. Support multi-flow list structures (cfg.flows = [{ nodes: [] }])
      if (Array.isArray(cfg.flows)) {
        cfg.flows.forEach((fl, idx) => {
          if (!fl || isDisabledFlag(fl.disabled)) return;
          const flKey = String(fl.id || fl.name || `flow_${idx}`);
          if (Array.isArray(fl.nodes)) {
            fl.nodes.forEach((n) => collect(n, flKey));
          }
        });
      }

      // Update cachedMtime ONLY after JSON parsing and node extraction succeeds
      cachedMtime = stat.mtimeMs;
      cachedNodes = nodes;
      return cachedNodes;
    } catch (_) {
      return cachedNodes;
    }
  }

  function parseTimezoneOffset(tz) {
    if (!tz || typeof tz !== "string") return 0;
    const match = tz.trim().match(/^UTC([+-])(\d{1,2}):?(\d{2})?$/i);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10) || 0;
    const mins = parseInt(match[3] || "0", 10) || 0;
    return sign * (hours * 60 + mins);
  }

  function getZonedParts(utcDate, offsetMinutes) {
    const targetMs = utcDate.getTime() + offsetMinutes * 60000;
    const d = new Date(targetMs);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const dom = d.getUTCDate();
    const rawDow = d.getUTCDay();
    const dow = rawDow === 0 ? 1 : rawDow + 1;
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    const second = d.getUTCSeconds();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
      year,
      month,
      dom,
      rawDow,
      dow,
      hour,
      minute,
      second,
      daysInMonth
    };
  }

  function matchNumericOrStep(token, val, min, max) {
    if (token === "*" || token === "?") return true;
    const parts = token.split(",");
    for (const part of parts) {
      if (part.includes("/")) {
        const [rangePart, stepStr] = part.split("/");
        const step = parseInt(stepStr, 10);
        if (isNaN(step) || step <= 0) continue;
        let start = min;
        let end = max;
        if (rangePart && rangePart !== "*") {
          if (rangePart.includes("-")) {
            const [r1, r2] = rangePart.split("-").map(Number);
            start = r1;
            end = r2;
          } else {
            start = parseInt(rangePart, 10);
          }
        }
        if (val >= start && val <= end && (val - start) % step === 0) return true;
      } else if (part.includes("-")) {
        const [r1, r2] = part.split("-").map(Number);
        if (val >= r1 && val <= r2) return true;
      } else {
        if (parseInt(part, 10) === val) return true;
      }
    }
    return false;
  }

  function matchMonths(token, month) {
    if (token === "*" || token === "?") return true;
    let normalized = token.toUpperCase();
    for (const [name, num] of Object.entries(MONTH_NAMES)) {
      if (isNaN(Number(num))) continue;
      normalized = normalized.replace(new RegExp(`\\b${name}\\b`, "g"), String(num));
    }
    return matchNumericOrStep(normalized, month, 1, 12);
  }

  function matchDayOfMonth(token, zoned) {
    if (token === "*" || token === "?") return true;
    const { dom, year, month, daysInMonth } = zoned;
    const parts = token.split(",");

    for (const rawPart of parts) {
      const part = rawPart.trim().toUpperCase();

      if (part === "L") {
        if (dom === daysInMonth) return true;
        continue;
      }

      if (part === "LW") {
        let lastWd = daysInMonth;
        const lastDate = new Date(Date.UTC(year, month - 1, daysInMonth));
        const lastDayDow = lastDate.getUTCDay();
        if (lastDayDow === 6) {
          lastWd = daysInMonth - 1;
        } else if (lastDayDow === 0) {
          lastWd = daysInMonth - 2;
        }
        if (dom === lastWd) return true;
        continue;
      }

      if (part.startsWith("L-")) {
        const offset = parseInt(part.slice(2), 10);
        if (!isNaN(offset) && dom === daysInMonth - offset) return true;
        continue;
      }

      if (part.endsWith("W")) {
        const nStr = part.slice(0, -1);
        const targetDay = parseInt(nStr, 10);
        if (!isNaN(targetDay) && targetDay >= 1 && targetDay <= daysInMonth) {
          const targetDate = new Date(Date.UTC(year, month - 1, targetDay));
          const targetDow = targetDate.getUTCDay();
          let nearest = targetDay;
          if (targetDow === 6) {
            nearest = targetDay === 1 ? 3 : targetDay - 1;
          } else if (targetDow === 0) {
            nearest = targetDay === daysInMonth ? targetDay - 2 : targetDay + 1;
          }
          if (dom === nearest) return true;
        }
        continue;
      }

      if (matchNumericOrStep(part, dom, 1, 31)) return true;
    }
    return false;
  }

  function matchDayOfWeek(token, zoned, isQuartz) {
    if (token === "*" || token === "?") return true;
    const { dom, rawDow, dow, daysInMonth } = zoned;
    const parts = token.split(",");

    for (const rawPart of parts) {
      let part = rawPart.trim().toUpperCase();

      if (part === "L") {
        if (isQuartz ? dow === 7 : rawDow === 6) return true;
        continue;
      }

      if (part.endsWith("L")) {
        let dStr = part.slice(0, -1);
        for (const [name, num] of Object.entries(isQuartz ? DOW_QUARTZ : DOW_UNIX)) {
          if (dStr === name) {
            dStr = String(num);
            break;
          }
        }
        const targetDow = parseInt(dStr, 10);
        const currentDow = isQuartz ? dow : rawDow;
        const dowMatches = currentDow === targetDow || (!isQuartz && targetDow === 7 && currentDow === 0);
        if (dowMatches && dom + 7 > daysInMonth) {
          return true;
        }
        continue;
      }

      if (part.includes("#")) {
        const [dPart, nPart] = part.split("#");
        let dStr = dPart;
        for (const [name, num] of Object.entries(isQuartz ? DOW_QUARTZ : DOW_UNIX)) {
          if (dStr === name) {
            dStr = String(num);
            break;
          }
        }
        const targetDow = parseInt(dStr, 10);
        const n = parseInt(nPart, 10);
        const currentDow = isQuartz ? dow : rawDow;
        const dowMatches = currentDow === targetDow || (!isQuartz && targetDow === 7 && currentDow === 0);
        if (dowMatches) {
          const occurrence = Math.floor((dom - 1) / 7) + 1;
          if (occurrence === n) return true;
        }
        continue;
      }

      for (const [name, num] of Object.entries(isQuartz ? DOW_QUARTZ : DOW_UNIX)) {
        part = part.replace(new RegExp(`\\b${name}\\b`, "g"), String(num));
      }

      if (isQuartz) {
        if (matchNumericOrStep(part, dow, 1, 7)) return true;
      } else {
        if (matchNumericOrStep(part, rawDow, 0, 7)) return true;
        if (rawDow === 0 && matchNumericOrStep(part, 7, 0, 7)) return true;
      }
    }
    return false;
  }

  function checkScheduleMatch(expression, date, timezone) {
    if (!expression || typeof expression !== "string") return false;
    const tokens = expression.trim().split(/\s+/);
    if (tokens.length < 5 || tokens.length > 7) return false;

    const offsetMinutes = parseTimezoneOffset(timezone);
    const zoned = getZonedParts(date, offsetMinutes);

    let secToken, minToken, hrToken, domToken, monToken, dowToken, yrToken;
    let isQuartz = false;

    if (tokens.length === 5) {
      secToken = "0";
      [minToken, hrToken, domToken, monToken, dowToken] = tokens;
      yrToken = "*";
      isQuartz = false;
    } else if (tokens.length === 6) {
      [secToken, minToken, hrToken, domToken, monToken, dowToken] = tokens;
      yrToken = "*";
      isQuartz = true;
    } else {
      [secToken, minToken, hrToken, domToken, monToken, dowToken, yrToken] = tokens;
      isQuartz = true;
    }

    if (!matchNumericOrStep(secToken, zoned.second, 0, 59)) return false;
    if (!matchNumericOrStep(minToken, zoned.minute, 0, 59)) return false;
    if (!matchNumericOrStep(hrToken, zoned.hour, 0, 23)) return false;
    if (!matchMonths(monToken, zoned.month)) return false;
    if (!matchNumericOrStep(yrToken, zoned.year, 1970, 2099)) return false;

    const domIsQuestion = domToken === "?";
    const dowIsQuestion = dowToken === "?";

    if (domIsQuestion && dowIsQuestion) return true;
    if (domIsQuestion) return matchDayOfWeek(dowToken, zoned, isQuartz);
    if (dowIsQuestion) return matchDayOfMonth(domToken, zoned);

    if (isQuartz) {
      return matchDayOfMonth(domToken, zoned) && matchDayOfWeek(dowToken, zoned, true);
    } else {
      const domIsStar = domToken === "*";
      const dowIsStar = dowToken === "*";
      if (domIsStar && dowIsStar) return true;
      if (domIsStar) return matchDayOfWeek(dowToken, zoned, false);
      if (dowIsStar) return matchDayOfMonth(domToken, zoned);
      return matchDayOfMonth(domToken, zoned) || matchDayOfWeek(dowToken, zoned, false);
    }
  }

  async function waitForClientReady(client, maxWaitMs = 15000) {
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

      const readyEvent = (typeof Events !== "undefined" && Events && Events.ClientReady)
        ? Events.ClientReady
        : "clientReady";

      if (typeof client.once === "function") {
        client.once(readyEvent, onReady);
      } else {
        setTimeout(onReady, 1000);
      }
    });
  }

  function canBotSendInChannel(channel, client) {
    if (!channel || typeof channel.send !== "function") return false;
    const isText = (typeof channel.isTextBased === "function" && channel.isTextBased()) ||
      channel.type === 0 ||
      channel.type === "GUILD_TEXT";
    if (!isText) return false;

    // In guild channels, verify the bot actually has ViewChannel and SendMessages permissions
    if (channel.guild && client?.user) {
      try {
        if (typeof channel.permissionsFor === "function") {
          const perms = channel.permissionsFor(client.user);
          if (perms && typeof perms.has === "function") {
            const canView = perms.has("ViewChannel") || perms.has(1024n) || perms.has(1024);
            const canSend = perms.has("SendMessages") || perms.has(2048n) || perms.has(2048);
            if (!canView || !canSend) return false;
          }
        }
      } catch (_) {}
    }
    return true;
  }

  async function resolveBestGuildAndChannel(botClient, node = null) {
    if (!botClient) return { guild: null, channel: null };

    // If client is still logging in, wait up to 15s for ready state so large multi-guild bots populate
    await waitForClientReady(botClient, 15000);

    let targetGuild = null;
    let targetChannel = null;

    // A. Check if the node configured an explicit channel ID
    const explicitChannelId = String(
      node?.properties?.targetChannelId ||
      node?.properties?.channelId ||
      ""
    ).trim();

    if (explicitChannelId) {
      targetChannel = botClient.channels?.cache?.get(explicitChannelId) || null;
      if (!targetChannel && typeof botClient.channels?.fetch === "function") {
        try {
          targetChannel = await botClient.channels.fetch(explicitChannelId);
        } catch (_) {}
      }
      if (targetChannel) {
        return { guild: targetChannel.guild || null, channel: targetChannel };
      }
    }

    // B. Search botClient.channels.cache directly across all guilds for a channel the bot can actually send in
    if (botClient.channels?.cache?.size) {
      targetChannel = botClient.channels.cache.find(
        (c) => canBotSendInChannel(c, botClient)
      ) || null;
      if (targetChannel && targetChannel.guild) {
        targetGuild = targetChannel.guild;
      }
    }

    // C. Iterate through all cached guilds if not found
    if (!targetChannel && botClient.guilds?.cache?.size) {
      for (const guild of botClient.guilds.cache.values()) {
        if (!guild) continue;
        if (guild.channels?.cache?.size) {
          const ch = guild.channels.cache.find(
            (c) => canBotSendInChannel(c, botClient)
          );
          if (ch) {
            targetGuild = guild;
            targetChannel = ch;
            break;
          }
        }
      }
    }

    // D. If channels cache is empty, attempt to fetch channels for available guilds
    if (!targetChannel && botClient.guilds?.cache?.size) {
      for (const guild of botClient.guilds.cache.values()) {
        if (!guild) continue;
        if (typeof guild.channels?.fetch === "function") {
          try {
            const fetched = await guild.channels.fetch();
            if (fetched && fetched.size) {
              const ch = fetched.find(
                (c) => canBotSendInChannel(c, botClient)
              );
              if (ch) {
                targetGuild = guild;
                targetChannel = ch;
                break;
              }
            }
          } catch (_) {}
        }
      }
    }

    // E. Fallback: Any text-based channel if permission check was strict
    if (!targetChannel && botClient.channels?.cache?.size) {
      targetChannel = botClient.channels.cache.find(
        (c) => c && typeof c.send === "function" && ((c.isTextBased?.()) || c.type === 0 || c.type === "GUILD_TEXT")
      ) || null;
      if (targetChannel && targetChannel.guild) {
        targetGuild = targetChannel.guild;
      }
    }

    if (!targetGuild && botClient.guilds?.cache?.size) {
      targetGuild = botClient.guilds.cache.first() || null;
    }

    return { guild: targetGuild, channel: targetChannel };
  }

  async function triggerNodeFlow(node, reason = "schedule") {
    const flowRunner = resolveFlowRunner();
    const botClient = resolveDiscordClient();
    if (!flowRunner) return false;

    const originalId = String(node.id ?? "").trim();
    const runtimeId = String(node.__runtimeId || originalId).trim();
    const uniqueKey = String(node.__uniqueId || runtimeId || originalId);
    const currentRun = (runCountMap.get(uniqueKey) || 0) + 1;
    runCountMap.set(uniqueKey, currentRun);

    const expr = String(node.properties?.cronExpression || "0 0 * * *").trim();
    const partsCount = expr.split(/\s+/).length;
    const tz = String(node.properties?.timezone || "UTC+00:00").trim();
    const desc = describeCronExpression(expr, tz);

    // Set nodeId to runtimeId (e.g. '605') so DBF's compiled multi-tab condition matches,
    // and also expose runtimeId and originalId (e.g. '761') for full compatibility.
    const payload = {
      nodeId: runtimeId,
      runtimeId,
      originalId,
      tabId: String(node.__tabKey || ""),
      cronExpression: expr,
      isQuartz: partsCount >= 6,
      timezone: tz,
      timezoneAbbr: desc.timezoneAbbr,
      frequency: desc.frequency,
      timestamp: new Date().toISOString(),
      runCount: currentRun,
      run_count: currentRun,
      count: currentRun,
      reason
    };

    if (toBool(node.properties?.logToConsole)) {
      console.log(`[CronScheduler] Triggered schedule for node "${originalId}" (runtimeId: "${runtimeId}") - ${desc.frequency} [${desc.timezoneAbbr}] (Reason: ${reason}, Run #${currentRun})`);
    }

    const { guild: targetGuild, channel: targetChannel } = await resolveBestGuildAndChannel(botClient, node);

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
        console.warn(`[CronScheduler:ChannelSend] ${text}`);
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

    const stub = {
      id: `cron_${runtimeId}_${Date.now()}`,
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
      __eventType: "cronTrigger",
      __eventPayload: payload
    };

    try {
      await flowRunner(stub, "cronTrigger", payload);
      return true;
    } catch (err) {
      console.error(`[CronScheduler] Error executing downstream flow for node "${originalId}" (runtimeId: "${runtimeId}"):`, err?.stack || err?.message || err);
      return false;
    }
  }

  async function evaluateTick() {
    const now = new Date();
    const activeNodes = getActiveCronNodes();
    if (!activeNodes.length) return;

    const nowMs = now.getTime();
    for (const [key, timestamp] of executedKeys.entries()) {
      if (nowMs - timestamp > 120000) {
        executedKeys.delete(key);
      }
    }

    for (const node of activeNodes) {
      const expr = String(node.properties?.cronExpression || "0 0 * * *").trim();
      const tz = String(node.properties?.timezone || "UTC+00:00").trim();
      const tokens = expr.split(/\s+/);
      const hasSeconds = tokens.length >= 6;

      const offsetMinutes = parseTimezoneOffset(tz);
      const zoned = getZonedParts(now, offsetMinutes);

      const uniqueKey = node.__uniqueId || node.id;
      let dedupKey;
      if (hasSeconds) {
        dedupKey = `${uniqueKey}:${zoned.year}-${zoned.month}-${zoned.dom}-${zoned.hour}-${zoned.minute}-${zoned.second}`;
      } else {
        dedupKey = `${uniqueKey}:${zoned.year}-${zoned.month}-${zoned.dom}-${zoned.hour}-${zoned.minute}`;
      }

      if (executedKeys.has(dedupKey)) continue;

      if (checkScheduleMatch(expr, now, tz)) {
        executedKeys.set(dedupKey, nowMs);
        triggerNodeFlow(node, "schedule").catch((err) => {
          console.error(`[CronScheduler] Unhandled error during scheduled execution:`, err?.stack || err?.message || err);
        });
      }
    }
  }

  function triggerStartupNodes() {
    if (startupDispatched) return;
    startupDispatched = true;

    const activeNodes = getActiveCronNodes();
    for (const node of activeNodes) {
      if (toBool(node.properties?.runOnStartup)) {
        triggerNodeFlow(node, "startup").catch((err) => {
          console.error(`[CronScheduler] Unhandled error during startup trigger:`, err?.stack || err?.message || err);
        });
      }
    }
  }

  let readyListenerAttached = false;

  function setupStartupHook() {
    if (startupDispatched) return;

    const botClient = resolveDiscordClient();
    if (!botClient) return;

    const readyEvent = (typeof Events !== "undefined" && Events && Events.ClientReady)
      ? Events.ClientReady
      : "clientReady";

    if (botClient.isReady && typeof botClient.isReady === "function" && botClient.isReady()) {
      triggerStartupNodes();
      return;
    }

    if (!readyListenerAttached && typeof botClient.once === "function") {
      readyListenerAttached = true;
      botClient.once(readyEvent, () => {
        triggerStartupNodes();
      });
      // Fallback timeout in case ready was already emitted
      setTimeout(() => {
        if (!startupDispatched && (botClient.isReady?.() || botClient.user)) {
          triggerStartupNodes();
        }
      }, 6000);
      return;
    }

    if (botClient.user) {
      triggerStartupNodes();
    }
  }

  function startSchedulerLoop() {
    setupStartupHook();

    const now = Date.now();
    const delayToNextSecond = 1000 - (now % 1000);

    setTimeout(() => {
      evaluateTick().catch(() => {});
      setInterval(() => {
        setupStartupHook();
        evaluateTick().catch(() => {});
      }, 1000);
    }, delayToNextSecond);
  }

  startSchedulerLoop();
  console.log(`[CronScheduler] Background scheduler initialized successfully.`);
})();
