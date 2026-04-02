import mongoose from "mongoose";

const { Schema } = mongoose;

const CategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    sku: {
        type: String,
        trim: true
    },
    image: {
        type: String,
        default: ""
    },
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Prevent duplicate categories with the exact same name for a single company
CategorySchema.index({ name: 1, company: 1 }, { unique: true });

const Category = mongoose.model("Category", CategorySchema);
export default Category;
