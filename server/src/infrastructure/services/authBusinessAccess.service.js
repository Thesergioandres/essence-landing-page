import { OwnerAccessPolicyService } from "../../domain/services/OwnerAccessPolicyService.js";
import Business from "../database/models/Business.js";
import Membership from "../database/models/Membership.js";
import User from "../database/models/User.js";

export const checkBusinessOwnerAccess = async (userId) => {
  try {
    const membership = await Membership.findOne({
      user: userId,
      role: "distribuidor",
      status: "active",
    }).populate("business");

    if (!membership || !membership.business) {
      return { hasAccess: true };
    }

    const business = await Business.findById(membership.business._id);
    if (!business || !business.createdBy) {
      return { hasAccess: true };
    }

    const owner = await User.findById(business.createdBy)
      .select("_id role status subscriptionExpiresAt")
      .lean();

    return OwnerAccessPolicyService.evaluateOwnerAccess(owner);
  } catch (error) {
    console.error("Error checking business owner access:", error);
    return { hasAccess: true };
  }
};
