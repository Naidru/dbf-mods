// ============================================================================
// DBF Cron Trigger Mod - Canvas Starter Node
// ============================================================================
// Registers the "When Cron Schedule Triggers" starter node in Discord Bot Factory.
// ============================================================================

const TIMEZONE_OPTIONS = [
  { label: "UTC-12:00 (IDLW)", value: "UTC-12:00 (IDLW)" },
  { label: "UTC-11:00 (SST)", value: "UTC-11:00 (SST)" },
  { label: "UTC-10:00 (HST)", value: "UTC-10:00 (HST)" },
  { label: "UTC-09:30 (MIT)", value: "UTC-09:30 (MIT)" },
  { label: "UTC-09:00 (AKST)", value: "UTC-09:00 (AKST)" },
  { label: "UTC-08:00 (PST)", value: "UTC-08:00 (PST)" },
  { label: "UTC-07:00 (MST / PDT)", value: "UTC-07:00 (MST / PDT)" },
  { label: "UTC-06:00 (CST / MDT)", value: "UTC-06:00 (CST / MDT)" },
  { label: "UTC-05:00 (EST / CDT)", value: "UTC-05:00 (EST / CDT)" },
  { label: "UTC-04:00 (AST / EDT)", value: "UTC-04:00 (AST / EDT)" },
  { label: "UTC-03:30 (NST)", value: "UTC-03:30 (NST)" },
  { label: "UTC-03:00 (BRT / ADT)", value: "UTC-03:00 (BRT / ADT)" },
  { label: "UTC-02:00 (GST)", value: "UTC-02:00 (GST)" },
  { label: "UTC-01:00 (CVT)", value: "UTC-01:00 (CVT)" },
  { label: "UTC+00:00 (UTC / GMT)", value: "UTC+00:00 (UTC / GMT)" },
  { label: "UTC+01:00 (CET / BST)", value: "UTC+01:00 (CET / BST)" },
  { label: "UTC+02:00 (EET / CEST)", value: "UTC+02:00 (EET / CEST)" },
  { label: "UTC+03:00 (MSK / EEST)", value: "UTC+03:00 (MSK / EEST)" },
  { label: "UTC+03:30 (IRST)", value: "UTC+03:30 (IRST)" },
  { label: "UTC+04:00 (GST / AZT)", value: "UTC+04:00 (GST / AZT)" },
  { label: "UTC+04:30 (AFT)", value: "UTC+04:30 (AFT)" },
  { label: "UTC+05:00 (PKT)", value: "UTC+05:00 (PKT)" },
  { label: "UTC+05:30 (IST)", value: "UTC+05:30 (IST)" },
  { label: "UTC+05:45 (NPT)", value: "UTC+05:45 (NPT)" },
  { label: "UTC+06:00 (BST / BTT)", value: "UTC+06:00 (BST / BTT)" },
  { label: "UTC+06:30 (MMT)", value: "UTC+06:30 (MMT)" },
  { label: "UTC+07:00 (WIB / ICT)", value: "UTC+07:00 (WIB / ICT)" },
  { label: "UTC+08:00 (CST / SGT)", value: "UTC+08:00 (CST / SGT)" },
  { label: "UTC+08:45 (ACWST)", value: "UTC+08:45 (ACWST)" },
  { label: "UTC+09:00 (JST / KST)", value: "UTC+09:00 (JST / KST)" },
  { label: "UTC+09:30 (ACST)", value: "UTC+09:30 (ACST)" },
  { label: "UTC+10:00 (AEST)", value: "UTC+10:00 (AEST)" },
  { label: "UTC+10:30 (ACDT)", value: "UTC+10:30 (ACDT)" },
  { label: "UTC+11:00 (AEDT)", value: "UTC+11:00 (AEDT)" },
  { label: "UTC+12:00 (NZST)", value: "UTC+12:00 (NZST)" },
  { label: "UTC+12:45 (CHAST)", value: "UTC+12:45 (CHAST)" },
  { label: "UTC+13:00 (NZDT)", value: "UTC+13:00 (NZDT)" },
  { label: "UTC+14:00 (LINT)", value: "UTC+14:00 (LINT)" }
];

