import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const { Schema } = mongoose;

const SessionSchema = new Schema({
    _id: { type: String, default: () => uuidv4() },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String, index: true },
    deviceType: { type: String, enum: ["app", "mobile", "tablet", "desktop"], required: true },
    deviceName: { type: String },
    ua: { type: String },
    ip: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
    meta: Schema.Types.Mixed
}, { strict: false });

SessionSchema.index({ userId: 1 });
SessionSchema.index({ deviceId: 1 });
SessionSchema.index({ active: 1, deviceType: 1 });

const Session = mongoose.model("Session", SessionSchema);
export default Session;
