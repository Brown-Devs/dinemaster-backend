import mongoose from "mongoose";

const { Schema } = mongoose;

const VariantSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    actualPrice: {
        type: Number,
        required: true
    },
    discountedPrice: {
        type: Number,
        // required: true
    }
}, { _id: false });

const BrandProductSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        index: true
    },
    description: {
        type: String,
        trim: true
    },
    variants: [VariantSchema],

    imageURL: {
        type: String,
        default: ""
    },

    // --- Addons ---

    // Reference to the company (brand)
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },

    // Reference to the master catalog product it was imported from
    masterCatalog: {
        type: Schema.Types.ObjectId,
        ref: 'MasterCatalog'
    },

    // Order metrics
    orderCount: {
        type: Number,
        default: 0
    },

    // Status flags
    active: {
        type: Boolean,
        default: true
    },
    inStock: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true, // will automatically manage createdAt and updatedAt
});

const BrandProduct = mongoose.model("BrandProduct", BrandProductSchema);
export default BrandProduct;
