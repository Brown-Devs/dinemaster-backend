import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import Company from "../models/company.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

// Create User
export const createUser = asyncHandler(async (req, res) => {
    const { name, uniqueId, email, phoneNo, password, systemRole, companyId, permissions } = req.body;
    const creatorRole = req.user.systemRole;

    if (!uniqueId) throw new ApiError(400, "uniqueId is required for the user");
    if (!name) throw new ApiError(400, "name is required");
    if (!password || password.length < 6) throw new ApiError(400, "password is required (min 6 chars)");

    // Validation: Only super_admin and admin can create users
    if (creatorRole !== "super_admin" && creatorRole !== "admin") {
        throw new ApiError(403, "Forbidden: Only Admins or Super Admins can create users.");
    }

    // Role-specific creation rules
    if (creatorRole === "admin") {
        // Admin can only create admin or subadmin (cannot create super_admin)
        if (systemRole === "super_admin") {
            throw new ApiError(403, "Forbidden: Admins cannot create Super Admins.");
        }
    }

    // Validate company logic
    let assignedCompanyId = req.user.company; // default to creator's company 
    if (creatorRole === "super_admin") {
        if (systemRole === "admin" || systemRole === "subadmin") {
            if (!companyId) throw new ApiError(400, "Please provide a company id mapping for this user.");
            assignedCompanyId = companyId;
        } else {
            assignedCompanyId = null; // another super_admin
        }
    }

    // phone uniqueness
    if (phoneNo) {
        const existingPhone = await User.findOne({ company: assignedCompanyId, phoneNo: phoneNo.toString().trim() }).lean().select("_id");
        if (existingPhone) throw new ApiError(409, "PhoneNo already used within this company");
    }

    const existingUser = await User.findOne({ uniqueId });
    if (existingUser) throw new ApiError(400, "Unique ID already exists");

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = new User({
        name,
        uniqueId,
        email,
        phoneNo,
        passwordHash,
        systemRole: systemRole || (creatorRole === "super_admin" ? "admin" : "subadmin"),
        company: assignedCompanyId,
        permissions: permissions || [],
        createdBy: req.user._id
    });

    await newUser.save();

    const userObj = newUser.toObject();
    delete userObj.passwordHash;

    res.status(200).json(
        new ApiResponse(200, { user: userObj }, "User created successfully")
    );

});

// Get List of Users
export const listUsersBySystemRoleV2 = asyncHandler(async (req, res) => {
    const {
        systemRole,
        page = 1,
        limit = 20,
        status,
        searchQuery = ""
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10));
    const parsedLimit = Math.min(100, parseInt(limit, 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // ---------- BASE FILTER ----------
    const filter = {
        // systemRole
    };
    if (systemRole) filter.systemRole = systemRole;

    if (status != undefined) filter.active = status;

    // ---------- SEARCH ----------
    if (searchQuery && searchQuery.trim()) {
        const regex = new RegExp("^" + escapeRegex(searchQuery), "i");
        filter.$or = [
            { name: regex },
            { uniqueId: regex },
            { email: regex },
            { phoneNo: regex }
        ];
    }

    const projection = {
        passwordHash: 0,
        __v: 0
    };

    const [users, totalCount] = await Promise.all([
        User.find(filter)
            .select(projection)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .populate({ path: "createdBy", select: "name systemRole" })
            .lean(),
        User.countDocuments(filter)
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            users,
            totalCount,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                hasNextPage: parsedPage * parsedLimit < totalCount
            }
        }, "Users fetched successfully")
    );
});

