// models/companySubscription.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const CompanySubscriptionSchema = new Schema({
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true }, // inclusive
    status: { type: String, enum: ["active", "in_grace", "expired", "cancelled"], default: "active" },
    graceDays: { type: Number, default: 5 },
    history: [{ type: Schema.Types.ObjectId, ref: "BillingRecord" }]
}, { timestamps: true });

const CompanySubscription = mongoose.model("CompanySubscription", CompanySubscriptionSchema);
export default CompanySubscription;
