import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Customer from "../models/customer.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import User from "../models/user.model.js";
import { notifyKitchenOfNewOrder } from "../utils/notification.helper.js";

const getAssignedCompanyId = (req) => {
    const { company } = req.user;
    if (!company) {
        throw new ApiError(400, "Company ID could not be resolved from user session.");
    }
    return company;
};

// Create a new order
export const createOrder = asyncHandler(async (req, res) => {
    const {
        customer: customerData, // Expected: { name, mobileNo }
        items,
        additionalDiscount = 0,
        paymentStatus,
        payments,
        orderType,
        address,
        table,
        notes
    } = req.body;

    const assignedCompanyId = getAssignedCompanyId(req);
    const createdBy = req.user._id;

    if (!customerData || !customerData.mobileNo) {
        throw new ApiError(400, "Customer mobile number is required.");
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, "Order must contain at least one item.");
    }

    if (!orderType) {
        throw new ApiError(400, "Order type is required (dinein, delivery, packing).");
    }

    // 1. Calculate price securely (or rely on what was sent)
    let subTotal = 0;

    // ensure structured items match schema and sum correctly
    const processedItems = items.map(item => {
        let itemBasePrice = item.variant?.price || 0;
        let addonsPrice = 0;

        if (item.addOns && Array.isArray(item.addOns)) {
            addonsPrice = item.addOns.reduce((sum, addon) => sum + (addon.price || 0), 0);
        }

        const itemTotal = (itemBasePrice + addonsPrice) * (item.quantity || 1);
        subTotal += itemTotal;

        return {
            productId: item.productId,
            categoryId: item.categoryId,
            name: item.name,
            variant: item.variant,
            addOns: item.addOns,
            quantity: item.quantity
        };
    });

    const parsedAdditionalDiscount = Number(additionalDiscount) || 0;
    const totalAmount = subTotal - parsedAdditionalDiscount;

    if (totalAmount < 0) {
        throw new ApiError(400, "Total amount cannot be negative.");
    }

    // 2. Lookup or create customer
    let customer = await Customer.findOne({
        mobileNo: customerData.mobileNo.trim(),
        company: assignedCompanyId
    });

    if (customer) {
        // Update customer name if provided and if it differs (or is missing)
        if (customerData.name && customer.name !== customerData.name) {
            customer.name = customerData.name;
        }
    } else {
        // Create new customer
        customer = new Customer({
            name: customerData.name,
            mobileNo: customerData.mobileNo.trim(),
            company: assignedCompanyId,
            orders: []
        });
    }

    // Must save customer later once we have the order_id, 
    // or we save customer now to get the ID, then save order, then push to history.
    await customer.save();

    // 3. Generate sequential orderId
    const lastOrder = await Order.findOne({ company: assignedCompanyId }).sort({ orderId: -1 });
    const nextOrderId = lastOrder?.orderId ? lastOrder.orderId + 1 : 1;

    // 4. Create the Order
    const newOrder = new Order({
        orderId: nextOrderId,
        company: assignedCompanyId,
        customer: customer._id,
        items: processedItems,
        subTotal,
        additionalDiscount: parsedAdditionalDiscount,
        totalAmount,
        status: 'new',
        paymentStatus: paymentStatus || 'not_paid',
        payments: {
            cashAmount: payments?.cashAmount || 0,
            onlineAmount: payments?.onlineAmount || 0
        },
        orderType,
        address,
        table,
        notes,
        createdBy
    });

    await newOrder.save();

    // [Push Notifications] Notify kitchen staff of new order
    // This is async and should not block the response
    notifyKitchenOfNewOrder(assignedCompanyId, newOrder).catch(err => {
        console.error('[Notification] Failed to send push:', err);
    });

    // 5. Update customer history
    customer.orders.push(newOrder._id);
    await customer.save();

    // Explicitly fetch and populate the clean order document
    const finalOrder = await Order.findById(newOrder._id)
        .populate("customer", "name mobileNo")
        .populate("company")
        .populate("items.productId", "name imageUrl imageURL")
        .populate("createdBy", "name");

    res.status(201).json(new ApiResponse(201, { order: finalOrder.toObject() }, "Order created successfully."));
});

