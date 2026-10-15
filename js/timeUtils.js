// Pure helpers for the Online / Inactive / Offline time totals (no DOM, easy to test).

// "2d 3h 05m", "3h 05m 09s", "4m 09s", "9s"
export function formatTotal(ms = 0) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n) => String(n).padStart(2, "0");
  if (d) return `${d}d ${h}h ${two(m)}m`;
  if (h) return `${h}h ${two(m)}m ${two(s)}s`;
  if (m) return `${m}m ${two(s)}s`;
  return `${s}s`;
}

// Live total for one status:
//   saved total of finished segments + (if this IS the current status) time since it began.
// clockOffsetMs = serverTime - browserTimeWhenReceived, fixes a wrong clock on this computer.
export function liveTotalMs(user, key, nowMs = Date.now(), clockOffsetMs = 0) {
  let total = Number(user?.timeTotalsMs?.[key]) || 0;
  if (user?.status === key && user.statusSince) {
    total += Math.max(0, nowMs + clockOffsetMs - new Date(user.statusSince).getTime());
  }
  return total;
}
