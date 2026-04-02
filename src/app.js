import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import companyRoutes from "./routes/company.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import masterCatalogRoutes from "./routes/masterCatalog.routes.js";
import brandProductRoutes from "./routes/brandProduct.routes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/master-catalogs", masterCatalogRoutes);
app.use("/api/brand-products", brandProductRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(statusCode).json({
        success: false,
        message,
        errors: err.errors || []
    });
});

export default app;
