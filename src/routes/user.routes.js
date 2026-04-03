import express from "express";
import { createUser, getUsers, getUserRoleAndPermissions } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", authenticate, createUser);
router.get("/", authenticate, getUsers);
router.get("/:id/getPermissions", authenticate, getUserRoleAndPermissions);

export default router;
