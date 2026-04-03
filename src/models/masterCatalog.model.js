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
        required: true
    }
}, { _id: false });

const MasterCatalogSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        // required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        trim: true
    },
    variants: [VariantSchema],

    // Some lines have this as a stringified object '{"imageURL":"..."}' or similar.
    // Making it a Mixed type or an Object to safely embed whatever is parsed from the CSV.
    iconURL: {
        imageURL: { type: String, default: "" }
    },

    // The date from the CSV will map here
    createdAt: {
        type: Date,
        default: Date.now
    },

    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true, // will automatically manage updatedAt
});

const MasterCatalog = mongoose.model("MasterCatalog", MasterCatalogSchema);
export default MasterCatalog;
