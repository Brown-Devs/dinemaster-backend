import express from "express";
import { createCompany, getCompanies, updateCompany } from "../controllers/company.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Only super_admin can create or view the global company list
router.post("/", authenticate, createCompany);
router.get("/", authenticate, getCompanies);
router.patch("/:id", authenticate, updateCompany);

export default router;
