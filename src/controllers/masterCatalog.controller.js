import MasterCatalog from "../models/masterCatalog.model.js";

// Fetch paginated master catalogs
export const getMasterCatalogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        // Optional filter based on category or search keyword
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

        res.status(200).json({
            success: true,
            count: catalogs.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data: catalogs
        });
    } catch (error) {
        next(error);
    }
};

// Fetch all unique string categories organically present within the Master Catalog
export const getUniqueMasterCategories = async (req, res, next) => {
    try {
        const categories = await MasterCatalog.distinct("category");
        
        res.status(200).json({
            success: true,
            // Filter out null outputs inherently created by distinct operations on incomplete DB states
            data: categories.filter(c => c && c.trim() !== "").sort()
        });
    } catch (error) {
        next(error);
    }
};
