import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { lookupCustomer, updateCustomer, getCustomers } from "../controllers/customer.controller.js";

const router = express.Router();

router.get("/", authenticate, getCustomers);
router.get("/lookup", authenticate, lookupCustomer);
router.put("/:id", authenticate, updateCustomer);

export default router;