// Get paginated orders with advanced filters
export const getOrders = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        status,
        orderType,
        paymentStatus,
        paymentMode, // cash, online, mix
        fromDate,
        toDate,
        minAmount,
        maxAmount,
        searchQuery
    } = req.query;

    const assignedCompanyId = getAssignedCompanyId(req);

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, parseInt(limit, 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { company: assignedCompanyId };

    // Status & Type Filters
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    // Payment Mode Filter
    if (paymentMode === 'cash') {
        query['payments.cashAmount'] = { $gt: 0 };
        query['payments.onlineAmount'] = 0;
    } else if (paymentMode === 'online') {
        query['payments.onlineAmount'] = { $gt: 0 };
        query['payments.cashAmount'] = 0;
    } else if (paymentMode === 'mix') {
        query['payments.cashAmount'] = { $gt: 0 };
        query['payments.onlineAmount'] = { $gt: 0 };
    }

    // Date Filtering
    if (fromDate || toDate) {
        const start = fromDate ? new Date(fromDate) : new Date("2026-04-01");
        start.setHours(0, 0, 0, 0);

        const end = toDate ? new Date(toDate) : new Date();
        end.setHours(23, 59, 59, 999);

        query.createdAt = {
            $gte: start,
            $lte: end
        };
    }

    // Amount Filtering
    if (minAmount || maxAmount) {
        query.totalAmount = {};
        if (minAmount) query.totalAmount.$gte = parseFloat(minAmount);
        if (maxAmount) query.totalAmount.$lte = parseFloat(maxAmount);
    }

    // Search Logic (Customer Name, Phone, or exact Total Amount)
    if (searchQuery && searchQuery.trim()) {
        const escapedSearch = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedSearch, "i");

        // 1. Find customers matching name or mobile
        const customers = await Customer.find({
            company: assignedCompanyId,
            $or: [
                { name: regex },
                { mobileNo: regex }
            ]
        }).select("_id");

        const customerIds = customers.map(c => c._id);

        // 2. Build OR query for Order
        const searchConditions = [
            { customer: { $in: customerIds } }
        ];

        // If it's a number, also search exact totalAmount or orderId
        if (!isNaN(parseFloat(searchQuery))) {
            const numSearch = parseFloat(searchQuery);
            searchConditions.push({ totalAmount: numSearch });
            searchConditions.push({ orderId: numSearch });
        }

        query.$or = searchConditions;
    }

    const count = await Order.countDocuments(query);
    const orders = await Order.find(query)
        .populate("customer", "name mobileNo")
        .populate("company")
        .populate("items.productId", "name imageUrl imageURL")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

    res.status(200).json(new ApiResponse(200, {
        orders,
        totalCount: count,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            hasNextPage: parsedPage * parsedLimit < count
        }
    }, "Orders retrieved successfully."));
});

// Get summary statistics for orders (Backend Aggregated)
export const getOrderStats = asyncHandler(async (req, res) => {
    const assignedCompanyId = getAssignedCompanyId(req);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const stats = await Order.aggregate([
        {
            $match: {
                company: new mongoose.Types.ObjectId(assignedCompanyId),
                createdAt: { $gte: startOfToday, $lte: endOfToday },
                status: { $ne: 'cancelled' } // Explicitly exclude cancelled orders
            }
        },
        {
            $facet: {
                todayTotal: [{ $count: "count" }],
                statusBreakdown: [
                    { $group: { _id: "$status", count: { $sum: 1 } } }
                ],
                typeBreakdown: [
                    { $group: { _id: "$orderType", count: { $sum: 1 } } }
                ],
                paymentBreakdown: [
                    { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }
                ]
            }
        }
    ]);

    const raw = stats[0];

    // Helper to get count from simple aggregation result
    const getCount = (array, id) => array?.find(i => i._id === id)?.count || 0;

    const result = {
        todayTotal: raw.todayTotal[0]?.count || 0,
        statusCounts: {
            new: getCount(raw.statusBreakdown, 'new'),
            prepared: getCount(raw.statusBreakdown, 'prepared'),
            out_for_delivery: getCount(raw.statusBreakdown, 'out_for_delivery'),
            delivered: getCount(raw.statusBreakdown, 'delivered')
        },
        typeCounts: {
            dinein: getCount(raw.typeBreakdown, 'dinein'),
            packing: getCount(raw.typeBreakdown, 'packing'),
            delivery: getCount(raw.typeBreakdown, 'delivery')
        },
        paymentCounts: {
            paid: getCount(raw.paymentBreakdown, 'paid'),
            unpaid: getCount(raw.paymentBreakdown, 'not_paid')
        }
    };

    res.status(200).json(new ApiResponse(200, result, "Order statistics retrieved successfully."));
});

