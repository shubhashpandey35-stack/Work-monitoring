import mongoose from "mongoose";

// Connects Node.js to MongoDB using Mongoose.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME || "work_monitoring",
    });
    console.log(`MongoDB connected: ${conn.connection.host} / db: ${conn.connection.name}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

export default connectDB;
