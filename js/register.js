import { api, showAlert, hideAlert, setLoading, setFieldError, getToken, getStoredUser, redirectByRole } from "./api.js";

const form = document.getElementById("registerForm");
const alertBox = document.getElementById("alert");
const submitBtn = document.getElementById("submitBtn");
const photoInput = document.getElementById("profilePhoto");
const preview = document.getElementById("photoPreview");
submitBtn.dataset.label = "Register";

if (getToken() && getStoredUser()) redirectByRole(getStoredUser());

// Show a preview of the chosen photo
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) { preview.innerHTML = ""; preview.textContent = "?"; preview.style.backgroundImage = ""; return; }
  preview.textContent = "";
  preview.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
  preview.style.backgroundSize = "cover";
  preview.style.backgroundPosition = "center";
});

const FIELDS = ["name", "email", "password", "confirmPassword", "profilePhoto"];

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert(alertBox);
  FIELDS.forEach((f) => setFieldError(f));

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const file = photoInput.files[0];

  let ok = true;
  const fail = (field, msg) => { setFieldError(field, msg); ok = false; };

  if (name.length < 2) fail("name", "Name must be at least 2 characters");
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("email", "Enter a valid email address");
  if (password.length < 8) fail("password", "Password must be at least 8 characters");
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) fail("password", "Use at least one letter and one number");
  if (confirmPassword !== password) fail("confirmPassword", "Passwords do not match");
  if (file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) fail("profilePhoto", "Only JPG, PNG or WEBP allowed");
    else if (file.size > 2 * 1024 * 1024) fail("profilePhoto", "Photo must be 2 MB or smaller");
  }
  if (!ok) return;

  // Photo + text fields => multipart/form-data
  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("password", password);
  formData.append("confirmPassword", confirmPassword);
  if (file) formData.append("profilePhoto", file);

  setLoading(submitBtn, true);
  try {
    await api("/api/auth/register", { method: "POST", formData });
    location.href = "login.html?registered=1";
  } catch (err) {
    showAlert(alertBox, "error", err.message);
    setLoading(submitBtn, false);
  }
});
