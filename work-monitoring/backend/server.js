import "dotenv/config"; // must be first
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import { initSocket } from "./sockets/index.js";

// Stop early with a clear message if .env is incomplete
for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in backend/.env`);
    process.exit(1);
  }
}

await connectDB();

// After a server restart no socket is connected, so nobody can be online.
await User.updateMany({ status: { $ne: "offline" } }, { $set: { status: "offline", statusUpdatedAt: new Date() } });

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (process.env.CLIENT_URL || "http://localhost:5000").split(",").map((s) => s.trim()),
    credentials: true,
  },
});
app.set("io", io); // controllers can reach Socket.IO via req.app.get("io")
initSocket(io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open the website: http://localhost:${PORT}/login.html`);
});
