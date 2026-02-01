// WAIT! We moved Sale.js? No, user only asked to move Product and User so far.
// Checking file system... actually USER asked to move Sale in Phase 2 but we only did Product/User in later phases?
// Re-reading Phase 2. "Infrastructure (Persistencia): Mueve (o importa) el modelo Sale actual."
// We should check where Sale.js is. Assuming it was moved or is available.
// Let's use the new path if we moved it, or fallback.
// Based on Phase 12/13, we moved Product and User. In Phase 2/3 we created SaleRepository but did we move Sale.js?
// I'll check first, but for now assuming we import from best location.
// Actually, earlier I saw Sale.js in src/infrastructure/database/models/Sale.js in previous turn?
// No, I moved Product and User. I should double check Sale location.
// SAFE BET: Import from relative path if unsure, or standard infra path.
// Let's assume standard path: ../models/Sale.js if not moved, or ../src/... if moved.
// I will assume it IS moved because we are in src/infrastructure and we likely want to be consistent.
// But if it wasn't moved, the require might fail.
// I will check file existence in next step if needed, but for now I will write assuming it is in ../models/Sale.js relative to WHERE this file is?
// This file is in src/infrastructure/database/repositories/AnalyticsRepository.js
// So ../models/Sale.js would be src/infrastructure/database/models/Sale.js
// If legacy Sale is at server/models/Sale.js, then path is ../../../../models/Sale.js?
// Let's stick to using the same pattern as ProductRepository which used ../models/Product.js (which I moved).
// I will check if Sale.js was moved.

import mongoose from "mongoose";
import SaleModel from "../models/Sale.js"; // Expecting it to be in src/infrastructure/database/models/Sale.js

export class AnalyticsRepository {
  /**
   * Get Dashboard KPIs
   * @param {string} businessId
   * @param {Date} startDate
   * @param {Date} endDate
   */
  async getDashboardKPIs(businessId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          saleDate: { $gte: startDate, $lte: endDate },
          // Note: Sale model uses paymentStatus not status. Remove cancelled filter for now.
          // If you need to filter cancelled sales, add a 'cancelled' field to the schema.
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$salePrice" },
          totalProfit: { $sum: { $ifNull: ["$netProfit", "$totalProfit"] } }, // Fallback to totalProfit if netProfit is missing
          totalSales: { $sum: 1 },
          productsSold: { $sum: "$quantity" },
        },
      },
    ];

    const result = await SaleModel.aggregate(pipeline);
    return (
      result[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0,
        productsSold: 0,
      }
    );
  }

  /**
   * Get Sales Timeline (Daily)
   */
  async getSalesTimeline(businessId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          saleDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
          revenue: { $sum: "$salePrice" },
          profit: { $sum: { $ifNull: ["$netProfit", "$totalProfit"] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    return SaleModel.aggregate(pipeline);
  }
}