export const getUserRoleAndPermissions = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id) throw new ApiError(400, "User id is required");
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid user id");

    // requester must be authenticated (authenticate middleware will run before this)
    const requester = req.user;
    if (!requester) throw new ApiError(401, "Unauthorized");

    const target = await User.findById(id).select("role designation permissions").lean();
    if (!target) throw new ApiError(404, "User not found");

    // enforce same-company rule for non-admins
    if (requester.systemRole !== "super_admin") {
        if (!requester.company) throw new ApiError(403, "Forbidden: requester does not belong to any company");
        // allow if requester is same user or same company
        const isSelf = requester._id.toString() === id.toString();
        const sameCompany = target.company && requester.company && target.company.toString() === requester.company.toString();
        if (!isSelf && !sameCompany) throw new ApiError(403, "Forbidden: cannot access user from another company");
    }

    let companyModules = [];
    // console.log("Company ",requester.company);
    if (requester?.company) {
        const myCompany = await Company.findById(requester?.company);
        companyModules = myCompany?.modules || [];
    }

    // Build response object only with fields present
    const response = {};
    if (typeof target.systemRole !== "undefined") response.systemRole = target.systemRole;
    if (typeof target.designation !== "undefined") response.designation = target.designation;
    if (Array.isArray(target.permissions)) response.permissions = target.permissions;
    if (Array.isArray(companyModules)) response.modules = companyModules;
    // console.log(response);

    return res.status(200).json(new ApiResponse(200, { user: response }, "User role and permissions fetched"));
});

export const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        name,
        email,
        phoneNo,
        password,
        active,
        systemRole,
        permissions,
        uniqueId
    } = req.body;

    const requester = req.user;

    const user = await User.findById(id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Permission check: Only super_admin and admin can manage users
    if (requester.systemRole !== "super_admin" && requester.systemRole !== "admin") {
        // Non-admin can only update their own profile
        if (requester._id.toString() !== id) {
            throw new ApiError(403, "Forbidden: Only Admins or Super Admins can update other users.");
        }
        // Subadmins cannot change their own role, permissions or status
        if (systemRole !== undefined || permissions !== undefined || active !== undefined) {
            throw new ApiError(403, "Forbidden: You cannot change your own role, permissions, or status.");
        }
    }

    // Role-specific update rules
    if (requester.systemRole === "admin") {
        // Admins can only update users within their company
        if (user.company?.toString() !== requester.company?.toString()) {
            throw new ApiError(403, "Forbidden: Admins can only update users within their own company.");
        }
        // Admin cannot update a super_admin
        if (user.systemRole === "super_admin" && requester._id.toString() !== id) {
            throw new ApiError(403, "Forbidden: Admins cannot update Super Admins.");
        }
    }

    // Apply updates
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (active !== undefined) user.active = active;
    if (systemRole !== undefined) {
        // Only super_admin or admin can change roles
        if (requester.systemRole === "super_admin" || requester.systemRole === "admin") {
            // Admin can only set to admin or subadmin
            if (requester.systemRole === "admin" && systemRole === "super_admin") {
                throw new ApiError(403, "Forbidden: Admins cannot promote to super_admin");
            }
            user.systemRole = systemRole;
        }
    }
    if (permissions !== undefined) {
        if (requester.systemRole === "super_admin" || requester.systemRole === "admin") {
            user.permissions = permissions;
        }
    }


    if (uniqueId && uniqueId !== user.uniqueId) {
        const existingUniqueId = await User.findOne({ uniqueId });
        if (existingUniqueId) throw new ApiError(400, "Unique ID already exists");
        user.uniqueId = uniqueId;
    }

    if (phoneNo && phoneNo !== user.phoneNo) {
        // Phone uniqueness within company
        const existingPhone = await User.findOne({
            company: user.company,
            phoneNo: phoneNo.toString().trim(),
            _id: { $ne: id }
        });
        if (existingPhone) throw new ApiError(409, "PhoneNo already used within this company");
        user.phoneNo = phoneNo;
    }

    if (password) {
        if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
        user.passwordHash = await bcrypt.hash(password, 10);
    }

    await user.save();

    const updatedUser = user.toObject();
    delete updatedUser.passwordHash;

    res.status(200).json(
        new ApiResponse(200, { user: updatedUser }, "User updated successfully")
    );
});

// Helper for regex escaping
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};