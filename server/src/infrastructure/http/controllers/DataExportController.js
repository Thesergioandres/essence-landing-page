/**
 * DataExportController.js
 * Handles full business data export (JSON backup)
 *
 * SECURITY: Excludes sensitive fields (passwords, tokens)
 * PERFORMANCE: Uses .lean() for all queries
 */

// Import all models
import Branch from "../../database/models/Branch.js";
import BranchStock from "../../database/models/BranchStock.js";
import BranchTransfer from "../../database/models/BranchTransfer.js";
import Business from "../../database/models/Business.js";
import Category from "../../database/models/Category.js";
import Credit from "../../database/models/Credit.js";
import CreditPayment from "../../database/models/CreditPayment.js";
import Customer from "../../database/models/Customer.js";
import DefectiveProduct from "../../database/models/DefectiveProduct.js";
import DeliveryMethod from "../../database/models/DeliveryMethod.js";
import EmployeeStats from "../../database/models/EmployeeStats.js";
import EmployeeStock from "../../database/models/EmployeeStock.js";
import Expense from "../../database/models/Expense.js";
import GamificationConfig from "../../database/models/GamificationConfig.js";
import InventoryEntry from "../../database/models/InventoryEntry.js";
import Membership from "../../database/models/Membership.js";
import PaymentMethod from "../../database/models/PaymentMethod.js";
import PointsHistory from "../../database/models/PointsHistory.js";
import Product from "../../database/models/Product.js";
import ProfitHistory from "../../database/models/ProfitHistory.js";
import Promotion from "../../database/models/Promotion.js";
import Provider from "../../database/models/Provider.js";
import Sale from "../../database/models/Sale.js";
import Segment from "../../database/models/Segment.js";
import SpecialSale from "../../database/models/SpecialSale.js";
import StockTransfer from "../../database/models/StockTransfer.js";
import { resolveFinancialPrivacyContext } from "../../../../utils/financialPrivacy.js";

export class DataExportController {
  /**
   * GET /api/v2/business/export-full-data
   * Exports all business data as a single JSON object
   */
  async exportFullData(req, res) {
    try {
      const businessId = req.businessId;
      const privacy = resolveFinancialPrivacyContext(req);

      if (!businessId) {
        return res.status(400).json({
          success: false,
          message: "Business ID is required",
        });
      }

      if (privacy.hideFinancialData) {
        return res.status(403).json({
          success: false,
          message:
            "No tienes permisos para exportar datos financieros completos.",
        });
      }

      console.warn("[Essence Debug]", 
        `ðŸ“¦ [DataExport] Starting full export for business: ${businessId}`,
      );
      const startTime = Date.now();

      // Execute all queries in parallel for performance
      const [
        // Organization
        business,
        branches,
        memberships,

        // Catalog
        categories,
        products,
        providers,
        customers,
        segments,

        // Operations
        paymentMethods,
        deliveryMethods,
        promotions,
        gamificationConfig,

        // Inventory
        branchStocks,
        employeeStocks,
        inventoryEntries,
        stockTransfers,
        branchTransfers,
        defectiveProducts,

        // Transactions
        sales,
        specialSales,
        expenses,
        credits,
        creditPayments,

        // Analytics
        profitHistory,
        employeeStats,
        pointsHistory,
      ] = await Promise.all([
        // Organization
        Business.findById(businessId).lean(),
        Branch.find({ business: businessId }).lean(),
        Membership.find({ business: businessId })
          .populate("user", "-password -refreshTokens")
          .lean(),

        // Catalog
        Category.find({ business: businessId }).lean(),
        Product.find({
          business: businessId,
          isDeleted: { $ne: true },
        }).lean(),
        Provider.find({ business: businessId }).lean(),
        Customer.find({ business: businessId }).lean(),
        Segment.find({ business: businessId }).lean(),

        // Operations
        PaymentMethod.find({ business: businessId }).lean(),
        DeliveryMethod.find({ business: businessId }).lean(),
        Promotion.find({ business: businessId }).lean(),
        GamificationConfig.findOne({ business: businessId }).lean(),

        // Inventory
        BranchStock.find({ business: businessId }).lean(),
        EmployeeStock.find({ business: businessId }).lean(),
        InventoryEntry.find({ business: businessId }).lean(),
        StockTransfer.find({ business: businessId }).lean(),
        BranchTransfer.find({ business: businessId }).lean(),
        DefectiveProduct.find({ business: businessId }).lean(),

        // Transactions
        Sale.find({ business: businessId }).lean(),
        SpecialSale.find({ business: businessId }).lean(),
        Expense.find({ business: businessId }).lean(),
        Credit.find({ business: businessId }).lean(),
        CreditPayment.find({ business: businessId }).lean(),

        // Analytics
        ProfitHistory.find({ business: businessId }).lean(),
        EmployeeStats.find({ business: businessId }).lean(),
        PointsHistory.find({ business: businessId }).lean(),
      ]);

      // Get users from memberships (already populated without password)
      const users = memberships.map((m) => m.user).filter(Boolean);

      // Build export structure
      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          businessId: businessId,
          businessName: business?.name || "Unknown",
          exportedBy: req.user?.email || "Unknown",
          version: "1.0",
        },

        organization: {
          business,
          branches,
          memberships: memberships.map((m) => ({
            ...m,
            user: m.user?._id, // Only keep user ID reference
          })),
          users, // Separate users array without sensitive data
        },

        catalog: {
          categories,
          products,
          providers,
          customers,
          segments,
        },

        operations: {
          paymentMethods,
          deliveryMethods,
          promotions,
          gamificationConfig,
        },

        inventory: {
          branchStocks,
          employeeStocks,
          inventoryEntries,
          stockTransfers,
          branchTransfers,
          defectiveProducts,
        },

        transactions: {
          sales,
          specialSales,
          expenses,
          credits,
          creditPayments,
        },

        analytics: {
          profitHistory,
          employeeStats,
          pointsHistory,
        },

        summary: {
          totalBranches: branches.length,
          totalUsers: users.length,
          totalCategories: categories.length,
          totalProducts: products.length,
          totalCustomers: customers.length,
          totalSales: sales.length,
          totalExpenses: expenses.length,
          totalCredits: credits.length,
        },
      };

      const duration = Date.now() - startTime;
      console.warn("[Essence Debug]", `âœ… [DataExport] Export completed in ${duration}ms`);

      res.json({
        success: true,
        data: exportData,
      });
    } catch (error) {
      console.error("âŒ [DataExport] Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error exporting data",
      });
    }
  }
}

export default new DataExportController();

