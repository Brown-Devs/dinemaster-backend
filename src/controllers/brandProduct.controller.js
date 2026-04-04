import mongoose from "mongoose";
import BrandProduct from "../models/brandProduct.model.js";
import MasterCatalog from "../models/masterCatalog.model.js";
import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getAssignedCompanyId } from "../utils/companyHelper.js";

// 1. Bulk Clone Master Catalog Products logic
export const bulkImportFromMaster = asyncHandler(async (req, res) => {
    const { masterCatalogIds, companyId } = req.body;

    if (!Array.isArray(masterCatalogIds) || masterCatalogIds.length === 0) {
        throw new ApiError(400, "Please provide an array of masterCatalogIds.");
    }

    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    // Fetch all requested items from the master catalog
    const masterProducts = await MasterCatalog.find({ _id: { $in: masterCatalogIds } });

    if (masterProducts.length === 0) {
        throw new ApiError(404, "None of the provided master catalog IDs were found.");
    }

    // Validate duplicates. We should avoid importing the same masterCatalog item twice for the same company.
    const existingBrandProducts = await BrandProduct.find({
        company: assignedCompanyId,
        masterCatalog: { $in: masterCatalogIds }
    });

    const existingMasterIds = existingBrandProducts.map(bp => bp.masterCatalog.toString());

    // We only want to process items that are actually new to the brand
    const itemsToImport = masterProducts.filter(m => !existingMasterIds.includes(m._id.toString()));

    // Handle Category Mapping
    const masterCategoryNames = [...new Set(masterProducts.map(p => p.category).filter(Boolean))];

    // Find or create categories for this company
    const existingCategories = await Category.find({
        company: assignedCompanyId,
        name: { $in: masterCategoryNames }
    });

    const existingCatMap = {};
    existingCategories.forEach(c => { existingCatMap[c.name] = c._id; });

    const missingCatNames = masterCategoryNames.filter(name => !existingCatMap[name]);

    if (missingCatNames.length > 0) {
        const newCategories = await Category.insertMany(
            missingCatNames.map(name => ({ name, company: assignedCompanyId }))
        );
        newCategories.forEach(c => { existingCatMap[c.name] = c._id; });
    }

    const importedProducts = [];
    for (const masterProd of masterProducts) {
        // Double check not already imported
        const existing = await BrandProduct.findOne({ masterCatalog: masterProd._id, company: assignedCompanyId });
        if (existing) continue;

        const newBrandProduct = new BrandProduct({
            name: masterProd.name,
            description: masterProd.description,
            category: masterProd.category ? existingCatMap[masterProd.category] : undefined,
            variants: masterProd.variants,
            company: assignedCompanyId,
            masterCatalog: masterProd._id,
            imageUrl: masterProd.imageUrl || "",
            active: true,
            inStock: true,
            orderCount: 0
        });

        await newBrandProduct.save();
        importedProducts.push(newBrandProduct);
    }

    return res.status(201).json(new ApiResponse(
        201,
        {
            importedCount: importedProducts.length,
            requestedCount: masterCatalogIds.length,
            data: importedProducts
        },
        `Successfully imported ${importedProducts.length} master products into the brand catalog.`
    ));
});

// 2. Singular Manual Brand Product creation
export const createBrandProduct = asyncHandler(async (req, res) => {
    const { name, category, description, variants, imageUrl, companyId } = req.body;

    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    if (!name || name.trim() === "") {
        throw new ApiError(400, "Product name is required.");
    }

    let mappedCategoryId = undefined;
    if (category) {
        const isValidId = mongoose.Types.ObjectId.isValid(category);
        const query = { company: assignedCompanyId };

        if (isValidId) {
            query._id = category;
        } else {
            query.name = category;
        }

        const existingCategory = await Category.findOne(query);
        if (existingCategory) {
            mappedCategoryId = existingCategory._id;
        }
    }

    const newBrandProduct = new BrandProduct({
        name,
        category: mappedCategoryId,
        description,
        variants: variants || [],
        imageUrl: imageUrl || "",
        company: assignedCompanyId,
        active: true,
        inStock: true,
    });

    if (category) {
        // Find if category name or ID already exists for this company
        const isValidId = mongoose.Types.ObjectId.isValid(category);
        const catQuery = { company: assignedCompanyId };
        if (isValidId) catQuery._id = category;
        else catQuery.name = category;

        const existingCategory = await Category.findOne(catQuery);
        if (existingCategory) {
            newBrandProduct.category = existingCategory._id;
        } else if (!isValidId) {
            // Create new category if name provided doesn't exist
            const newCat = await Category.create({ name: category, company: assignedCompanyId });
            newBrandProduct.category = newCat._id;
        }
    }

    await newBrandProduct.save();

    return res.status(201).json(
        new ApiResponse(201, newBrandProduct, "Product created successfully")
    );
});

// 3. Fetch Brand Products (Paginated with Filters)
export const getBrandProducts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, type, category, companyId } = req.query;
    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { company: assignedCompanyId };

    // Search filter
    if (search) {
        const searchWords = search.trim().split(/\s+/);
        const regexString = "^" + searchWords.map(word => {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return `(?=.*${escapedWord})`;
        }).join("");
        query.name = { $regex: regexString, $options: "i" };
    }

    // Type filter: All, Imported, Manual
    if (type === "imported") {
        query.masterCatalog = { $ne: null };
    } else if (type === "manual") {
        query.masterCatalog = null;
    }

    // Category filter (expects ObjectId)
    if (category && mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
    }

    const totalCount = await BrandProduct.countDocuments(query);
    const products = await BrandProduct.find(query)
        .populate("category", "name addOns")
        .populate("masterCatalog", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    return res.status(200).json(new ApiResponse(200, {
        products,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount
        }
    }, "Brand products fetched successfully."));
});

// 4. Update Brand Product
export const updateBrandProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, category, description, variants, imageUrl, active, inStock, companyId } = req.body;
    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid product ID.");
    }

    const product = await BrandProduct.findOne({ _id: id, company: assignedCompanyId });
    if (!product) {
        throw new ApiError(404, "Product not found or access denied.");
    }

    // Update fields
    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    if (variants) product.variants = variants;
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (active !== undefined) product.active = active;
    if (inStock !== undefined) product.inStock = inStock;

    if (category) {
        const isValidId = mongoose.Types.ObjectId.isValid(category);
        const catQuery = { company: assignedCompanyId };
        if (isValidId) catQuery._id = category;
        else catQuery.name = category;

        const existingCategory = await Category.findOne(catQuery);
        if (existingCategory) {
            product.category = existingCategory._id;
        }
    } else if (category === null) {
        product.category = undefined;
    }

    await product.save();

    return res.status(200).json(new ApiResponse(200, product, "Product updated successfully."));
});

// 5. Delete Brand Product
export const deleteBrandProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid product ID.");
    }

    const product = await BrandProduct.findOneAndDelete({ _id: id, company: assignedCompanyId });
    if (!product) {
        throw new ApiError(404, "Product not found or access denied.");
    }

    return res.status(200).json(new ApiResponse(200, null, "Product deleted successfully."));
});

// 6. Bulk Delete Brand Products
export const bulkDeleteBrandProducts = asyncHandler(async (req, res) => {
    const { ids, companyId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, "Please provide an array of product IDs to delete.");
    }

    const { assignedCompanyId } = getAssignedCompanyId(req, companyId);

    const result = await BrandProduct.deleteMany({
        _id: { $in: ids },
        company: assignedCompanyId
    });

    return res.status(200).json(new ApiResponse(200, { deletedCount: result.deletedCount }, `Successfully deleted ${result.deletedCount} products.`));
});
