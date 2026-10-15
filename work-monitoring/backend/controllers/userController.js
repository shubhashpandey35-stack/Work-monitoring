import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { toPublicUser } from "../utils/userSerializer.js";
import { parse } from "../validators/authValidator.js";
import { statusSchema, locationSchema } from "../validators/userValidator.js";
import { emitToAdmins, updateUserStatus } from "../sockets/index.js";

// GET /api/users  (admin only) -> all employees
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: "employee" }).sort({ name: 1 });
  res.json({ success: true, count: users.length, users: users.map(toPublicUser) });
});

// PATCH /api/users/status  (employee) -> fallback to the socket events
export const updateStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "employee") throw new AppError("Only employees have an activity status", 403);
  const { status } = parse(statusSchema, req.body);
  const user = await updateUserStatus(req.app.get("io"), String(req.user._id), status, {
    touchActivity: status === "online",
  });
  res.json({ success: true, user: toPublicUser(user) });
});

// PATCH /api/users/location  (employee) -> only with consent
export const updateLocation = asyncHandler(async (req, res) => {
  if (req.user.role !== "employee") throw new AppError("Only employees can share location", 403);
  const data = parse(locationSchema, req.body);

  const update = data.consent
    ? {
        $set: {
          locationConsent: true,
          location: { latitude: data.latitude, longitude: data.longitude, updatedAt: new Date() },
        },
      }
    : { $set: { locationConsent: false }, $unset: { location: "" } }; // withdraw consent => delete location

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
  emitToAdmins(req.app.get("io"), "status:changed", toPublicUser(user));
  res.json({ success: true, user: toPublicUser(user) });
});
