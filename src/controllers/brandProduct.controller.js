import mongoose from "mongoose";
import BrandProduct from "../models/brandProduct.model.js";
import MasterCatalog from "../models/masterCatalog.model.js";
import Category from "../models/category.model.js";
import { ApiError } from "../utils/ApiError.js";

const getAssignedCompanyId = (req, companyIdFromBody) => {
    // Destructure specifically from req.user (guaranteed present due to authenticate middleware)
    const { role, company, _id: currentUserId } = req.user;
    let assignedCompanyId = company;

    if (role === "super_admin") {
        if (!companyIdFromBody) {
            throw new ApiError(400, "Super admin must provide a valid companyId.");
        }
        assignedCompanyId = companyIdFromBody;
    }
    if (!assignedCompanyId) {
        throw new ApiError(400, "Company ID could not be resolved.");
    }
    return { assignedCompanyId, currentUserId };
};

// 1. Bulk Clone Master Catalog Products logic
export const bulkImportFromMaster = async (req, res, next) => {
    try {
        const { masterCatalogIds, companyId } = req.body;

        if (!Array.isArray(masterCatalogIds) || masterCatalogIds.length === 0) {
            return next(new ApiError(400, "Please provide an array of masterCatalogIds."));
        }

        const { assignedCompanyId, currentUserId } = getAssignedCompanyId(req, companyId);

        // Fetch all requested items from the master catalog
        const masterProducts = await MasterCatalog.find({ _id: { $in: masterCatalogIds } });
        
        if (masterProducts.length === 0) {
            return next(new ApiError(404, "None of the provided master catalog IDs were found."));
        }

        // Validate duplicates. We should avoid importing the same masterCatalog item twice for the same company.
        const existingBrandProducts = await BrandProduct.find({
            company: assignedCompanyId,
            masterCatalog: { $in: masterCatalogIds }
        });

        const existingMasterIds = existingBrandProducts.map(bp => bp.masterCatalog.toString());

        // We only want to process items that are actually new to the brand
        const itemsToImport = masterProducts.filter(m => !existingMasterIds.includes(m._id.toString()));

        if (itemsToImport.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No new products to import (they may already exist for this brand).",
                importedCount: 0
            });
        }

        // Prepare new insertions mapped exactly from the master records
        const newProducts = itemsToImport.map(masterObj => {
            // Safely clone variants and default discountedPrice to actualPrice if missing to satisfy tight Model validations
            const mappedVariants = (masterObj.variants || []).map(v => ({
                name: v.name,
                actualPrice: v.actualPrice,
                discountedPrice: v.discountedPrice !== undefined ? v.discountedPrice : v.actualPrice
            }));

            return {
                name: masterObj.name,
                description: masterObj.description,
                variants: mappedVariants,
                iconURL: masterObj.iconURL,
                company: assignedCompanyId,
                masterCatalog: masterObj._id,
                active: true,
                inStock: true,
                orderCount: 0
            };
        });

        if (newProducts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No new products to import (they may already exist for this brand).",
                importedCount: 0
            });
        }

        const inserted = await BrandProduct.insertMany(newProducts);

        res.status(201).json({
            success: true,
            message: `Successfully imported ${inserted.length} master products into the brand catalog.`,
            importedCount: inserted.length,
            requestedCount: masterCatalogIds.length,
            data: inserted
        });
    } catch (error) {
        next(error);
    }
};

// 2. Singular Manual Brand Product creation
export const createBrandProduct = async (req, res, next) => {
    try {
        const { name, category, description, variants, iconURL, companyId } = req.body;

        const { assignedCompanyId, currentUserId } = getAssignedCompanyId(req, companyId);

        if (!name || name.trim() === "") {
            return next(new ApiError(400, "Product name is required."));
        }

        let mappedCategoryId = undefined;
        if (category) {
            // Support whether the frontend sends the Category's internal unique _id or its plain text name
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

        // Construct new document dynamically resolving any manual fields supplied in the request form
        const newBrandProduct = new BrandProduct({
            name,
            category: mappedCategoryId, // Safely assigning only if thoroughly verified
            description,
            variants: variants || [],
            iconURL: iconURL || { imageURL: "" },
            company: assignedCompanyId,
            active: true,
            inStock: true,
            orderCount: 0
            // masterCatalog will remain beautifully empty/null since it's an organic native manual product
        });

        await newBrandProduct.save();

        res.status(201).json({
            success: true,
            message: "Brand product created successfully.",
            data: newBrandProduct
        });
    } catch (error) {
        next(error);
    }
};
