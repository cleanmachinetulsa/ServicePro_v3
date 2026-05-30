# Memory Index

- [Background processes get reaped](background-process-reaping.md) — `nohup … &` dies between bash tool calls; long scripts must run in ONE blocking call.
- [Business-owned phone lines are not customers](business-phone-lines.md) — Clean Machine's own Twilio lines send inter-line/alert traffic that looks "inbound"; imports/analytics must exclude them.
- [Drizzle onConflict composite key](drizzle-onconflict-composite.md) — ON CONFLICT must list ALL columns of the real unique constraint or every insert throws; verify via `\d`, not schema.ts.
