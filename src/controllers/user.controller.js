import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

// Create User
export const createUser = async (req, res, next) => {
    try {
        const { name, uniqueId, email, phoneNo, password, systemRole, companyId, permissions } = req.body;
        const creatorRole = req.user.systemRole;

        if (!uniqueId) throw new ApiError(400, "uniqueId is required for the user");
        if (!name) throw new ApiError(400, "name is required");
        if (!password || password.length < 6) throw new ApiError(400, "password is required (min 6 chars)");

        // Validation for creator systemRole vs requested systemRole
        if (creatorRole === "admin" && systemRole !== "subadmin") {
            return next(new ApiError(403, "Admins can only create subadmins."));
        }
        if (creatorRole === "subadmin") {
            return next(new ApiError(403, "Subadmins cannot create users."));
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
};

// Get List of Users
export const getUsers = async (req, res, next) => {
    try {
        const { systemRole, company } = req.user;
        let query = {};

        if (systemRole === ("admin")) {
            query.company = company;
        } else if (systemRole === "subadmin") {
            return next(new ApiError(403, "Subadmins cannot view user lists."));
        }

        const users = await User.find(query).select("-passwordHash").populate("company", "name companyId");

        res.status(200).json({
            success: true,
            users
        });
    } catch (error) {
        next(error);
    }
};
