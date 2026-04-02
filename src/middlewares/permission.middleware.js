import { ApiError } from "../utils/ApiError.js";

export const checkPermissions = (required) => {
    const requiredList = Array.isArray(required) ? required : [required];

    return (req, res, next) => {
        try {
            if (!req.user) throw new ApiError(401, "Unauthorized");

            const { role, permissions } = req.user;

            // super_admin bypass
            if (role === "super_admin") {
                return next();
            }

            if (!Array.isArray(permissions)) {
                throw new ApiError(403, "Forbidden: permissions not defined");
            }

            const hasPermission = requiredList.some((reqPerm) => permissions.includes(reqPerm));

            if (!hasPermission) {
                throw new ApiError(403, `Forbidden: missing permissions (${requiredList.join(", ")})`);
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};
