import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import CompanySubscription from "../models/companySubscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getAssignedCompanyId } from "../utils/companyHelper.js";

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

// Update Company (super_admin only)
export const updateCompany = async (req, res, next) => {
    try {
        const { id } = req.params;

        const company = await Company.findById(id);
        if (!company) return next(new ApiError(404, "Company not found"));

        const {
            name, contactPhone, altContactPhone, email, address,
            gstNo, logo, logoKey, invoiceTerms, modules,
            billing, subscription
        } = req.body;

        // Apply scalar field updates
        if (name !== undefined)             company.name = name;
        if (contactPhone !== undefined)     company.contactPhone = contactPhone;
        if (altContactPhone !== undefined)  company.altContactPhone = altContactPhone;
        if (email !== undefined)            company.email = email;
        if (address !== undefined)          company.address = address;
        if (gstNo !== undefined)            company.gstNo = gstNo;
        if (logo !== undefined)             company.logo = logo;
        if (logoKey !== undefined)          company.logoKey = logoKey;
        if (invoiceTerms !== undefined)     company.invoiceTerms = invoiceTerms;
        if (modules !== undefined)          company.modules = modules;
        if (billing?.plan !== undefined)    company.billing.plan = billing.plan;

        // Optionally create a new CompanySubscription
        let newSubscription = null;
        if (subscription) {
            const { currentPeriodStart, currentPeriodEnd, status, graceDays } = subscription;

            newSubscription = await CompanySubscription.create({
                company: company._id,
                currentPeriodStart: new Date(currentPeriodStart),
                currentPeriodEnd: new Date(currentPeriodEnd),
                status: status || "active",
                graceDays: graceDays ?? 5
            });

            // Link subscription to company
            company.billing.subscriptionRef = newSubscription._id;
        }

        await company.save();

        res.status(200).json({
            success: true,
            message: "Company updated successfully",
            company,
            ...(newSubscription && { subscription: newSubscription })
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

// Get My Company (Admins)
export const getMyCompany = asyncHandler(async (req, res) => {
    const { assignedCompanyId } = getAssignedCompanyId(req);
    const company = await Company.findById(assignedCompanyId);
    
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    res.status(200).json({
        success: true,
        company
    });
});

// Update My Company Branding (Admins)
export const updateMyCompany = asyncHandler(async (req, res) => {
    const { assignedCompanyId } = getAssignedCompanyId(req);
    const company = await Company.findById(assignedCompanyId);

    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    const { logo, logoKey, paymentQr, paymentQrKey, invoiceTerms } = req.body;

    if (logo !== undefined) company.logo = logo;
    if (logoKey !== undefined) company.logoKey = logoKey;
    if (paymentQr !== undefined) company.paymentQr = paymentQr;
    if (paymentQrKey !== undefined) company.paymentQrKey = paymentQrKey;
    if (invoiceTerms !== undefined) company.invoiceTerms = invoiceTerms;

    await company.save();

    res.status(200).json({
        success: true,
        message: "Branding updated successfully",
        company
    });
});
