import Subscription from "../models/Subscription.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

// ✅ Save / Update Push Subscription
export const saveSubscription = asyncHandler(async (req, res) => {
    const { subscription, deviceId, deviceInfo = {}, sessionId } = req.body;

    if (!subscription || !deviceId) {
        throw new ApiError(400, "missing subscription or deviceId");
    }

    // derive deviceType server-side if client didn't send it
    const deviceType = (() => {
        try {
            if (typeof deviceInfo.isApp !== "undefined" && deviceInfo.isApp) return "app";
            if (typeof deviceInfo.isMobile !== "undefined" && deviceInfo.isMobile) return "mobile";
            if (typeof deviceInfo.isTablet !== "undefined" && deviceInfo.isTablet) return "tablet";
            return "desktop";
        } catch (e) {
            return "mobile";
        }
    })();

    const companyId = req.user.company; // always trust server side
    const userId = req.user._id;

    const upsertData = {
        companyId,
        deviceId,
        userId,
        sessionId: sessionId || req.user.sessionId || null,
        subscription,
        deviceInfo,
        deviceType,
        claimed: true,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
    };

    // If this is app or browser in mobile, delete other mobile subscriptions for this user (single subscription rule)
    if (deviceType === "mobile" || deviceType === "app") {
        try {
            await Subscription.deleteMany({ 
                userId, 
                deviceType: deviceType, 
                deviceId: { $ne: deviceId } 
            });
        } catch (e) {
            console.warn("cleanup old subscriptions failed", e?.message || e);
        }
    }

    // upsert by deviceId (unique)
    await Subscription.updateOne(
        { deviceId },
        { $set: upsertData },
        { upsert: true }
    );

    return res.status(200).json(
        new ApiResponse(200, { deviceId, deviceType }, "Subscription saved successfully")
    );
});

// ✅ Delete Subscription (on logout or manual)
export const deleteSubscription = asyncHandler(async (req, res) => {
    const { deviceId } = req.body;
    if (!deviceId) {
        throw new ApiError(400, "deviceId missing");
    }

    await Subscription.deleteOne({ deviceId });

    return res.status(200).json(
        new ApiResponse(200, {}, "Subscription deleted successfully")
    );
});
