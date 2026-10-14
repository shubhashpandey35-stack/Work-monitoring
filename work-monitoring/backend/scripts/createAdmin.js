// Run:  npm run create-admin
// Creates the first admin (or promotes an existing user to admin).
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

const name = process.env.ADMIN_NAME || "Admin";
const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "Admin@12345";

await connectDB();

let user = await User.findOne({ email }).select("+password");
if (user) {
  user.role = "admin";
  user.password = password; // re-hashed by the pre-save hook
  await user.save();
  console.log(`Existing user promoted to admin: ${email}`);
} else {
  await User.create({ name, email, password, role: "admin" });
  console.log(`Admin created: ${email}`);
}
console.log(`Login with  email: ${email}   password: ${password}`);

await mongoose.disconnect();
