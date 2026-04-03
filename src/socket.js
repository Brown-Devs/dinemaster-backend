
export const initSocket = (io) => {

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected", socket.id);

    // Existing user join
    socket.on("join", ({ userId }) => {
      socket.join(`user:${userId}`);
      console.log(`👤 joined user:${userId}`);
    });

    // ✅ NEW: Company room
    socket.on("join:company", ({ companyId }) => {
      socket.join(`company:${companyId}`);
      console.log(`🏢 joined company:${companyId}`);
    });

    // ✅ NEW: WhatsApp conversation room
    socket.on("join:whatsapp:conversation", ({ conversationId }) => {
      socket.join(`whatsapp:conversation:${conversationId}`);
      console.log(`💬 joined whatsapp:conversation:${conversationId}`);
    });

    socket.on("leave:whatsapp:conversation", ({ conversationId }) => {
      socket.leave(`whatsapp:conversation:${conversationId}`);
      console.log(`🚪 left whatsapp:conversation:${conversationId}`);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected", socket.id);
    });
  });

};

