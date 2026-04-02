import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";

const getAssignedCompanyId = (req, companyIdFromBody) => {
    // Destructure specifically from req.user (guaranteed present due to authenticate middleware)
    const { role, company } = req.user;
    let assignedCompanyId = company;

    if (role === "super_admin") {
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

// Create Category
export const createCategory = async (req, res, next) => {
    try {
        const { name, sku, image, companyId } = req.body;

        if (!name || name.trim() === "") {
            return next(new ApiError(400, "Category name is required."));
        }

        const assignedCompanyId = getAssignedCompanyId(req, companyId);

        // Check for duplicates
        const existingCategory = await Category.findOne({ name: name.trim(), company: assignedCompanyId });
        if (existingCategory) {
            return next(new ApiError(400, "A category with this name already exists for this company."));
        }

        const newCategory = new Category({
            name,
            sku,
            image,
            company: assignedCompanyId,
            active: true
        });

        await newCategory.save();

        res.status(201).json({
            success: true,
            message: "Category created successfully.",
            data: newCategory
        });
    } catch (error) {
        // Handle mongoose unique index errors just in case
        if (error.code === 11000) {
            return next(new ApiError(400, "Category already exists."));
        }
        next(error);
    }
};

// Get Categories (with pagination and search)
export const getCategories = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, companyId } = req.query;
        const assignedCompanyId = getAssignedCompanyId(req, companyId);

        const query = { company: assignedCompanyId };

        if (search) {
            // Re-map query words to lookahead groups to safely isolate and match multiple substring components
            const searchWords = search.trim().split(/\s+/);
            const regexString = "^" + searchWords.map(word => {
                const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return `(?=.*${escapedWord})`;
            }).join("");
            query.name = { $regex: regexString, $options: "i" };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const count = await Category.countDocuments(query);
        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: categories.length,
            total: count,
            page: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit)),
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

// Get All Active Categories (No pagination, limited fields, built for dropdowns)
export const getAllActiveCategories = async (req, res, next) => {
    try {
        const { search, companyId } = req.query;
        const assignedCompanyId = getAssignedCompanyId(req, companyId);

        const query = { 
            company: assignedCompanyId,
            active: true 
        };

        if (search) {
            const searchWords = search.trim().split(/\s+/);
            const regexString = "^" + searchWords.map(word => {
                const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return `(?=.*${escapedWord})`;
            }).join("");
            query.name = { $regex: regexString, $options: "i" };
        }

        // Using .select() to strictly return only id, name, and image
        const categories = await Category.find(query)
            .select("_id name image")
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

// Update Category
export const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, sku, image, active, companyId } = req.body;

        const assignedCompanyId = getAssignedCompanyId(req, companyId);

        const updateData = {};
        if (name) updateData.name = name;
        if (sku !== undefined) updateData.sku = sku;
        if (image !== undefined) updateData.image = image;
        if (active !== undefined) updateData.active = active;

        const updatedCategory = await Category.findOneAndUpdate(
            { _id: id, company: assignedCompanyId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return next(new ApiError(404, "Category not found or you do not have permission."));
        }

        res.status(200).json({
            success: true,
            message: "Category updated successfully.",
            data: updatedCategory
        });
    } catch (error) {
        if (error.code === 11000) {
            return next(new ApiError(400, "Category name already exists."));
        }
        next(error);
    }
};

// Delete Category
export const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const assignedCompanyId = getAssignedCompanyId(req, req.query.companyId || req.body.companyId);

        const deletedCategory = await Category.findOneAndDelete({ _id: id, company: assignedCompanyId });

        if (!deletedCategory) {
            return next(new ApiError(404, "Category not found or you do not have permission."));
        }

        res.status(200).json({
            success: true,
            message: "Category deleted successfully."
        });
    } catch (error) {
        next(error);
    }
};
