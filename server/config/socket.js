const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("../generated/prisma");

const db = new PrismaClient();

module.exports = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await db.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.user = user;

      next();
    } catch (err) {
      console.error("Socket Auth Error:", err.message);
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `⚡ User connected: ${socket.user.email} (ID: ${socket.user.id})`
    );

    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`User ${socket.user.email} joined room ${room}`);
    });

    socket.on("chatMessage", ({ room, message }) => {
      io.to(room).emit("chatMessage", {
        user: socket.user.email,
        message,
        time: new Date(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.user.email}`);
    });
  });
};
