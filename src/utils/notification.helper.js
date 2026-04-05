import webPush from 'web-push';
import Subscription from '../models/Subscription.model.js';
import User from '../models/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

// Configure VAPID details
webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a web push notification to specific users
 * @param {Array} userIds - Array of user IDs or a single user ID
 * @param {Object} payload - Notification payload { title, body, icon, url, ... }
 */
export const sendWebPushToUsers = async (userIds, payload) => {
    try {
        const ids = Array.isArray(userIds) ? userIds : [userIds];

        if (ids.length === 0) return;

        // Find active subscriptions for these users
        // Note: Subscription model has userId and claimed status
        const subscriptions = await Subscription.find({
            userId: { $in: ids },
            claimed: true
        }).lean();

        if (subscriptions.length === 0) {
            console.log(`[WebPush] No active subscriptions found for users: ${ids.join(', ')}`);
            return;
        }

        const pushPayload = JSON.stringify({
            title: payload.title || 'Notification',
            body: payload.body || '',
            icon: payload.icon || '/icon.png',
            data: {
                url: payload.url || '/',
                ...payload.data
            }
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webPush.sendNotification(sub.subscription, pushPayload);
                    return { success: true, deviceId: sub.deviceId };
                } catch (err) {
                    // Handle expired/invalid subscriptions
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`[WebPush] Removing expired subscription for device: ${sub.deviceId}`);
                        await Subscription.deleteOne({ _id: sub._id });
                    }
                    throw err;
                }
            })
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`[WebPush] Sent to ${succeeded} devices, ${failed} failed.`);

    } catch (error) {
        console.error('[WebPush] Error sending notifications:', error);
    }
};

/**
 * Send notification to kitchen staff for a new order
 * @param {String} companyId - The ID of the company
 * @param {Object} order - The order document
 */
export const notifyKitchenOfNewOrder = async (companyId, order) => {
    try {
        // Find users in the company who are NOT admins and have kitchen permissions
        // Permissions to check: 'modules.kitchen', 'kitchen.view', 'kitchen.update'
        const kitchenStaff = await User.find({
            company: companyId,
            systemRole: 'subadmin',
            permissions: {
                $in: ['kitchen.view', 'kitchen.update']
            },
            active: true
        }).select('_id').lean();

        const staffIds = kitchenStaff.map(u => u._id);

        if (staffIds.length === 0) {
            console.log(`[WebPush] No kitchen staff found for company ${companyId}`);
            return;
        }

        const payload = {
            title: 'New Order Received!',
            body: `Order #${order.orderId} - Type: ${order.orderType.toUpperCase()} - Total: ₹${order.totalAmount}`,
            url: `/dashboard/kitchen`, // Assuming this is the kitchen view URL
            data: {
                orderId: order._id,
                type: 'new_order'
            }
        };

        await sendWebPushToUsers(staffIds, payload);

    } catch (error) {
        console.error('[WebPush] Error notifying kitchen staff:', error);
    }
};
