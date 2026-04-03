import mongoose from "mongoose";

const { Schema } = mongoose;

const UserSchema = new Schema({
    active: { type: Boolean, default: true },

    // Auth
    uniqueId: {
        type: String,
        required: true,
        unique: true,
        match: [/^[a-z0-9_]+$/, 'Unique ID can only contain lowercase letters, numbers, and underscores without spaces.']
    },
    passwordHash: { type: String, required: true },

    // Profile
    name: { type: String },
    email: { type: String },
    phoneNo: { type: String },

    // Role/Designation (Dine Master specific)
    systemRole: { type: String, enum: ['super_admin', 'admin', 'subadmin'], default: 'subadmin' },

    // Relations
    company: { type: Schema.Types.ObjectId, ref: 'Company' },

    // Permissions
    permissions: [{ type: String }],

    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", UserSchema);
export default User;
