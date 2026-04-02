import mongoose from "mongoose";
const { Schema } = mongoose;

const CompanySchema = new Schema({
    active: { type: Boolean, default: true },
    name: { type: String, required: true },
    companyId: { type: String, unique: true },
    contactPhone: { type: String },
    email: { type: String },
    address: { type: String },
    logo: { type: String },
}, { timestamps: true });

CompanySchema.index({ companyId: 1 }, { unique: true });
const Company = mongoose.model("Company", CompanySchema);
export default Company;
