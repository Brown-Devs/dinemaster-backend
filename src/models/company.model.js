
// const CompanySchema = new Schema({
//     active: { type: Boolean, default: true },
//     name: { type: String, required: true },
//     companyId: { type: String, unique: true },
//     contactPhone: { type: String },
//     email: { type: String },
//     address: { type: String },
//     logo: { type: String },
// }, { timestamps: true });

// models/company.model.js (update)
import mongoose from "mongoose";
const { Schema } = mongoose;

const CompanySchema = new Schema({
    active: { type: Boolean, default: true },
    name: { type: String, required: true },
    companyId: { type: String, unique: true },
    contactPhone: { type: String },
    altContactPhone: { type: String },
    email: { type: String },
    address: { type: String },
    gstNo: { type: String },
    logo: { type: String },
    logoKey: { type: String },
    invoiceTerms: { type: String },
    modules: [{ type: String }],
    billing: {
        plan: { type: String, default: "" },
        subscriptionRef: { type: mongoose.Schema.Types.ObjectId, ref: "CompanySubscription" }
    },

}, { timestamps: true });

CompanySchema.index({ companyId: 1 }, { unique: true });
const Company = mongoose.model("Company", CompanySchema);
export default Company;
