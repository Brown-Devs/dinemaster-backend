import express from "express";
import { 
    createCompany, 
    getCompanies, 
    updateCompany, 
    getMyCompany, 
    updateMyCompany 
} from "../controllers/company.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Admin / My Company Routes
router.get("/me", authenticate, getMyCompany);
router.patch("/me", authenticate, updateMyCompany);

// Super Admin Routes
router.post("/", authenticate, authorizeRoles("super_admin"), createCompany);
router.get("/", authenticate, authorizeRoles("super_admin"), getCompanies);
router.patch("/:id", authenticate, authorizeRoles("super_admin"), updateCompany);

export default router;
