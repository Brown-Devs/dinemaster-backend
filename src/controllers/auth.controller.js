import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

export const login = async (req, res, next) => {
    try {
        const { uniqueId, password } = req.body;
        if (!uniqueId || !password) {
            return next(new ApiError(400, "Unique ID and password are required"));
        }

        const user = await User.findOne({ uniqueId }).populate("company", "name companyId");
        if (!user) {
            return next(new ApiError(401, "Invalid credentials"));
        }

        if (!user.active) {
            return next(new ApiError(403, "Your account is disabled"));
        }

        const validatePassword = await bcrypt.compare(password, user.passwordHash);
        if (!validatePassword) {
            return next(new ApiError(401, "Invalid credentials"));
        }

        const payload = {
            id: user._id,
            role: user.role,
            company: user.company ? user.company._id : null
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || "default_secret", {
            expiresIn: "30d"
        });

        // Remove passwordHash from response
        const userObj = user.toObject();
        delete userObj.passwordHash;

        res.status(200).json({
            success: true,
            message: "Logged in successfully",
            token,
            user: userObj
        });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            user: req.user
        });
    } catch (error) {
        next(error);
    }
};
