import multer from "multer";

// No route matched
export const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

// Every error ends up here and becomes a clean JSON response.
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Profile photo must be 2MB or smaller" : err.message;
  } else if (err.code === 11000) {
    status = 409;
    message = "An account with this email already exists";
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid ID";
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Invalid JSON body";
  }

  if (status >= 500) {
    console.error(err); // full details only in the server console
    message = "Internal server error"; // never leak internals to the client
  }

  res.status(status).json({ success: false, message });
};
