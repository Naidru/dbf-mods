# CRON Schedule Trigger Node for Discord Bot Factory

A starter node for Discord Bot Factory (DBF) that triggers flows automatically based on recurring CRON schedules.

Place it on the canvas (like "When a message is sent" or "When the bot starts"), connect your actions, and it executes whenever the schedule triggers.

## How to Use

1. In Discord Bot Factory, open your bot project.
2. In the node catalog, go to Discord Events or search for "Cron".
3. Place "When Cron Schedule Triggers" on the canvas.
4. Enter your 5-field CRON expression and choose your UTC-based timezone.
5. Connect the node's Trigger pin to whatever actions you want to run (e.g. Send Message, Database Query, Custom Code).
6. Run your bot.

## CRON Expression Format

5 fields separated by spaces:
- Minute (0 - 59)
- Hour (0 - 23)
- Day of Month (1 - 31)
- Month (1 - 12)
- Day of Week (0 - 6, Sun - Sat)

Examples:
- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Hourly at minute 0
- `0 0 * * *` - Daily at midnight
- `0 9 * * 1-5` - Monday to Friday at 9:00 AM
