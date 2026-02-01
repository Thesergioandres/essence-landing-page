/**
 * CustomerPoints Repository - Data Access Layer
 * Handles customer points operations in Hexagonal Architecture
 */

import Customer from "../../../../models/Customer.js";
import PointsHistory from "../../../../models/PointsHistory.js";

class CustomerPointsRepository {
  /**
   * Get customer points balance
   */
  async getBalance(customerId, businessId) {
    const customer = await Customer.findOne({
      _id: customerId,
      business: businessId,
    }).select("name points totalPointsEarned totalPointsRedeemed");

    if (!customer) {
      return null;
    }

    return {
      customerId: customer._id,
      name: customer.name,
      currentPoints: customer.points || 0,
      totalEarned: customer.totalPointsEarned || 0,
      totalRedeemed: customer.totalPointsRedeemed || 0,
    };
  }

  /**
   * Get points history with pagination
   */
  async getHistory(customerId, businessId, options = {}) {
    const { limit = 50, skip = 0 } = options;

    // Verify customer exists in business
    const customerExists = await Customer.findOne({
      _id: customerId,
      business: businessId,
    }).select("_id");

    if (!customerExists) {
      return null;
    }

    const [records, totalRecords] = await Promise.all([
      PointsHistory.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PointsHistory.countDocuments({ customer: customerId }),
    ]);

    return {
      records,
      totalRecords,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(totalRecords / limit),
    };
  }

  /**
   * Adjust customer points (add or subtract)
   */
  async adjustPoints(customerId, businessId, amount, description, userId) {
    const customer = await Customer.findOne({
      _id: customerId,
      business: businessId,
    });

    if (!customer) {
      return null;
    }

    const currentPoints = customer.points || 0;
    const newBalance = currentPoints + amount;

    if (newBalance < 0) {
      throw new Error("Saldo insuficiente de puntos");
    }

    // Update customer
    customer.points = newBalance;
    if (amount > 0) {
      customer.totalPointsEarned = (customer.totalPointsEarned || 0) + amount;
    } else {
      customer.totalPointsRedeemed =
        (customer.totalPointsRedeemed || 0) + Math.abs(amount);
    }
    await customer.save();

    // Create history entry
    await PointsHistory.create({
      customer: customerId,
      business: businessId,
      type: amount > 0 ? "adjustment" : "redeemed",
      amount: Math.abs(amount),
      balance: newBalance,
      description,
      adjustedBy: userId,
    });

    return {
      customerId: customer._id,
      previousPoints: currentPoints,
      adjustment: amount,
      newBalance,
    };
  }

  /**
   * Validate if customer can redeem points
   */
  async validateRedemption(customerId, businessId, pointsToRedeem) {
    const customer = await Customer.findOne({
      _id: customerId,
      business: businessId,
    }).select("points");

    if (!customer) {
      return { valid: false, message: "Cliente no encontrado" };
    }

    const currentPoints = customer.points || 0;

    if (pointsToRedeem > currentPoints) {
      return {
        valid: false,
        message: "Puntos insuficientes",
        currentPoints,
        pointsToRedeem,
      };
    }

    return { valid: true, currentPoints, pointsToRedeem };
  }

  /**
   * Expire old points (cleanup operation)
   */
  async expirePoints(businessId, daysOld = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Find old earned points that haven't been expired
    const oldRecords = await PointsHistory.find({
      business: businessId,
      type: "earned",
      createdAt: { $lte: cutoffDate },
      expired: { $ne: true },
    });

    let totalExpired = 0;

    for (const record of oldRecords) {
      const customer = await Customer.findById(record.customer);
      if (customer && customer.points >= record.amount) {
        customer.points -= record.amount;
        await customer.save();

        record.expired = true;
        await record.save();

        totalExpired += record.amount;

        await PointsHistory.create({
          customer: record.customer,
          business: businessId,
          type: "expired",
          amount: record.amount,
          balance: customer.points,
          description: `Puntos expirados después de ${daysOld} días`,
        });
      }
    }

    return {
      recordsExpired: oldRecords.length,
      totalPointsExpired: totalExpired,
    };
  }
}

export default new CustomerPointsRepository();
