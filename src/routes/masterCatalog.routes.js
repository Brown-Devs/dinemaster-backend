import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { 
    getMasterCatalogs, 
    getUniqueMasterCategories, 
    getNotImportedMasterProducts, 
    updateMasterProduct,
    createMasterProduct,
    deleteMasterProduct
} from "../controllers/masterCatalog.controller.js";

const router = express.Router();

// Bulk product fetch (authenticated)
router.get("/", authenticate, getMasterCatalogs);

// Fetch products NOT yet imported by the company (authenticated)
router.get("/not-imported", authenticate, getNotImportedMasterProducts);

// Fetch unique categories for filtering (authenticated)
router.get("/categories", authenticate, getUniqueMasterCategories);

// Create a new master catalog product (restricted to super_admin via controller check)
router.post("/", authenticate, createMasterProduct);

// Update a master catalog product (restricted to super_admin via controller check)
router.patch("/:id", authenticate, updateMasterProduct);

// Delete a master catalog product (restricted to super_admin via controller check)
router.delete("/:id", authenticate, deleteMasterProduct);

export default router;
