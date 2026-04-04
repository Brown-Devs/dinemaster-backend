import mongoose from "mongoose";

const { Schema } = mongoose;

const AddOnSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
}, { _id: false });

const CategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    imageUrl: {
        type: String,
        default: ""
    },
    addOns: [AddOnSchema],

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