// Update an existing order (status, payments, paymentStatus)
export const updateOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        status,
        paymentStatus,
        payments,
        orderType,
        additionalDiscount,
        address,
        table,
        notes
    } = req.body;
    const assignedCompanyId = getAssignedCompanyId(req);

    const order = await Order.findOne({ _id: id, company: assignedCompanyId });

    if (!order) {
        throw new ApiError(404, "Order not found.");
    }

    if (order.status === 'cancelled') {
        throw new ApiError(400, "Cannot update a cancelled order.");
    }

    if (order.status === 'delivered' && status === 'cancelled') {
        throw new ApiError(400, "Cannot cancel an already delivered order.");
    }

    let isModified = false;

    if (status && ['new', 'prepared', 'out_for_delivery', 'delivered', 'cancelled'].includes(status)) {
        order.status = status;
        isModified = true;
    }

    if (paymentStatus && ['not_paid', 'paid'].includes(paymentStatus)) {
        order.paymentStatus = paymentStatus;
        isModified = true;
    }

    if (orderType && ['dinein', 'delivery', 'packing'].includes(orderType)) {
        order.orderType = orderType;
        isModified = true;
    }

    if (address !== undefined) {
        order.address = address;
        isModified = true;
    }
    
    if (table !== undefined) {
        order.table = table;
        isModified = true;
    }

    if (notes !== undefined) {
        order.notes = notes;
        isModified = true;
    }

    if (payments && (payments.cashAmount !== undefined || payments.onlineAmount !== undefined)) {
        if (payments.cashAmount !== undefined) order.payments.cashAmount = payments.cashAmount;
        if (payments.onlineAmount !== undefined) order.payments.onlineAmount = payments.onlineAmount;
        isModified = true;
    }

    // If additional discount is updated, recalculate totalAmount
    if (additionalDiscount !== undefined) {
        order.additionalDiscount = parseFloat(additionalDiscount) || 0;
        order.totalAmount = order.subTotal - order.additionalDiscount;
        isModified = true;
    }

    if (!isModified) {
        throw new ApiError(400, "No valid fields provided to update.");
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
        .populate("customer", "name mobileNo")
        .populate("company")
        .populate("items.productId", "name imageUrl imageURL");

    res.status(200).json(new ApiResponse(200, { order: updatedOrder }, "Order updated successfully."));
});
// Specialized API for the Kitchen Module display
export const getKitchenOrders = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        status,
        orderType,
        date,
        fromDate,
        toDate
    } = req.query;

    const assignedCompanyId = getAssignedCompanyId(req);

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, parseInt(limit, 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // Determine the date range
    let start, end;

    if (fromDate && toDate) {
        start = new Date(fromDate);
        end = new Date(toDate);
    } else {
        // Normalizing the date (Default: Today 00:00:00 to 23:59:59)
        const targetDate = date ? new Date(date) : new Date();
        start = new Date(targetDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(targetDate);
        end.setHours(23, 59, 59, 999);
    }

    const baseQuery = {
        company: assignedCompanyId,
        createdAt: { $gte: start, $lte: end }
    };

    // Filter by status if provided (otherwise show all non-cancelled)
    if (status) {
        baseQuery.status = status;
    } else {
        baseQuery.status = { $ne: 'cancelled' };
    }

    // 1. Get categorized counts for the entire filtered day (before orderType filter)
    const countsAggregation = await Order.aggregate([
        { $match: baseQuery },
        {
            $group: {
                _id: "$orderType",
                count: { $sum: 1 }
            }
        }
    ]);

    const counts = {
        dinein: 0,
        delivery: 0,
        packing: 0,
        total: 0
    };

    countsAggregation.forEach(item => {
        if (item._id === 'dinein') counts.dinein = item.count;
        if (item._id === 'delivery') counts.delivery = item.count;
        if (item._id === 'packing') counts.packing = item.count;
        counts.total += item.count;
    });

    // 2. Fetch paginated orders with optional orderType filter
    const finalQuery = { ...baseQuery };
    if (orderType) {
        finalQuery.orderType = orderType;
    }

    const orders = await Order.find(finalQuery)
        .populate("customer", "name mobileNo")
        .populate("company")
        .populate("items.productId", "name imageUrl")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

    const totalCount = await Order.countDocuments(finalQuery);

    res.status(200).json(new ApiResponse(200, {
        orders,
        counts,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            totalCount,
            hasNextPage: parsedPage * parsedLimit < totalCount
        }
    }, "Kitchen orders retrieved successfully."));
});
