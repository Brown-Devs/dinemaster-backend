import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcryptjs";

// Create Company
export const createCompany = async (req, res, next) => {
    try {
        const { name, companyId, contactPhone, email, address, adminDetails } = req.body;

        const existingCompany = await Company.findOne({ companyId });
        if (existingCompany) {
            return next(new ApiError(400, "Company ID already exists"));
        }

        const newCompany = new Company({
            name,
            companyId,
            contactPhone,
            email,
            address
        });
        await newCompany.save();

        let createdAdmin = null;

        // Optionally create an admin right away
        if (adminDetails && adminDetails.email && adminDetails.password) {
            const passwordHash = await bcrypt.hash(adminDetails.password, 10);
            const newAdmin = new User({
                name: adminDetails.name || `Admin - ${name}`,
                email: adminDetails.email,
                phoneNo: adminDetails.phoneNo || contactPhone || "0000000000",
                passwordHash,
                role: "admin",
                company: newCompany._id,
                permissions: ["all"],
                createdBy: req.user._id
            });
            await newAdmin.save();
            createdAdmin = newAdmin;
        }

        res.status(201).json({
            success: true,
            message: "Company created successfully",
            company: newCompany,
            adminCreated: !!createdAdmin
        });

    } catch (error) {
        next(error);
    }
};

// Get List of Companies
export const getCompanies = async (req, res, next) => {
    try {
        const companies = await Company.find();
        
        res.status(200).json({
            success: true,
            companies
        });
    } catch (error) {
        next(error);
    }
};
