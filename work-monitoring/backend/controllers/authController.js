import fs from "fs";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { toPublicUser } from "../utils/userSerializer.js";
import { parse, registerSchema, loginSchema } from "../validators/authValidator.js";
import { emitToAdmins, forceOffline } from "../sockets/index.js";

const deleteUploadedFile = (file) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

const settings = () => ({
  inactivityTimeoutSeconds: Number(process.env.INACTIVITY_TIMEOUT_SECONDS) || 120,
});

// POST /api/auth/register  (public)
export const register = asyncHandler(async (req, res) => {
  try {
    const data = parse(registerSchema, req.body);

    const exists = await User.findOne({ email: data.email });
    if (exists) throw new AppError("An account with this email already exists", 409);

    // role is NOT taken from the request: everyone who registers is an "employee"
    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password, // hashed automatically by the pre-save hook
      profilePhoto: req.file ? `/uploads/${req.file.filename}` : "",
    });

    emitToAdmins(req.app.get("io"), "user:created", toPublicUser(user));
    res.status(201).json({ success: true, message: "Registration successful. Please log in." });
  } catch (err) {
    deleteUploadedFile(req.file); // do not keep a photo if registration failed
    throw err;
  }
});

// POST /api/auth/login  (public)
export const login = asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);

  const user = await User.findOne({ email }).select("+password");
  // Same message for wrong email and wrong password (does not reveal which one exists)
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError("Invalid email or password", 401);
  }

  res.json({
    success: true,
    token: generateToken(user._id),
    user: toPublicUser(user),
    settings: settings(),
  });
});

// GET /api/auth/me  (logged-in)
export const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: toPublicUser(req.user), settings: settings() });
});

// POST /api/auth/logout  (logged-in)
export const logout = asyncHandler(async (req, res) => {
  if (req.user.role === "employee") {
    await forceOffline(req.app.get("io"), String(req.user._id));
  }
  res.json({ success: true, message: "Logged out" });
});
