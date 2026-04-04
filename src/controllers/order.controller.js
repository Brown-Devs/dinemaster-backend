import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Customer from "../models/customer.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
        paymentMode,
        orderType 
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
        throw new ApiError(400, "Order type is required (dinein, homeDelivery, packing).");
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

    // 3. Create the Order
    const newOrder = new Order({
        company: assignedCompanyId,
        customer: customer._id,
        items: processedItems,
        subTotal,
        additionalDiscount: parsedAdditionalDiscount,
        totalAmount,
        status: 'new',
        paymentStatus: paymentStatus || 'not_paid',
        paymentMode,
        orderType,
        createdBy
    });

    await newOrder.save();

    // 4. Update customer history
    customer.orders.push(newOrder._id);
    await customer.save();

    res.status(201).json(new ApiResponse(201, { order: newOrder }, "Order created successfully."));
});

// Get paginated orders
export const getOrders = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, orderType } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, parseInt(limit, 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { company: assignedCompanyId };
    
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;

    const count = await Order.countDocuments(query);
    const orders = await Order.find(query)
        .populate("customer", "name mobileNo")
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

// Change status to cancelled or delivered, and update payment status
export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, paymentStatus, paymentMode } = req.body;
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

    if (status && ['new', 'delivered', 'cancelled'].includes(status)) {
        order.status = status;
        isModified = true;
    }

    if (paymentStatus && ['not_paid', 'paid'].includes(paymentStatus)) {
        order.paymentStatus = paymentStatus;
        isModified = true;
    }

    if (paymentMode && ['cash', 'online'].includes(paymentMode)) {
        order.paymentMode = paymentMode;
        isModified = true;
    }

    if (!isModified) {
        throw new ApiError(400, "No valid fields provided to update.");
    }

    await order.save();

    res.status(200).json(new ApiResponse(200, { order }, "Order status updated successfully."));
});
