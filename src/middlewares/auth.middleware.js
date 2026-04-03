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
        // fallback to cookie (if present)
        if (!token && req.cookies) {
            token = req.cookies.accessToken;
        }

        // const token = req.cookies?.accessToken;
        if (!token) throw new ApiError(401, "Unauthorized: token missing");

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // token invalid or expired
            throw new ApiError(401, err.message || "Invalid token");
        }

        // Attach minimal user info; optionally fetch full user
        const user = await User.findById(payload.id).select("-passwordHash");
        if (!user) throw new ApiError(401, "Unauthorized: user not found");
        if (!user.active) throw new ApiError(403, "User is not active");

        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

// role check middleware factory
export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) throw new ApiError(401, "Unauthorized");
            if (!allowedRoles.includes(req.user.systemRole)) {
                throw new ApiError(403, "Forbidden: insufficient permissions");
            }
            next();
        } catch (err) {
            next(err);
        }
    };
};

export const authorizeSystemRoles = (...allowedSystemRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new ApiError(401, "Unauthorized");
            }

            const userSystemRole = req.user.systemRole;

            if (!userSystemRole) {
                throw new ApiError(403, "System role not assigned");
            }

            // Company admin always allowed unless explicitly blocked
            if (userSystemRole === "company_admin") {
                return next();
            }

            if (!allowedSystemRoles.includes(userSystemRole)) {
                throw new ApiError(403, "Forbidden: insufficient permissions");
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};
