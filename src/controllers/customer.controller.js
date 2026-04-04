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

// Lookup customer by mobile number
export const lookupCustomer = asyncHandler(async (req, res) => {
    const { mobileNo } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req);

    if (!mobileNo) {
        throw new ApiError(400, "Mobile number is required for lookup.");
    }

    const customer = await Customer.findOne({ 
        mobileNo: mobileNo.trim(), 
        company: assignedCompanyId 
    }).select("name mobileNo");

    if (!customer) {
        return res.status(200).json(new ApiResponse(200, null, "Customer not found."));
    }

    res.status(200).json(new ApiResponse(200, { customer }, "Customer found successfully."));
});

// Update customer details (e.g. name update dynamically from frontend if they want)
export const updateCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const assignedCompanyId = getAssignedCompanyId(req);

    const customer = await Customer.findOne({ _id: id, company: assignedCompanyId });

    if (!customer) {
        throw new ApiError(404, "Customer not found.");
    }

    if (name) {
        customer.name = name;
        await customer.save();
    }

    res.status(200).json(new ApiResponse(200, { customer }, "Customer updated successfully."));
});
