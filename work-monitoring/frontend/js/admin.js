import { api, requireAuth, getToken, clearSession, avatarHtml, statusBadgeHtml,
  formatDateTime, timeAgo, mapLink, escapeHtml } from "./api.js";

const employees = new Map(); // id -> employee object (kept in sync via Socket.IO)
let search = "";
let filter = "all";
let socket;

const $ = (id) => document.getElementById(id);

async function init() {
  const me = requireAuth("admin");
  if (!me) return;
  $("adminName").textContent = me.name;

  try {
    const data = await api("/api/users"); // server also checks that we are an admin
    data.users.forEach((u) => employees.set(u.id, u));
  } catch (err) {
    $("emptyState").textContent = err.message;
    $("emptyState").classList.remove("hidden");
    return;
  }

  $("searchInput").addEventListener("input", (e) => { search = e.target.value.trim().toLowerCase(); render(); });
  $("statusFilter").addEventListener("change", (e) => { filter = e.target.value; render(); });
  $("logoutBtn").addEventListener("click", logout);

  render();
  connectSocket();
  setInterval(render, 30000); // refresh "x min ago" labels
}

function connectSocket() {
  socket = io({ auth: { token: getToken() }, reconnectionDelayMax: 5000 });

  socket.on("connect", async () => {
    setConn(true);
    // After a reconnect we may have missed events -> reload the full list once.
    try {
      const data = await api("/api/users");
      employees.clear();
      data.users.forEach((u) => employees.set(u.id, u));
      render();
    } catch { /* ignore */ }
  });
  socket.on("disconnect", (reason) => {
    setConn(false);
    if (reason === "io server disconnect") { clearSession(); location.replace("login.html"); }
  });
  socket.on("connect_error", (err) => {
    setConn(false);
    if (err.message === "Unauthorized") { clearSession(); location.replace("login.html?expired=1"); }
  });

  // Real-time events from the server (no page refresh needed)
  socket.on("status:changed", (u) => { employees.set(u.id, u); render(); });
  socket.on("user:created", (u) => { employees.set(u.id, u); render(); });
}

function setConn(on) {
  const el = $("connBadge");
  el.className = `conn ${on ? "conn-on" : "conn-off"}`;
  el.textContent = on ? "Live: connected" : "Reconnecting…";
}

function render() {
  const all = [...employees.values()];

  // counters (always based on ALL employees)
  const count = (s) => all.filter((e) => e.status === s).length;
  $("totalCount").textContent = all.length;
  $("onlineCount").textContent = count("online");
  $("inactiveCount").textContent = count("inactive");
  $("offlineCount").textContent = count("offline");

  // search + status filter
  const list = all
    .filter((e) => filter === "all" || e.status === filter)
    .filter((e) => !search || e.name.toLowerCase().includes(search) || e.email.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));

  $("empGrid").innerHTML = list.map(cardHtml).join("");
  $("emptyState").textContent = all.length ? "No employees match your search." : "No employees have registered yet.";
  $("emptyState").classList.toggle("hidden", list.length > 0);
}

function cardHtml(e) {
  const loc = e.location
    ? `<a href="${escapeHtml(mapLink(e.location))}" target="_blank" rel="noopener noreferrer">${e.location.latitude.toFixed(4)}, ${e.location.longitude.toFixed(4)}</a>`
    : `<span class="muted">Not shared</span>`;
  return `
    <article class="emp-card">
      <div class="emp-head">
        ${avatarHtml(e, "sm")}
        <div><div class="name">${escapeHtml(e.name)}</div><div class="email">${escapeHtml(e.email)}</div></div>
      </div>
      <div class="row"><span>Status</span><span>${statusBadgeHtml(e.status)}</span></div>
      <div class="row"><span>Location</span><span>${loc}</span></div>
      <div class="row"><span>Last activity</span><span title="${escapeHtml(formatDateTime(e.lastActivity))}">${escapeHtml(timeAgo(e.lastActivity))}</span></div>
      <div class="row"><span>Status updated</span><span title="${escapeHtml(formatDateTime(e.statusUpdatedAt))}">${escapeHtml(timeAgo(e.statusUpdatedAt))}</span></div>
    </article>`;
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  socket?.disconnect();
  clearSession();
  location.replace("login.html");
}

init();
