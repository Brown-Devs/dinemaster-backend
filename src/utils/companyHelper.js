import { ApiError } from "./ApiError.js";

/**
 * Resolves the companyId for the request, allowing super_admin to override 
 * for management purposes.
 */
export const getAssignedCompanyId = (req, companyIdFromBody) => {
    const { systemRole, company, _id: currentUserId } = req.user;
    let assignedCompanyId = company;

    if (systemRole === "super_admin") {
        if (!companyIdFromBody) {
            throw new ApiError(400, "Super admin must provide a valid companyId.");
        }
        assignedCompanyId = companyIdFromBody;
    }
    
    if (!assignedCompanyId) {
        throw new ApiError(400, "Company ID could not be resolved.");
    }
    
    return { assignedCompanyId, currentUserId };
};
