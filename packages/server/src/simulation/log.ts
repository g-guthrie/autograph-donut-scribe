export function logEvent(level: "info" | "warn" | "error", subsystem: string, event: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    ts: Date.now(),
    level,
    subsystem,
    event,
    ...details
  }));
}
