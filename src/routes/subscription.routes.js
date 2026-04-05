import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { saveSubscription, deleteSubscription } from "../controllers/subscription.controller.js";

const router = express.Router();

router.post("/", authenticate, saveSubscription);
router.post("/delete", authenticate, deleteSubscription);

export default router;
