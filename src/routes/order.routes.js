import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createOrder, getOrders, getOrderStats, updateOrder, getKitchenOrders, getOrderById } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/", authenticate, createOrder);
router.get("/", authenticate, getOrders);
router.get("/kitchen", authenticate, getKitchenOrders);
router.get("/stats", authenticate, getOrderStats);
router.get("/:id", authenticate, getOrderById);
router.patch("/:id", authenticate, updateOrder);

export default router;
