// src/utils/validateUser.js
import User from "../models/user.model.js";
import { ApiError } from "./ApiError.js";

export const validateActiveUser = async ({
  userId,
  companyId,
  allowedSystemRoles = []
}) => {
  const user = await User.findOne({
    _id: userId,
    company: companyId,
    active: true
  });

  if (!user) {
    throw new ApiError(400, "Invalid or inactive user");
  }

  if (
    allowedSystemRoles.length &&
    !allowedSystemRoles.includes(user.systemRole)
  ) {
    throw new ApiError(400, "User role not allowed for this action");
  }

  return user;
};
