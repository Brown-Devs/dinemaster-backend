import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { 
    bulkImportFromMaster, 
    createBrandProduct, 
    getBrandProducts, 
    updateBrandProduct, 
    deleteBrandProduct, 
    bulkDeleteBrandProducts 
} from "../controllers/brandProduct.controller.js";

const router = express.Router();

// Middleware to block super_admin from creating/updating brand products directly WITHOUT specifying a companyId
// This helper was previously here but we refactored the controller to use getAssignedCompanyId which handles this more gracefully.
// However, the user specifically mentioned blocking super_admin from direct organic creation in the previous turn.
// For now, I'll keep the routes protected by authenticate and use the controller's logic.

// Get all products for the company (Authenticated)
router.get("/", authenticate, getBrandProducts);

// Bulk import endpoint (taking an array of mastercatalog ids)
router.post("/bulk-import", authenticate, bulkImportFromMaster);

// Bulk delete endpoint
router.post("/bulk-delete", authenticate, bulkDeleteBrandProducts);

// 2. Manual Product Creation
router.post("/", authenticate, createBrandProduct);

// 3. Update Product
router.patch("/:id", authenticate, updateBrandProduct);

// Delete a specific brand product
router.delete("/:id", authenticate, deleteBrandProduct);

export default router;
