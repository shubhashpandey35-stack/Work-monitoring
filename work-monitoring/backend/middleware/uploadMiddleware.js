import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import AppError from "../utils/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowed = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  // We build the file name ourselves (never trust the original name).
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${allowed[file.mimetype]}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (allowed[file.mimetype]) return cb(null, true);
    cb(new AppError("Only JPG, PNG or WEBP images are allowed", 400));
  },
});

export default upload;
