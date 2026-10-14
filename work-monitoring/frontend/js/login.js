import {
  api, saveSession, getToken, getStoredUser, redirectByRole,
  showAlert, hideAlert, setLoading, setFieldError
} from "./api.js";

const form = document.getElementById("loginForm");
const alertBox = document.getElementById("alert");
const submitBtn = document.getElementById("submitBtn");
submitBtn.dataset.label = "Log in";

// Already logged in? Go straight to the right dashboard.
if (getToken() && getStoredUser()) redirectByRole(getStoredUser());

const params = new URLSearchParams(location.search);
if (params.get("registered")) showAlert(alertBox, "success", "Registration successful! Please log in.");
if (params.get("expired")) showAlert(alertBox, "error", "Your session expired. Please log in again.");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(alertBox);
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  // 1) Client-side validation (the server validates again; never trust only the browser)
  let ok = true;
  setFieldError("email"); setFieldError("password");
  if (!/^\S+@\S+\.\S+$/.test(email)) { setFieldError("email", "Enter a valid email address"); ok = false; }
  if (!password) { setFieldError("password", "Password is required"); ok = false; }
  if (!ok) return;

  // 2) Send to API
  setLoading(submitBtn, true);
  try {
    const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
    saveSession(data.token, data.user);
    redirectByRole(data.user);
  } catch (err) {
    showAlert(alertBox, "error", err.message);
    setLoading(submitBtn, false);
  }
});
