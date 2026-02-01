import dotenv from "dotenv";
import mongoose from "mongoose";
import Business from "./server/models/Business.js";
import Membership from "./server/models/Membership.js";
import User from "./server/models/User.js";
dotenv.config({ path: "./server/.env" });

const checkBusinessOwnerAccess = async (userId) => {
  try {
    const membership = await Membership.findOne({
      user: userId,
      role: "distribuidor",
      status: "active",
    }).populate("business");

    if (!membership || !membership.business) {
      console.log("No membership found or no business.");
      return { hasAccess: true };
    }

    const business = await Business.findById(membership.business._id);
    if (!business || !business.createdBy) {
      console.log("No business or createdBy.");
      return { hasAccess: true };
    }

    const owner = await User.findById(business.createdBy);
    if (!owner) {
      console.log("No owner found.");
      return { hasAccess: true };
    }

    console.log(`Owner Role: ${owner.role}`);
    console.log(`Owner Status: ${owner.status}`);

    // ⭐ GOD BYPASS SIMULATION
    if (owner.role === "god") {
      console.log("GOD BYPASS HIT!");
      return { hasAccess: true };
    }

    const ownerExpired =
      owner.subscriptionExpiresAt &&
      new Date(owner.subscriptionExpiresAt).getTime() < Date.now();

    if (owner.status !== "active" || ownerExpired) {
      return {
        hasAccess: false,
        reason: ownerExpired ? "owner_expired" : "owner_inactive",
        ownerStatus: owner.status,
        ownerExpiresAt: owner.subscriptionExpiresAt,
      };
    }

    return { hasAccess: true };
  } catch (error) {
    console.error("Error checking business owner access:", error);
    return { hasAccess: true };
  }
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    // Find a distributor user to test
    // Strategy: Find a membership where role is 'distribuidor', then check that user
    const membership = await Membership.findOne({ role: "distribuidor" });
    if (!membership) {
      console.log("No distributor membership found to test.");
      return;
    }

    console.log(`Testing with user ID: ${membership.user}`);
    const result = await checkBusinessOwnerAccess(membership.user);
    console.log("Result:", result);
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
};

run();
