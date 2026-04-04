import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { lookupCustomer, updateCustomer } from "../controllers/customer.controller.js";

const router = express.Router();

router.get("/lookup", authenticate, lookupCustomer);
router.put("/:id", authenticate, updateCustomer);

export default router;
