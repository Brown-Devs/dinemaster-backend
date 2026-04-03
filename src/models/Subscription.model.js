import mongoose from 'mongoose';
const { Schema } = mongoose;

const SubscriptionSchema = new Schema({
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    deviceId: { type: String, required: true, index: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String },
    subscription: { type: Schema.Types.Mixed, required: true },
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop','app'], default: 'mobile' },
    deviceInfo: {
        ua: String,
        platform: String,
        isMobile: Boolean,
        isTablet: Boolean,
        isApp: Boolean,
    },
    claimed: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

SubscriptionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

 export default Subscription;
