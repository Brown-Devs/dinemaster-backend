import mongoose from "mongoose";

const { Schema } = mongoose;

const CustomerSchema = new Schema({
    name: {
        type: String,
        trim: true
    },
    mobileNo: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    orders: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }]
}, {
    timestamps: true
});

// Ensure a mobile number is unique per company
CustomerSchema.index({ mobileNo: 1, company: 1 }, { unique: true });

const Customer = mongoose.model("Customer", CustomerSchema);
export default Customer;
