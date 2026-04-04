import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createOrder, getOrders, updateOrder, getKitchenOrders } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/", authenticate, createOrder);
router.get("/", authenticate, getOrders);
router.get("/kitchen", authenticate, getKitchenOrders);
router.patch("/:id", authenticate, updateOrder);

export default router;
