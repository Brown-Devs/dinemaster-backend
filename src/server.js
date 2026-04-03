import dotenv from "dotenv";
import http from "http";
dotenv.config();

import { connectDB } from "./config/db.js";
import app from "./app.js";
import { Server } from "socket.io";
import { initSocket } from "./socket.js";
import { setIO } from "./utils/socketEmitter.js";

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "https://dinemaster.browndevs.com",
            "https://dinemaster-frontend.vercel.app/"
        ],
        credentials: true
    }
});

// init socket AFTER io is created
initSocket(io);

// Make io available to cron / services
setIO(io);

const startServer = async () => {
    try {
        await connectDB();

        server.listen(PORT, () => {
            console.log(`🚀 Server + Socket running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error.message);
    }
};

startServer();
