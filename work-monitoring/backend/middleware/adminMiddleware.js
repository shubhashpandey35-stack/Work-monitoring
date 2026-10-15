import AppError from "../utils/AppError.js";

// Use AFTER protect. Only users with role "admin" can pass.
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return next(new AppError("Access denied: admin only", 403));
  }
  next();
};
