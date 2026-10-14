// Animated background. Loaded safely: if canvas.js is missing, the website still works.
import("./canvas.js").catch(() => {});

// Shared helpers used by every page.
// The website is served by the same Express server, so API_URL is empty (same origin).
export const API_URL = window.APP_API_URL || "";

const TOKEN_KEY = "wm_token";
const USER_KEY = "wm_user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};
export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function redirectByRole(user) {
  location.replace(user.role === "admin" ? "admin.html" : "dashboard.html");
}

// Page guard: not logged in -> login page. Wrong role -> their own page.
export function requireAuth(role) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) { location.replace("login.html"); return null; }
  if (role && user.role !== role) { redirectByRole(user); return null; }
  return user;
}

// fetch() wrapper: adds the JWT, parses JSON, throws readable errors.
export async function api(path, { method = "GET", body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (formData) {
    payload = formData; // browser sets the multipart header itself
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Please check your internet connection.");
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) { // token expired / invalid
    clearSession();
    location.replace("login.html?expired=1");
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

// ---------- small UI helpers ----------
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function showAlert(el, type, message) {
  el.className = `alert alert-${type}`;
  el.textContent = message;
}
export function hideAlert(el) { el.className = "alert hidden"; el.textContent = ""; }
export function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector(".spinner").classList.toggle("hidden", !loading);
  btn.querySelector(".btn-text").textContent = loading ? "Please wait…" : btn.dataset.label;
}
export function setFieldError(id, message = "") {
  document.getElementById(id + "Error").textContent = message;
}

export const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

export function avatarHtml(u, size = "md") {
  if (u.profilePhoto) {
    return `<img class="avatar avatar-${size}" src="${escapeHtml(API_URL + u.profilePhoto)}" alt="${escapeHtml(u.name)}" loading="lazy">`;
  }
  return `<div class="avatar avatar-${size} avatar-fallback">${escapeHtml(initials(u.name))}</div>`;
}

const LABELS = { online: "Online", inactive: "Inactive", offline: "Offline" };
export function statusBadgeHtml(status) {
  const s = LABELS[status] ? status : "offline";
  return `<span class="badge badge-${s}"><span class="dot"></span>${LABELS[s]}</span>`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
export function timeAgo(value) {
  if (!value) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return formatDateTime(value);
}
export function mapLink(loc) {
  return `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=15/${loc.latitude}/${loc.longitude}`;
}