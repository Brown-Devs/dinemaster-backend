import express from "express";
import { createCompany, getCompanies } from "../controllers/company.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Only super_admin can create or view the global company list
router.post("/", authenticate, authorizeRoles("super_admin"), createCompany);
router.get("/", authenticate, authorizeRoles("super_admin"), getCompanies);

export default router;
