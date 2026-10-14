import jwt from "jsonwebtoken";

// Creates a signed JWT that contains only the user id.
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

export default generateToken;
