import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import { bulkImportFromMaster, createBrandProduct } from "../controllers/brandProduct.controller.js";

const router = express.Router();

// Middleware to block super_admin from creating/updating brand products directly
const blockSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === "super_admin") {
        return res.status(403).json({ success: false, message: "Super Admins cannot directly create or update brand products." });
    }
    next();
};

// Bulk import endpoint (taking an array of mastercatalog ids)
router.post("/bulk-import", authenticate, blockSuperAdmin, bulkImportFromMaster);

// Organic manual creation endpoint (for standard custom dashboard additions)
router.post("/", authenticate, blockSuperAdmin, createBrandProduct);

export default router;
