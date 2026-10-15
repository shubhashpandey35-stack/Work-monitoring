import { api, requireAuth, getToken, clearSession, avatarHtml, statusBadgeHtml, formatDateTime, timeAgo, mapLink, escapeHtml } from "./api.js";
import { formatTotal, liveTotalMs } from "./timeUtils.js";

const employees = new Map();
let search = "";
let filter = "all";
let socket;
const $ = (id) => document.getElementById(id);

// Save an employee and remember how far the server clock is from this browser's clock.
function store(u) {
  u._clockOffset = (u.serverTime || Date.now()) - Date.now();
  employees.set(u.id, u);
}

async function init() {
  const me = requireAuth("admin");
  if (!me) return;
  $("adminName").textContent = me.name || "Administrator";
  $("logoutBtn").addEventListener("click", logout);
  $("searchInput").addEventListener("input", (e) => { search = e.target.value.trim().toLowerCase(); render(); });
  $("statusFilter").addEventListener("change", (e) => { filter = e.target.value; render(); });
  $("refreshBtn")?.addEventListener("click", refreshAll);
  $("sessionsRefreshBtn")?.addEventListener("click", loadSessions);
  await refreshEmployees();
  await loadSessions();
  connectSocket();
  setInterval(() => { render(); loadSessions(); }, 30000);
  setInterval(tickTimes, 1000); // time totals count up live
}

async function refreshAll() { await refreshEmployees(); await loadSessions(); }
async function refreshEmployees() {
  try {
    const data = await api("/api/users");
    employees.clear();
    data.users.forEach(store);
    render();
  } catch (err) {
    $("emptyState").textContent = err.message;
    $("emptyState").classList.remove("hidden");
  }
}

function connectSocket() {
  if (typeof io !== "function") { setConn(false); return; }
  socket = io({ auth: { token: getToken() }, reconnectionDelayMax: 5000 });
  socket.on("connect", async () => { setConn(true); await refreshEmployees(); });
  socket.on("disconnect", (reason) => {
    setConn(false);
    if (reason === "io server disconnect") { clearSession(); location.replace("login.html"); }
  });
  socket.on("connect_error", (err) => {
    setConn(false);
    if (err.message === "Unauthorized") { clearSession(); location.replace("login.html?expired=1"); }
  });
  socket.on("status:changed", (u) => { store(u); render(); });
  socket.on("user:created", (u) => { store(u); render(); });
}

function setConn(on) {
  const el = $("connBadge");
  el.className = `conn ${on ? "conn-on" : "conn-off"}`;
  el.innerHTML = `<span class="conn-dot"></span>${on ? "Live: connected" : "Reconnecting…"}`;
}

function render() {
  const all = [...employees.values()];
  const count = (s) => all.filter((e) => e.status === s).length;
  $("totalCount").textContent = all.length;
  $("onlineCount").textContent = count("online");
  $("inactiveCount").textContent = count("inactive");
  $("offlineCount").textContent = count("offline");
  $("navEmployeeCount").textContent = all.length;
  const list = all.filter((e) => filter === "all" || e.status === filter)
    .filter((e) => !search || e.name.toLowerCase().includes(search) || e.email.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));
  $("empGrid").innerHTML = list.map(cardHtml).join("");
  $("emptyState").textContent = all.length ? "No employees match your search." : "No employees have registered yet.";
  $("emptyState").classList.toggle("hidden", list.length > 0);
  tickTimes();
}

// Updates only the three time numbers on each card (no full re-render every second).
function tickTimes() {
  document.querySelectorAll("[data-t]").forEach((el) => {
    const u = employees.get(el.dataset.id);
    if (!u) return;
    el.textContent = formatTotal(liveTotalMs(u, el.dataset.t, Date.now(), u._clockOffset));
  });
}

function cardHtml(e) {
  const loc = e.location
    ? `<a href="${escapeHtml(mapLink(e.location))}" target="_blank" rel="noopener noreferrer">${e.location.latitude.toFixed(4)}, ${e.location.longitude.toFixed(4)} · Map ↗</a>`
    : `<span class="muted">${e.locationConsent ? "Waiting for location update" : "Not shared"}</span>`;
  return `<article class="emp-card"><div class="emp-head">${avatarHtml(e, "sm")}<div><div class="name">${escapeHtml(e.name)}</div><div class="email">${escapeHtml(e.email)}</div></div></div><div class="row"><span>Status</span><span>${statusBadgeHtml(e.status)}</span></div><div class="row"><span>Location</span><span>${loc}</span></div><div class="row"><span>Last activity</span><span title="${escapeHtml(formatDateTime(e.lastActivity))}">${escapeHtml(timeAgo(e.lastActivity))}</span></div><div class="row"><span>Status updated</span><span title="${escapeHtml(formatDateTime(e.statusUpdatedAt))}">${escapeHtml(timeAgo(e.statusUpdatedAt))}</span></div>${timeRowsHtml(e)}</article>`;
}

function timeRowsHtml(e) {
  const id = escapeHtml(e.id);
  const row = (key, label) => `<div class="row time-row time-${key}"><span>${label}</span><span class="time-val" data-t="${key}" data-id="${id}">—</span></div>`;
  return `<div class="time-block"><div class="time-title">Total time since tracking began</div>${row("online", "Online")}${row("inactive", "Inactive")}${row("offline", "Offline")}</div>`;
}

async function loadSessions() {
  const body = $("sessionsBody");
  if (!body) return;
  try {
    const data = await api("/api/users/sessions?limit=100");
    const sessions = data.sessions || [];
    if (!sessions.length) { body.innerHTML = '<tr><td colspan="5" class="table-empty">No work sessions recorded yet. Sessions appear when employees connect to their dashboard.</td></tr>'; return; }
    body.innerHTML = sessions.map((s) => `<tr><td><div class="session-person"><strong>${escapeHtml(s.name)}</strong><small>${escapeHtml(s.email)}</small></div></td><td>${escapeHtml(formatDateTime(s.startedAt))}</td><td>${s.endedAt ? escapeHtml(formatDateTime(s.endedAt)) : "—"}</td><td><strong>${escapeHtml(formatDuration(s.durationSeconds))}</strong></td><td><span class="session-status ${s.active ? "" : "ended"}">${s.active ? "In progress" : escapeHtml(sessionEndLabel(s.endReason))}</span></td></tr>`).join("");
  } catch (err) { body.innerHTML = `<tr><td colspan="5" class="table-empty">${escapeHtml(err.message || "Could not load session history")}</td></tr>`; }
}
function formatDuration(seconds = 0) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
function sessionEndLabel(reason) { return ({ logout: "Logged out", disconnect: "Disconnected", "server-restart": "Server restart", active: "Ended" })[reason] || "Ended"; }

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch { /* still clear the local session */ }
  socket?.disconnect();
  clearSession();
  location.replace("login.html");
}
init();
