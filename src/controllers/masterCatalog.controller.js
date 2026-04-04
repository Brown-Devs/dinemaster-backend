import MasterCatalog from "../models/masterCatalog.model.js";
import BrandProduct from "../models/brandProduct.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getAssignedCompanyId } from "../utils/companyHelper.js";
import mongoose from "mongoose";

// 1. Fetch paginated master catalogs
export const getMasterCatalogs = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    if (req.query.category) {
        query.category = req.query.category;
    }
    if (req.query.search) {
        const searchWords = req.query.search.trim().split(/\s+/);
        const regexString = "^" + searchWords.map(word => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return `(?=.*${escapedWord})`;
        }).join("");
        query.name = { $regex: regexString, $options: "i" };
    }

    const total = await MasterCatalog.countDocuments(query);
    const catalogs = await MasterCatalog.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, {
        masterProducts: catalogs,
        pagination: {
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalCount: total
        }
    }, "Master catalog products fetched successfully."));
});

// 2. Fetch all unique string categories organically present within the Master Catalog
export const getUniqueMasterCategories = asyncHandler(async (req, res) => {
    const categories = await MasterCatalog.distinct("category");

    return res.status(200).json(new ApiResponse(
        200,
        categories.filter(c => c && c.trim() !== "").sort(),
        "Unique master categories fetched successfully."
    ));
});

// 3. Fetch Master products NOT yet imported by the brand
export const getNotImportedMasterProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, category, companyId } = req.query;
    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    // Step 1: Identify all master product IDs already imported by the company
    const importedIds = await BrandProduct.find({ company: assignedCompanyId, masterCatalog: { $ne: null } })
        .distinct("masterCatalog");

    let query = {
        _id: { $nin: importedIds },
        active: { $ne: false }
    };

    // Filters same as getMasterCatalogs
    if (category) {
        query.category = category;
    }
    if (search) {
        const searchWords = search.trim().split(/\s+/);
        const regexString = "^" + searchWords.map(word => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return `(?=.*${escapedWord})`;
        }).join("");
        query.name = { $regex: regexString, $options: "i" };
    }

    const total = await MasterCatalog.countDocuments(query);
    const available = await MasterCatalog.find(query)
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, {
        masterProducts: available,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalCount: total
        }
    }, "Available master products for import fetched successfully."));
});

// 4. Create a new master catalog product (Super Admin only)
export const createMasterProduct = asyncHandler(async (req, res) => {
    if (req.user.systemRole !== "super_admin") {
        throw new ApiError(403, "Only super admins can create the master catalog.");
    }

    const { name, category, description, variants, imageUrl, active } = req.body;

    if (!name || !variants || variants.length === 0) {
        throw new ApiError(400, "Name and at least one variant are required.");
    }

    const newProduct = await MasterCatalog.create({
        name,
        category,
        description,
        variants,
        imageUrl,
        active: active !== undefined ? active : true
    });

    return res.status(201).json(new ApiResponse(201, newProduct, "Master catalog product created successfully."));
});

// 5. Update a master catalog product (Super Admin only)
export const updateMasterProduct = asyncHandler(async (req, res) => {
    // Controller-level role enforcement
    if (req.user.systemRole !== "super_admin") {
        throw new ApiError(403, "Only super admins can update the master catalog.");
    }

    const { id } = req.params;
    const { name, category, description, variants, imageUrl, active } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid master catalog ID.");
    }

    const updated = await MasterCatalog.findByIdAndUpdate(
        id,
        {
            $set: {
                ...(name && { name }),
                ...(category && { category }),
                ...(description !== undefined && { description }),
                ...(variants && { variants }),
                ...(imageUrl && { imageUrl }),
                ...(active !== undefined && { active })
            }
        },
        { new: true, runValidators: true }
    );

    if (!updated) {
        throw new ApiError(404, "Master catalog product not found.");
    }

    return res.status(200).json(new ApiResponse(200, updated, "Master catalog product updated successfully."));
});
