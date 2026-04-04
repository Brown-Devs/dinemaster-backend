import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAssignedCompanyId = (req, companyIdFromBody) => {
    // Destructure specifically from req.user (guaranteed present due to authenticate middleware)
    const { systemRole, company } = req.user;
    let assignedCompanyId = company;

    if (systemRole === "super_admin") {
        if (!companyIdFromBody && !assignedCompanyId) {
            throw new ApiError(400, "Super admin must provide a valid companyId.");
        }
        assignedCompanyId = companyIdFromBody || assignedCompanyId;
    }
    if (!assignedCompanyId) {
        throw new ApiError(400, "Company ID could not be resolved.");
    }
    return assignedCompanyId;
};

// Helper for regex escaping
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Create Category
export const createCategory = asyncHandler(async (req, res) => {
    const { name, imageUrl, addOns, companyId } = req.body;

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Category name is required.");
    }

    const assignedCompanyId = getAssignedCompanyId(req, companyId);

    // Check for duplicates
    const existingCategory = await Category.findOne({ name: name.trim(), company: assignedCompanyId });
    if (existingCategory) {
        throw new ApiError(400, "A category with this name already exists for this company.");
    }

    const newCategory = new Category({
        name,
        imageUrl: imageUrl || "",
        addOns: Array.isArray(addOns) ? addOns : [],
        company: assignedCompanyId,
        active: true
    });

    try {
        await newCategory.save();
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(400, "Category already exists.");
        }
        throw error;
    }

    res.status(201).json(new ApiResponse(201, { category: newCategory }, "Category created successfully."));
});

// Get Categories (with pagination and search)
export const getCategories = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, companyId } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req, companyId);

    const query = { company: assignedCompanyId };

    if (search) {
        const searchWords = search.trim().split(/\s+/);
        const regexString = "^" + searchWords.map(word => {
            const escapedWord = escapeRegex(word);
            return `(?=.*${escapedWord})`;
        }).join("");
        query.name = { $regex: regexString, $options: "i" };
    }

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, parseInt(limit, 10));
    const skip = (parsedPage - 1) * parsedLimit;

    const count = await Category.countDocuments(query);
    const categories = await Category.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit);

    res.status(200).json(new ApiResponse(200, {
        categories,
        totalCount: count,
        pagination: {
            page: parsedPage,
            limit: parsedLimit,
            hasNextPage: parsedPage * parsedLimit < count
        }
    }, "Categories retrieved successfully."));
});

// Get All Active Categories (No pagination, limited fields, built for dropdowns)
export const getAllActiveCategories = asyncHandler(async (req, res) => {
    const { search, companyId } = req.query;
    const assignedCompanyId = getAssignedCompanyId(req, companyId);

    const query = { 
        company: assignedCompanyId,
        active: true 
    };

    if (search) {
        const searchWords = search.trim().split(/\s+/);
        const regexString = "^" + searchWords.map(word => {
            const escapedWord = escapeRegex(word);
            return `(?=.*${escapedWord})`;
        }).join("");
        query.name = { $regex: regexString, $options: "i" };
    }

    // Using .select() to strictly return only id, name, imageUrl and addOns
    const categories = await Category.find(query)
        .select("_id name imageUrl addOns")
        .sort({ name: 1 });

    res.status(200).json(new ApiResponse(200, {
        count: categories.length,
        categories
    }, "Active categories retrieved successfully."));
});

// Update Category
export const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, imageUrl, addOns, active, companyId } = req.body;

    const assignedCompanyId = getAssignedCompanyId(req, companyId);

    const updateData = {};
    if (name) updateData.name = name;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (addOns !== undefined) updateData.addOns = addOns;
    if (active !== undefined) updateData.active = active;

    try {
        const updatedCategory = await Category.findOneAndUpdate(
            { _id: id, company: assignedCompanyId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            throw new ApiError(404, "Category not found or you do not have permission.");
        }

        res.status(200).json(new ApiResponse(200, { category: updatedCategory }, "Category updated successfully."));
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(400, "Category name already exists.");
        }
        throw error;
    }
});

// Delete Category
export const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const assignedCompanyId = getAssignedCompanyId(req, req.query.companyId || req.body.companyId);

    const deletedCategory = await Category.findOneAndDelete({ _id: id, company: assignedCompanyId });

    if (!deletedCategory) {
        throw new ApiError(404, "Category not found or you do not have permission.");
    }

    res.status(200).json(new ApiResponse(200, null, "Category deleted successfully."));
});
