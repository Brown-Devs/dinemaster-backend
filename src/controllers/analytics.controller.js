import Order from "../models/order.model.js";
import Customer from "../models/customer.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

const getAssignedCompanyId = (req) => {
    const { company } = req.user;
    if (!company) {
        throw new ApiError(400, "Company ID could not be resolved from user session.");
    }
    return company;
};

// Helper for date normalization (Today by default)
const getTodayRange = (from, to) => {
    let startDate = from ? new Date(from) : new Date();
    startDate.setHours(0, 0, 0, 0);

    let endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
};

// Helper for chart range (This month by default)
const getMonthRange = (from, to) => {
    let startDate = from ? new Date(from) : new Date();
    if (!from) startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    let endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
};

// --- SUMMARIES (Default: Today) ---

export const getEarningsSummary = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);
    const { startDate, endDate } = getTodayRange(from, to);

    const query = {
        company: assignedCompanyId,
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
    };

    const earnings = await Order.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: "$totalAmount" },
                cashAmount: { $sum: "$payments.cashAmount" },
                onlineAmount: { $sum: "$payments.onlineAmount" }
            }
        }
    ]);

    res.status(200).json(new ApiResponse(200, earnings[0] || { totalAmount: 0, cashAmount: 0, onlineAmount: 0 }, "Earnings summary fetched."));
});

export const getOrdersSummary = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);
    const { startDate, endDate } = getTodayRange(from, to);

    const query = {
        company: assignedCompanyId,
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $ne: 'cancelled' }
    };

    const orderBreakdown = await Order.aggregate([
        { $match: query },
        {
            $facet: {
                paymentStatus: [
                    { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }
                ],
                orderType: [
                    { $group: { _id: "$orderType", count: { $sum: 1 } } }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const result = {
        total: orderBreakdown[0]?.totalCount[0]?.count || 0,
        byPaymentStatus: orderBreakdown[0]?.paymentStatus || [],
        byOrderType: orderBreakdown[0]?.orderType || []
    };

    res.status(200).json(new ApiResponse(200, result, "Orders summary fetched."));
});

export const getCustomersSummary = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);
    const { startDate, endDate } = getTodayRange(from, to);

    const count = await Customer.countDocuments({
        company: assignedCompanyId,
        createdAt: { $gte: startDate, $lte: endDate }
    });

    res.status(200).json(new ApiResponse(200, { newCustomers: count }, "Customers summary fetched."));
});

// --- CHARTS (Default: This Month) ---

export const getEarningsChart = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);
    const { startDate, endDate } = getMonthRange(from, to);

    const data = await Order.aggregate([
        { 
            $match: {
                company: assignedCompanyId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $ne: 'cancelled' }
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                total: { $sum: "$totalAmount" },
                cash: { $sum: "$payments.cashAmount" },
                online: { $sum: "$payments.onlineAmount" }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.status(200).json(new ApiResponse(200, data, "Earnings chart data fetched."));
});

export const getOrdersChart = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);
    const { startDate, endDate } = getMonthRange(from, to);

    const data = await Order.aggregate([
        { 
            $match: {
                company: assignedCompanyId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $ne: 'cancelled' }
            } 
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    type: "$orderType"
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.date",
                types: {
                    $push: {
                        type: "$_id.type",
                        count: "$count"
                    }
                }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.status(200).json(new ApiResponse(200, data, "Orders chart data fetched."));
});

export const getCustomersChart = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);
    const { startDate, endDate } = getMonthRange(from, to);

    const data = await Customer.aggregate([
        { 
            $match: {
                company: assignedCompanyId,
                createdAt: { $gte: startDate, $lte: endDate }
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.status(200).json(new ApiResponse(200, data, "Customers chart data fetched."));
});
