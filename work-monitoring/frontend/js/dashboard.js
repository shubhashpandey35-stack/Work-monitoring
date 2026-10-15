import {
  api, requireAuth, getToken, clearSession, avatarHtml, statusBadgeHtml,
  formatDateTime, timeAgo, mapLink, escapeHtml
} from "./api.js";

const HEARTBEAT_MS = 30 * 1000;             // while active, tell the server at most every 30 s
const LOCATION_REFRESH_MS = 5 * 60 * 1000;  // refresh shared location every 5 min
// We only listen for the FACT that something happened. We never read which key was pressed
// or where the mouse is. Nothing is recorded or stored.
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

let user, settings, socket;
let state = "online";            // "online" | "inactive"  (what this browser thinks)
let inactivityTimer, locationTimer;
let lastHandled = 0, lastSent = 0, lastActivityAt = Date.now();

const $ = (id) => document.getElementById(id);

async function init() {
  if (!requireAuth("employee")) return;
  try {
    const data = await api("/api/auth/me");
    user = data.user;
    settings = data.settings;
  } catch { return; }

  renderProfile();
  renderStatus();
  renderLocation();
  $("timeoutText").textContent = formatTimeout(settings.inactivityTimeoutSeconds);
  $("logoutBtn").addEventListener("click", logout);

  connectSocket();
  startActivityDetection();
  setupLocation();
  setInterval(renderStatus, 5000); // keeps "x seconds ago" fresh
}

/* ---------------- rendering ---------------- */
function renderProfile() {
  $("avatarWrap").innerHTML = avatarHtml(user, "lg");
  $("userName").textContent = user.name;
  $("userEmail").textContent = user.email;
  $("userRole").textContent = user.role;
}
function renderStatus() {
  $("statusBadge").innerHTML = statusBadgeHtml(state);
  $("lastActivity").textContent = `${formatDateTime(lastActivityAt)} (${timeAgo(lastActivityAt)})`;
}
function formatTimeout(sec) {
  return sec % 60 === 0 ? `${sec / 60} minute(s) without activity` : `${sec} seconds without activity`;
}
function setConn(on) {
  const el = $("connBadge");
  el.className = `conn ${on ? "conn-on" : "conn-off"}`;
  el.textContent = on ? "Live: connected" : "Reconnecting…";
}

/* ---------------- Socket.IO ---------------- */
function connectSocket() {
  socket = io({ auth: { token: getToken() }, reconnectionDelayMax: 5000 });

  socket.on("connect", () => {
    setConn(true);
    lastSent = Date.now();
    // After a reconnect the server assumes "online"; correct it if we are actually inactive.
    if (state === "inactive") socket.emit("activity:inactive");
  });
  socket.on("disconnect", (reason) => {
    setConn(false);
    if (reason === "io server disconnect") { clearSession(); location.replace("login.html"); }
  });
  socket.on("connect_error", (err) => {
    setConn(false);
    if (err.message === "Unauthorized") { clearSession(); location.replace("login.html?expired=1"); }
  });
}

/* ---------------- activity detection ---------------- */
function startActivityDetection() {
  ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
  resetInactivityTimer();
}
function onActivity() {
  const now = Date.now();
  if (state === "online" && now - lastHandled < 1000) return; // handle at most once per second
  lastHandled = now;
  lastActivityAt = now;
  resetInactivityTimer();

  if (state === "inactive") {            // became active again
    state = "online";
    renderStatus();
    sendActive();
  } else if (now - lastSent >= HEARTBEAT_MS) {
    sendActive();                        // tiny "still active" ping (just a timestamp)
  }
}
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(goInactive, settings.inactivityTimeoutSeconds * 1000);
}
function goInactive() {
  state = "inactive";
  renderStatus();
  if (socket?.connected) socket.emit("activity:inactive");
}
function sendActive() {
  lastSent = Date.now();
  if (socket?.connected) socket.emit("activity:active");
}

/* ---------------- location (only with consent) ---------------- */
function renderLocation() {
  const loc = user.locationConsent ? user.location : null;
  $("locToggle").checked = user.locationConsent;
  $("locBox").classList.toggle("hidden", !loc);
  if (loc) {
    $("locCoords").textContent = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
    $("locUpdated").textContent = formatDateTime(loc.updatedAt);
    $("locMapLink").href = mapLink(loc);
    setLocMessage("Your admin can see this location. Switch the option off to stop sharing and delete it.");
  } else if (!user.locationConsent) {
    setLocMessage("Location sharing is off. Nothing is shared or stored.");
  }
}
function setLocMessage(text) { $("locMessage").textContent = text; }

function setupLocation() {
  $("locToggle").addEventListener("change", onLocationToggle);
  $("locRefreshBtn").addEventListener("click", () => shareLocation());
  if (user.locationConsent) { shareLocation(); startLocationTimer(); }
}
function startLocationTimer() {
  clearInterval(locationTimer);
  locationTimer = setInterval(shareLocation, LOCATION_REFRESH_MS);
}
async function onLocationToggle() {
  const toggle = $("locToggle");
  if (toggle.checked) {
    const agreed = confirm(
      "Share your approximate location with your admin?\n\nYour browser will ask for permission next. " +
      "You can turn this off any time, which also deletes the stored location."
    );
    if (!agreed) { toggle.checked = false; return; }
    const done = await shareLocation();
    if (done) startLocationTimer(); else toggle.checked = false;
  } else {
    clearInterval(locationTimer);
    try {
      const data = await api("/api/users/location", { method: "PATCH", body: { consent: false } });
      user = data.user;
      renderLocation();
    } catch (err) { setLocMessage(err.message); }
  }
}
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Your browser does not support location."));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
  });
}
async function shareLocation() {
  try {
    const pos = await getPosition(); // the BROWSER shows its own permission popup here
    const { latitude, longitude } = pos.coords;
    const data = await api("/api/users/location", { method: "PATCH", body: { consent: true, latitude, longitude } });
    user = data.user;
    renderLocation();
    return true;
  } catch (err) {
    const messages = {
      1: "Location permission was denied in your browser, so nothing was shared. You can allow it in the site settings and try again.",
      2: "Your position could not be determined right now.",
      3: "Getting your location timed out. Please try again.",
    };
    setLocMessage(messages[err.code] || err.message);
    return false;
  }
}

/* ---------------- logout ---------------- */
async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch { /* still log out locally */ }
  socket?.disconnect();
  clearSession();
  location.replace("login.html");
}

init();
