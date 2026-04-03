let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const emitToUser = (userId, event, payload = {}) => {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
};

// ✅ NEW
export const emitToCompany = (companyId, event, payload = {}) => {
  if (!ioInstance) return;
  ioInstance.to(`company:${companyId}`).emit(event, payload);
};

// ✅ NEW
export const emitToConversation = (conversationId, event, payload = {}) => {
  if (!ioInstance) return;
  ioInstance
    .to(`whatsapp:conversation:${conversationId}`)
    .emit(event, payload);
};
