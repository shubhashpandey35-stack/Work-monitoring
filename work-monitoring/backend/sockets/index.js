import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { toPublicUser } from "../utils/userSerializer.js";

// userId -> Set of socket ids (one employee can have several tabs open)
const connections = new Map();
// userId -> timer that will mark the user offline after a short grace period
const offlineTimers = new Map();
const OFFLINE_GRACE_MS = 5000; // lets a quick page refresh / reconnect avoid flicker

export const emitToAdmins = (io, event, payload) => io.to("admins").emit(event, payload);

// Saves the status in MongoDB and pushes it to every admin in real time.
export async function updateUserStatus(io, userId, status, { touchActivity = false } = {}) {
  const now = new Date();
  const $set = { status, statusUpdatedAt: now };
  if (touchActivity) $set.lastActivity = now;
  const user = await User.findByIdAndUpdate(userId, { $set }, { new: true });
  if (user) emitToAdmins(io, "status:changed", toPublicUser(user));
  return user;
}

// Used by logout: close every socket of the user and mark offline immediately.
export async function forceOffline(io, userId) {
  clearTimeout(offlineTimers.get(userId));
  offlineTimers.delete(userId);
  connections.delete(userId);
  io.in(`user:${userId}`).disconnectSockets(true);
  return updateUserStatus(io, userId, "offline");
}

export function initSocket(io) {
  // 1) Authenticate every socket with the JWT sent by the browser.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("role");
      if (!user) return next(new Error("Unauthorized"));
      socket.data.userId = String(user._id);
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  // 2) Handle connections
  io.on("connection", async (socket) => {
    const { userId, role } = socket.data;
    socket.join(`user:${userId}`);

    // Admins just join the "admins" room to receive updates.
    if (role === "admin") {
      socket.join("admins");
      return;
    }

    // ---- Employee: register event handlers FIRST (synchronously) ----
    let lastActiveAt = 0;
    socket.on("activity:active", async () => {
      const now = Date.now();
      if (now - lastActiveAt < 1000) return; // basic flood protection
      lastActiveAt = now;
      try {
        await updateUserStatus(io, userId, "online", { touchActivity: true });
      } catch (err) {
        console.error("activity:active failed:", err.message);
      }
    });

    socket.on("activity:inactive", async () => {
      try {
        await updateUserStatus(io, userId, "inactive");
      } catch (err) {
        console.error("activity:inactive failed:", err.message);
      }
    });

    socket.on("disconnect", () => {
      const set = connections.get(userId);
      if (!set) return; // already handled (e.g. logout)
      set.delete(socket.id);
      if (set.size > 0) return; // other tabs are still connected

      // Last tab closed / internet lost: wait a few seconds, then mark offline.
      const timer = setTimeout(async () => {
        offlineTimers.delete(userId);
        if (connections.get(userId)?.size) return; // user reconnected meanwhile
        connections.delete(userId);
        try {
          await updateUserStatus(io, userId, "offline");
        } catch (err) {
          console.error("offline update failed:", err.message);
        }
      }, OFFLINE_GRACE_MS);
      offlineTimers.set(userId, timer);
    });

    // ---- then mark the employee online ----
    clearTimeout(offlineTimers.get(userId));
    offlineTimers.delete(userId);
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(socket.id);

    try {
      await updateUserStatus(io, userId, "online", { touchActivity: true });
    } catch (err) {
      console.error("online update failed:", err.message);
    }
  });
}