module.exports = function (DBFMod) {
  const nodeConfig = {
    type: "CronTrigger",
    aliases: [
      "Scheduling/CronTrigger",
      "Events/CronTrigger",
      "When Cron Schedule Triggers",
      "Cron Schedule",
      "Cron Trigger",
      "CronTrigger"
    ],
    title: "When Cron Schedule Triggers",
    color: "#8b5cf6",
    bgcolor: "#2e1065",
    size: [270, 110],
    description: "Runs connected actions automatically on a recurring CRON schedule.",
    inputs: [],
    outputs: [
      {
        name: "Trigger",
        type: "event"
      }
    ],
    properties: {
      cronExpression: "* * * * *",
      timezone: "UTC+00:00 (UTC / GMT)",
      runOnStartup: false,
      saveVar: ""
    },
    autoTitle(node) {
      const expr = String(node?.properties?.cronExpression || "* * * * *").trim();
      return `When CRON (${expr}) triggers`;
    },
    drawForeground(ctx) {
      const expr = String(this.properties?.cronExpression || "* * * * *").trim();
      const tz = String(this.properties?.timezone || "UTC+00:00 (UTC / GMT)").trim();

      // Header Badge
      ctx.fillStyle = "#c084fc";
      ctx.font = "bold 11px Inter, Lexend, system-ui, sans-serif";
      ctx.fillText("CRON SCHEDULE", 12, this.size[1] - 42);

      // Line 1: Expression
      ctx.fillStyle = typeof getNodeTextColor === "function" ? getNodeTextColor(this) : "#f8fafc";
      ctx.font = "bold 12px Inter, Lexend, system-ui, sans-serif";
      const displayExpr = expr.length > 28 ? expr.slice(0, 25) + "..." : expr;
      ctx.fillText(displayExpr, 12, this.size[1] - 25);

      // Line 2: Timezone and startup note
      ctx.fillStyle = "#e9d5ff";
      ctx.font = "11px Inter, Lexend, system-ui, sans-serif";
      const startupNote = this.properties?.runOnStartup ? " | On Start" : "";
      const subLine = tz + startupNote;
      const displaySub = subLine.length > 32 ? subLine.slice(0, 29) + "..." : subLine;
      ctx.fillText(displaySub, 12, this.size[1] - 10);
    },
    modalFields(node) {
      return [
        {
          label: "CRON Expression *",
          property: "cronExpression",
          value: node.properties.cronExpression || "* * * * *",
          type: "text",
          placeholder: "* * * * *",
          help: "5 fields separated by spaces: Minute (0-59), Hour (0-23), Day of Month (1-31), Month (1-12), Day of Week (0-6 Sun-Sat). Example: 0 0 * * * (daily at midnight)."
        },
        {
          label: "Timezone",
          property: "timezone",
          value: node.properties.timezone || "UTC+00:00 (UTC / GMT)",
          type: "select",
          options: TIMEZONE_OPTIONS,
          help: "UTC offset used to evaluate the CRON schedule."
        },
        {
          label: "Run Once on Bot Startup",
          property: "runOnStartup",
          value: !!node.properties.runOnStartup,
          type: "boolean",
          help: "Also run this flow once immediately when the bot boots up and logs into Discord."
        },
        {
          label: "Save Trigger Info to Variable (optional)",
          property: "saveVar",
          value: node.properties.saveVar,
          type: "variableSave",
          saveLabel: "the CRON trigger event",
          autoLabel: "cron_event",
          saveSchema: "cron_trigger"
        }
      ];
    },
    codegen: {
      role: "event",
      buildCondition(nodeData, ctx) {
        const id = String(nodeData?.id ?? "").trim();
        const idEsc = id.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const condition = `message.__eventType === 'cronTrigger' && message.__eventPayload?.nodeId === '${idEsc}'`;
        const label = String(nodeData?.properties?.cronExpression || "Cron Schedule").trim();
        if (typeof wrapSaveVarCondition === "function") {
          return wrapSaveVarCondition(
            condition,
            label,
            nodeData?.properties?.saveVar,
            `(message.__eventPayload || {})`,
            "cron_trigger"
          );
        }
        return { condition, label };
      }
    }
  };

  if (DBFMod && typeof DBFMod.registerEventNode === "function") {
    return DBFMod.registerEventNode(nodeConfig);
  }
  if (DBFMod && typeof DBFMod.registerNode === "function") {
    return DBFMod.registerNode("Discord Events", nodeConfig);
  }
  if (DBFMod && typeof DBFMod.registerActionNode === "function") {
    return DBFMod.registerActionNode("Discord Events", nodeConfig);
  }
};
