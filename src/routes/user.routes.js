import express from "express";
import { createUser, getUsers } from "../controllers/user.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authenticate, authorizeRoles("super_admin", "admin"), createUser);
router.get("/", authenticate, authorizeRoles("super_admin", "admin"), getUsers);

export default router;
