// controllers/auth.controller.js
import Session from "../models/session.model.js";
import SessionHistory from "../models/sessionHistory.model.js";
import Subscription from "../models/Subscription.model.js";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import Company from "../models/company.model.js";

// export const login = async (req, res, next) => {
//     try {
//         const { uniqueId, password } = req.body;
//         if (!uniqueId || !password) {
//             return next(new ApiError(400, "Unique ID and password are required"));
//         }

//         const user = await User.findOne({ uniqueId }).populate("company", "name companyId");
//         if (!user) {
//             return next(new ApiError(401, "Invalid credentials"));
//         }

//         if (!user.active) {
//             return next(new ApiError(403, "Your account is disabled"));
//         }

//         const validatePassword = await bcrypt.compare(password, user.passwordHash);
//         if (!validatePassword) {
//             return next(new ApiError(401, "Invalid credentials"));
//         }

//         const payload = {
//             id: user._id,
//             role: user.role,
//             company: user.company ? user.company._id : null
//         };

//         const token = jwt.sign(payload, process.env.JWT_SECRET || "default_secret", {
//             expiresIn: "30d"
//         });

//         // Remove passwordHash from response
//         const userObj = user.toObject();
//         delete userObj.passwordHash;

//         res.status(200).json({
//             success: true,
//             message: "Logged in successfully",
//             token,
//             user: userObj
//         });
//     } catch (error) {
//         next(error);
//     }
// };

/**
 * Archive session -> create SessionHistory, delete subscription, then DELETE the session doc.
 */
async function archiveAndDeleteSession(session) {
    try {
        await SessionHistory.create({
            sessionId: session._id,
            userId: session.userId,
            deviceId: session.deviceId,
            deviceType: session.deviceType,
            deviceName: session.deviceName,
            ua: session.ua,
            ip: session.ip,
            startedAt: session.createdAt,
            endedAt: new Date(),
            durationMs: new Date() - new Date(session.createdAt)
        });
    } catch (e) {
        console.warn("session history create failed", e?.message || e);
    }

    // delete subscription for this deviceId (best-effort)
    if (session.deviceId) {
        try {
            await Subscription.deleteOne({ deviceId: session.deviceId });
        } catch (e) {
            console.warn("delete subscription failed", e?.message || e);
        }
    }

    // finally remove the session document
    try {
        await Session.deleteOne({ _id: session._id });
    } catch (e) {
        console.warn("delete session failed", e?.message || e);
    }
}

/**
 * Keep only latest N sessionHistory per user
 */
async function pruneSessionHistoryForUser(userId, keep = 5) {
    const toRemove = await SessionHistory
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(keep)
        .select("_id")
        .lean();

    if (toRemove.length) {
        const ids = toRemove.map(d => d._id);
        await SessionHistory.deleteMany({ _id: { $in: ids } });
    }
}

export const login = asyncHandler(async (req, res) => {
    const { uniqueId, password, deviceId, deviceType = "desktop", deviceName } = req.body;

    // 1) find user
    const user = await User.findOne({ uniqueId });
    if (!user) throw new ApiError(404, "User not found");
    if (!user.active) throw new ApiError(403, "User inactive");

    // 2) verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid password");

    // 3) COMPANY ACTIVE CHECK (if user belongs to a company)
    if (user.company) {
        const company = await Company.findById(user.company).lean();
        if (!company) {
            throw new ApiError(403, "User's company not found. Contact support.");
        }
        if (!company.active) {
            throw new ApiError(403, "Company is inactive. Please contact support to reactivate.");
        }

        // 4) COMPANY SUBSCRIPTION CHECK
        // const compSub = await CompanySubscription.findOne({ company: company._id }).lean();
        // if (!compSub) {
        //     // If you want to allow login when there's no subscription record, change this behavior.
        //     throw new ApiError(403, "Company subscription not found. Please contact support to continue services.");
        // }

        // const now = new Date();
        // const periodEnd = new Date(compSub.currentPeriodEnd);
        // const graceEnd = addDays(periodEnd, compSub.graceDays ?? 0);

        // if (now > graceEnd) {
        //     try {
        //         await CompanySubscription.updateOne({ _id: compSub._id }, { $set: { status: "expired" } });
        //     } catch (e) {
        //         console.warn("Failed to update subscription status to expired", e?.message || e);
        //     }
        //     throw new ApiError(403, "Company subscription has been expired, please make payment and contact support to continue services.");
        // }
        // Note: if you want to block during grace period change logic to if(now > periodEnd) { throw ... }
    }

    // 5) mobile session handling (existing behavior)
    const normalizedDeviceType =
        deviceType === "app" ? "app" : (deviceType === "mobile" ? "mobile" : "desktop");

    const existingSessions = await Session.find({
        userId: user._id,
        deviceType: normalizedDeviceType
    }).lean();

    if (existingSessions.length) {
        await Promise.all(
            existingSessions.map(s => archiveAndDeleteSession(s))
        );
    }

    // 6) create new session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await Session.create({
        _id: sessionId,
        userId: user._id,
        deviceId: deviceId || null,
        deviceType: normalizedDeviceType,
        deviceName,
        ua: req.headers["user-agent"] || null,
        ip: req.ip,
        expiresAt,
        active: true
    });

    const token = jwt.sign(
        { id: user._id, uniqueId: user.uniqueId, role: user.role, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "60d" }
    );

    const cleanUser = await User.findById(user._id)
        .select("-passwordHash").lean();

    let companyDetails = null;

    if (cleanUser?.company) {
        companyDetails = await Company.findById(cleanUser.company)
            .select("-_id name")
            .lean();
    }

    const options = {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 24 * 60 * 60 * 1000
    };

    return res
        .cookie("accessToken", token, options)
        .json(new ApiResponse(200, {
            user: {
                ...cleanUser,
                companyDetails
            },
            accessToken: token,
            sessionId
        }, "User Logged in Successfully"));
});

// LOGOUT
export const logout = asyncHandler(async (req, res) => {
    try {
        const sessionIdFromBody = req.body?.sessionId || null;
        const deviceIdFromBody = req.body?.deviceId || null;

        let session = null;

        if (sessionIdFromBody) {
            session = await Session.findById(sessionIdFromBody).lean();
            // If session exists and belongs to different authenticated user, forbid
            if (session && req.user && req.user._id && session.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ ok: false, error: "Forbidden: session does not belong to authenticated user" });
            }
        }

        if (!session && deviceIdFromBody) {
            session = await Session.findOne({ deviceId: deviceIdFromBody }).lean();
        }

        if (!session) {
            if (deviceIdFromBody) await Subscription.deleteOne({ deviceId: deviceIdFromBody });
            try { res.clearCookie("accessToken"); } catch (e) { }
            return res.json({ ok: true, message: "No active session found; subscription cleaned if provided." });
        }

        // archive and delete session
        await archiveAndDeleteSession(session);

        // prune histories to last 5
        await pruneSessionHistoryForUser(session.userId, 5);

        try { res.clearCookie("accessToken"); } catch (e) { }
        return res.json({ ok: true, message: "Logged out and session archived" });
    } catch (err) {
        console.error("logout error", err);
        res.status(500).json({ error: "internal" });
    }
});

// GET SESSION (unchanged)
export const getSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId).lean();
    if (!session || !session.active) throw new ApiError(404, "Session not found");
    return res.json({ ok: true });
});


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
