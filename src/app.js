import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import companyRoutes from "./routes/company.routes.js";

const app = express();

// --- Middleware ---
app.use(express.json({
    limit: "100mb",
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://dinemaster.browndevs.com"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Your server is up and running smoothly....",
    });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/companies", companyRoutes);


// --- Global error handler ---
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);

    if (err.toJSON) {
        return res.status(err.statusCode || 500).json(err.toJSON());
    }

    return res.status(err.statusCode || 500).json({
        name: err.name || "Error",
        statusCode: err.statusCode || 500,
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || []
    });
});

export default app;
