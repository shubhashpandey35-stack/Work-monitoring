import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

// "protect": only logged-in users (valid JWT) can pass.
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AppError("Not authorized, token missing", 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError("Not authorized, token invalid or expired", 401);
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError("User no longer exists", 401);

  req.user = user;
  next();
});
