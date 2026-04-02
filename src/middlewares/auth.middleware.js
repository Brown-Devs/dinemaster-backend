import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import User from "../models/user.model.js";

export const authenticate = async (req, res, next) => {
    try {
        let token = null;
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) throw new ApiError(401, "Unauthorized: token missing");

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            throw new ApiError(401, "Invalid token");
        }

        const user = await User.findById(payload.id).select("-passwordHash");
        if (!user) throw new ApiError(401, "Unauthorized: user not found");
        if (!user.active) throw new ApiError(403, "User is not active");

        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) throw new ApiError(401, "Unauthorized");
            if (!allowedRoles.includes(req.user.role)) {
                throw new ApiError(403, "Forbidden: insufficient role permissions");
            }
            next();
        } catch (err) {
            next(err);
        }
    };
};
