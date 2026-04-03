// models/billingRecord.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const BillingRecordSchema = new Schema({
    subscription: { type: Schema.Types.ObjectId, ref: "CompanySubscription", required: true },
    company: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    amount: { type: Number, required: true },
    monthsPurchased: { type: Number, default: 1 },
    paidAt: { type: Date, required: true },
    paymentMethod: { type: String, default: "manual" }, // manual | razorpay | stripe
    gatewayRefId: { type: String },
    notes: { type: String },
    newPeriodStart: { type: Date },
    newPeriodEnd: { type: Date }
}, { timestamps: true });

export default mongoose.model("BillingRecord", BillingRecordSchema);
