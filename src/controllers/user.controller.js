import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import Company from "../models/company.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

// Create User
export const createUser = asyncHandler(async (req, res) => {
    try {
        const { name, uniqueId, email, phoneNo, password, systemRole, companyId, permissions } = req.body;
        const creatorRole = req.user.systemRole;

        if (!uniqueId) throw new ApiError(400, "uniqueId is required for the user");
        if (!name) throw new ApiError(400, "name is required");
        if (!password || password.length < 6) throw new ApiError(400, "password is required (min 6 chars)");

        // Validation for creator systemRole vs requested systemRole
        if (creatorRole === "admin" && systemRole !== "subadmin") {
            throw new ApiError(403, "Admins can only create subadmins.");
        }
        if (creatorRole === "subadmin") {
            throw new ApiError(403, "Subadmins cannot create users.");
        }

        // Validate company logic
        let assignedCompanyId = req.user.company; // default to creator's company 
        if (creatorRole === "super_admin") {
            if (systemRole === "admin" || systemRole === "subadmin") {
                if (!companyId) return next(new ApiError(400, "Please provide a company id mapping for this user."));
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

        const existingUser = await User.findOne({ $or: [{ email }, { uniqueId }] });
        if (existingUser) return next(new ApiError(400, "Email or Unique ID already exists"));

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

        res.status(201).json({
            success: true,
            message: "User created successfully",
            user: userObj
        });
    } catch (error) {
        next(error);
    }
});

// Get List of Users
export const getUsers = asyncHandler(async (req, res) => {
    try {
        const { systemRole, company } = req.user;
        let query = {};

        if (systemRole === ("admin")) {
            query.company = company;
        } else if (systemRole === "subadmin") {
            throw new ApiError(403, "Subadmins cannot view user lists.");
        }

        const users = await User.find(query).select("-passwordHash").populate("company", "name companyId");

        res.status(200).json({
            success: true,
            users
        });
    } catch (error) {
        next(error);
    }
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