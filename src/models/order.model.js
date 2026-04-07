import mongoose from "mongoose";

const { Schema } = mongoose;

const OrderItemSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'BrandProduct',
        required: true
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    variant: {
        name: { type: String },
        price: { type: Number }
    },
    addOns: [{
        name: { type: String },
        price: { type: Number }
    }],
    quantity: {
        type: Number,
        required: true,
        min: 1
    }
}, { _id: false });

const OrderSchema = new Schema({
    orderId: {
        type: Number,
        index: true
    },
    company: {
        type: Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    customer: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    items: [OrderItemSchema],
    subTotal: {
        type: Number,
        required: true,
        default: 0
    },
    additionalDiscount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        enum: ['new', 'prepared', 'out_for_delivery', 'delivered', 'cancelled'],
        default: 'new'
    },
    paymentStatus: {
        type: String,
        enum: ['not_paid', 'paid'],
        default: 'not_paid'
    },
    payments: {
        cashAmount: { type: Number, default: 0 },
        onlineAmount: { type: Number, default: 0 }
    },
    orderType: {
        type: String,
        enum: ['dinein', 'delivery', 'packing'],
        required: true
    },
    address: {
        type: String,
        trim: true
    },
    table: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const Order = mongoose.model("Order", OrderSchema);
export default Order;
