# Cron & Quartz Schedule Trigger (`cron-scheduler`)

A clean-room starter event node for **Discord Bot Factory (DBF)** that initiates bot flows automatically on recurring time schedules. Supports both standard **5-part UNIX CRON** and **6/7-part Quartz CRON** expressions with exact UTC timezone offset precision and zero external npm package dependencies.

---

## Features

- **Dual Schedule Syntax**:
  - **UNIX CRON (5 fields)**: `minute hour day-of-month month day-of-week`
  - **Quartz CRON (6 or 7 fields)**: `second minute hour day-of-month month day-of-week [year]`
- **Full Quartz Modifier Support**:
  - `?`: Disregard day field when the other day field is specified.
  - `L`: Last day of the month or last weekday (`6L`).
  - `LW`: Last weekday (Mon–Fri) of the month.
  - `L-N`: $N$ days before the last day of the month (e.g. `L-3`).
  - `W`: Nearest weekday to the specified day (e.g. `15W`).
  - `#`: $N$-th occurrence of a weekday in the month (e.g. `FRI#3` for the 3rd Friday).
  - Steps (`/`), ranges (`-`), comma-separated lists (`,`), month names (`JAN`–`DEC`), and day names (`SUN`–`SAT`).
- **Complete Timezone Precision**:
  - Audited coverage of all **38 UTC offsets** from `UTC-12:00` to `UTC+14:00`.
  - Concise standard and daylight abbreviations (e.g. `UTC-04:00 (EDT / AST)`, `UTC-05:00 (EST / CDT)`, `UTC-08:00 (PST / AKDT)`).
- **Real-Time Live Expression Validator**:
  - Live syntax check and natural-language frequency description displayed directly below the expression input as you type.
  - Responsive column layout that protects the input field from shrinking or cutting off.
- **Node Canvas 2D Badge**:
  - Visual status rendered directly on the node on the canvas: expression, validity check, natural frequency, timezone, and badges (`[+Startup]`, `[+Log]`).
- **Run Once on Bot Startup**:
  - Optional toggle to trigger the flow immediately once the bot logs into Discord (`clientReady`). Disabled by default.
- **Console Execution Logging**:
  - Optional toggle to output execution confirmations into the bot console whenever a schedule fires. Disabled by default.
- **Trigger Variable & Sub-Variable Autocomplete**:
  - Saves trigger details into a local or global variable (default: `cron_trigger_info`).
  - Full editor autocomplete popup support when typing `{cron_trigger_info.` (or custom variable name):
    - `{cron_trigger_info.runCount}` — Total trigger count since startup.
    - `{cron_trigger_info.timestamp}` — ISO-8601 trigger timestamp.
    - `{cron_trigger_info.reason}` — Reason for trigger (`schedule` or `startup`).
    - `{cron_trigger_info.frequency}` — Human-readable schedule description.
    - `{cron_trigger_info.timezoneAbbr}` — Short timezone abbreviation.
    - `{cron_trigger_info.timezone}` — Configured UTC offset string.
    - `{cron_trigger_info.cronExpression}` — Raw CRON expression.
    - `{cron_trigger_info.isQuartz}` — Boolean (`true` for Quartz, `false` for UNIX).
    - `{cron_trigger_info.nodeId}` — Node ID that fired.

---

## Node Configuration

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **CRON / Quartz Expression** | Text | `0 0 * * *` | 5-part UNIX or 6/7-part Quartz expression. |
| **Timezone** | Select | `UTC+00:00` | Target UTC offset evaluated against bot system time. |
| **Run Once on Bot Startup** | Boolean | `false` | When enabled, runs immediately when the bot starts. |
| **Log Schedule Execution to Console** | Boolean | `false` | When enabled, logs trigger confirmations to the console. |
| **Save Trigger Info to Variable** | Variable Save | `cron_trigger_info` | Stores trigger metadata object and enables `{var.field}` sub-variable access. |

---

## Expression Cheat Sheet

### UNIX CRON (5 Fields)
`minute hour day-of-month month day-of-week`

| Expression | Description |
| :--- | :--- |
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour on the hour |
| `0 0 * * *` | Daily at midnight (00:00) |
| `0 9 * * 1-5` | Every weekday (Mon–Fri) at 09:00 |
| `0 12 * * 0,6` | Every weekend (Sat–Sun) at 12:00 |
| `0 0 1 * *` | First day of every month at midnight |

### Quartz CRON (6 or 7 Fields)
`second minute hour day-of-month month day-of-week [year]`

| Expression | Description |
| :--- | :--- |
| `*/10 * * * * ?` | Every 10 seconds |
| `0 0 12 ? * WED` | Every Wednesday at 12:00 |
| `0 0 12 ? * FRI#3` | On the 3rd Friday of the month at 12:00 |
| `0 0 0 L * ?` | On the last day of the month at midnight |
| `0 0 0 LW * ?` | On the last weekday of the month at midnight |
| `0 0 18 ? * 6L` | On the last Friday of the month at 18:00 |
| `0 0 12 15W * ?` | On the nearest weekday to the 15th at 12:00 |
| `0 0 0 L-3 * ?` | 3 days before the end of the month at midnight |

---

## Variable Reference

When saving to `cron_trigger_info`, use either the whole object or any sub-variable in messages and embeds:

| Variable | Type | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `{cron_trigger_info.runCount}` | Number | `42` | Total number of executions since bot started. |
| `{cron_trigger_info.timestamp}` | String | `2026-10-21T15:30:00.000Z` | Trigger execution timestamp. |
| `{cron_trigger_info.reason}` | String | `schedule` | Either `schedule` (cron hit) or `startup` (boot run). |
| `{cron_trigger_info.frequency}` | String | `Every Monday at 00:00` | Human-readable schedule description. |
| `{cron_trigger_info.timezoneAbbr}`| String | `EDT / AST (UTC-4)` | Configured timezone abbreviation. |
| `{cron_trigger_info.timezone}` | String | `UTC-04:00` | Full UTC offset string. |
| `{cron_trigger_info.cronExpression}`| String | `0 0 12 ? * WED` | The configured CRON expression. |
| `{cron_trigger_info.isQuartz}` | Boolean | `true` | Whether the expression uses Quartz syntax. |
| `{cron_trigger_info.nodeId}` | String | `node_42` | Unique canvas node identifier. |

---

## Directory Structure

```text
mods/cron-scheduler/
├── dbf.mod.json        # Mod manifest (id, author, nodes, runtime)
├── nodes/
│   └── CronTrigger.js  # Editor canvas node, live validator, & autocomplete enhancer
├── runtime.js          # Node.js background scheduler engine & clientReady dispatcher
└── README.md           # Documentation & cheat sheet
```

---

## Technical Details

- **Clean-Room Implementation**: Built using standard JavaScript and Node.js built-ins (`fs`, `path`, `crypto`). Zero external dependencies.
- **Discord.js v14/v15 Compatibility**: Dispatches via `Events.ClientReady || 'clientReady'` (with fallback to `'ready'`) to eliminate deprecation warnings.
- **Multi-Tab Flow Discovery**: Dynamically scans both single-flow and multi-tab configurations (`bot.config.json`) with hot-reload detection.
- **Sub-Second Tick Accuracy**: Scheduler engine synchronizes against the system clock once per second with minute-level execution de-duplication.

---

## Author

Developed by **Naidru** for Discord Bot Factory.
