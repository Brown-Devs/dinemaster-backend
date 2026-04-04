import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createUser, listUsersBySystemRoleV2, getUserRoleAndPermissions, updateUser } from "../controllers/user.controller.js";

const router = express.Router();

router.post("/create", authenticate, createUser);
router.get("/list", authenticate, listUsersBySystemRoleV2);
router.get("/:id/getPermissions", authenticate, getUserRoleAndPermissions);
router.patch("/:id", authenticate, updateUser);


export default router;
