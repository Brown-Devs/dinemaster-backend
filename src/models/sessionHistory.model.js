import mongoose from "mongoose";
const { Schema } = mongoose;

const SessionHistorySchema = new Schema({
    sessionId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceId: { type: String },
    deviceType: { type: String },
    deviceName: { type: String },
    ua: { type: String },
    ip: { type: String },
    startedAt: { type: Date },
    endedAt: { type: Date },
    durationMs: { type: Number },
    meta: Schema.Types.Mixed
}, { timestamps: true });

export default mongoose.model("SessionHistory", SessionHistorySchema);
