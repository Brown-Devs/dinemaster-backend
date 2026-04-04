import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createOrder, getOrders, updateOrder } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/", authenticate, createOrder);
router.get("/", authenticate, getOrders);
router.patch("/:id", authenticate, updateOrder);

export default router;
