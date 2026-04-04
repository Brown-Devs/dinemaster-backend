import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { 
    getEarningsSummary, 
    getOrdersSummary, 
    getCustomersSummary, 
    getEarningsChart, 
    getOrdersChart, 
    getCustomersChart 
} from "../controllers/analytics.controller.js";

const router = express.Router();

router.get("/summary/earnings", authenticate, getEarningsSummary);
router.get("/summary/orders", authenticate, getOrdersSummary);
router.get("/summary/customers", authenticate, getCustomersSummary);

router.get("/charts/earnings", authenticate, getEarningsChart);
router.get("/charts/orders", authenticate, getOrdersChart);
router.get("/charts/customers", authenticate, getCustomersChart);

export default router;
