import express from "express";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import { createCategory, getCategories, getAllActiveCategories, updateCategory, deleteCategory } from "../controllers/category.controller.js";

const router = express.Router();

router.post("/", authenticate, authorizeRoles("super_admin", "admin"), createCategory);
router.get("/", authenticate, getCategories);
router.get("/all", authenticate, getAllActiveCategories);
router.put("/:id", authenticate, authorizeRoles("super_admin", "admin"), updateCategory);
router.delete("/:id", authenticate, authorizeRoles("super_admin", "admin"), deleteCategory);

export default router;
