import express from "express";
import { login, getMe, logout, getSession } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);
router.get("/session/:sessionId", authenticate, getSession);

export default router;
