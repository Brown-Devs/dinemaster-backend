import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { getMasterCatalogs, getUniqueMasterCategories } from "../controllers/masterCatalog.controller.js";

const router = express.Router();

router.get("/", authenticate, getMasterCatalogs);

// Must be defined before any dynamic /:id parameters inherently
router.get("/categories", authenticate, getUniqueMasterCategories);

export default router;
