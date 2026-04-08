import AnalysisLog from "../../../models/AnalysisLog.js";
import AuditLog from "../../../models/AuditLog.js";
import Branch from "../../../models/Branch.js";
import BranchStock from "../../../models/BranchStock.js";
import BranchTransfer from "../../../models/BranchTransfer.js";
import Business from "../../../models/Business.js";
import BusinessAssistantConfig from "../../../models/BusinessAssistantConfig.js";
import Category from "../../../models/Category.js";
import Credit from "../../../models/Credit.js";
import CreditPayment from "../../../models/CreditPayment.js";
import Customer from "../../../models/Customer.js";
import DefectiveProduct from "../../../models/DefectiveProduct.js";
import DeliveryMethod from "../../../models/DeliveryMethod.js";
import DispatchRequest from "../../../models/DispatchRequest.js";
import DistributorStats from "../../../models/DistributorStats.js";
import DistributorStock from "../../../models/DistributorStock.js";
import Expense from "../../../models/Expense.js";
import InventoryEntry from "../../../models/InventoryEntry.js";
import InventoryMovement from "../../../models/InventoryMovement.js";
import Membership from "../../../models/Membership.js";
import Notification from "../../../models/Notification.js";
import PaymentMethod from "../../../models/PaymentMethod.js";
import PeriodWinner from "../../../models/PeriodWinner.js";
import PointsHistory from "../../../models/PointsHistory.js";
import ProfitHistory from "../../../models/ProfitHistory.js";
import Promotion from "../../../models/Promotion.js";
import Provider from "../../../models/Provider.js";
import PushSubscription from "../../../models/PushSubscription.js";
import RefreshToken from "../../../models/RefreshToken.js";
import Segment from "../../../models/Segment.js";
import SpecialSale from "../../../models/SpecialSale.js";
import Stock from "../../../models/Stock.js";
import StockTransfer from "../../../models/StockTransfer.js";
import Product from "../../infrastructure/database/models/Product.js";
import Sale from "../../infrastructure/database/models/Sale.js";
import User from "../../infrastructure/database/models/User.js";

const toStringId = (value) => {
  if (!value) return null;
  return typeof value === "string" ? value : value.toString();
};

const normalizeIdList = (values = []) => {
  const unique = new Set();

  values.forEach((value) => {
    const stringId = toStringId(value);
    if (stringId) {
      unique.add(stringId);
    }
  });

  return Array.from(unique);
};

const scopedModels = [
  ["analysisLogs", AnalysisLog],
  ["auditLogs", AuditLog],
  ["branches", Branch],
  ["branchStocks", BranchStock],
  ["branchTransfers", BranchTransfer],
  ["businessAssistantConfigs", BusinessAssistantConfig],
  ["categories", Category],
  ["credits", Credit],
  ["creditPayments", CreditPayment],
  ["customers", Customer],
  ["defectiveProducts", DefectiveProduct],
  ["deliveryMethods", DeliveryMethod],
  ["dispatchRequests", DispatchRequest],
  ["distributorStats", DistributorStats],
  ["distributorStocks", DistributorStock],
  ["expenses", Expense],
  ["inventoryEntries", InventoryEntry],
  ["inventoryMovements", InventoryMovement],
  ["memberships", Membership],
  ["notifications", Notification],
  ["paymentMethods", PaymentMethod],
  ["periodWinners", PeriodWinner],
  ["pointsHistory", PointsHistory],
  ["products", Product],
  ["profitHistory", ProfitHistory],
  ["promotions", Promotion],
  ["providers", Provider],
  ["pushSubscriptions", PushSubscription],
  ["sales", Sale],
  ["segments", Segment],
  ["specialSales", SpecialSale],
  ["stock", Stock],
  ["stockTransfers", StockTransfer],
];

export class TeardownDemoTenantUseCase {
  async execute(input = {}) {
    const {
      businessId,
      reason = "manual",
      skipBusinessValidation = false,
      demoUserIds = [],
    } = input;

    if (!businessId) {
      throw new Error("businessId es requerido para demo teardown");
    }

    const business = await Business.findById(businessId).lean();

    if (!business) {
      return {
        success: true,
        deleted: false,
        reason: "business_not_found",
        businessId,
      };
    }

    if (!skipBusinessValidation && business.isDemo !== true) {
      throw new Error("Solo se permite teardown de negocios demo");
    }

    const metadataDemo = business?.metadata?.demo || {};

    const strictDemoUserIds = normalizeIdList([
      ...demoUserIds,
      metadataDemo.adminUserId,
      metadataDemo.distributorUserId,
      ...(Array.isArray(metadataDemo.userIds) ? metadataDemo.userIds : []),
    ]);

    let userIds = strictDemoUserIds;

    if (userIds.length === 0) {
      const membershipUserIds = (
        await Membership.find({ business: business._id }).select("user").lean()
      ).map((membership) => membership.user);

      const fallbackDemoUsers = await User.find({
        _id: { $in: membershipUserIds },
        $or: [{ email: /@essence\.local$/i }, { name: /^demo\s/i }],
      })
        .select("_id")
        .lean();

      userIds = normalizeIdList(fallbackDemoUsers.map((user) => user._id));
    }

    const deletedCounts = {};

    for (const [label, model] of scopedModels) {
      const result = await model.deleteMany({ business: business._id });
      deletedCounts[label] = result.deletedCount || 0;
    }

    if (userIds.length > 0) {
      const refreshResult = await RefreshToken.deleteMany({
        user: { $in: userIds },
      });
      deletedCounts.refreshTokens = refreshResult.deletedCount || 0;

      const usersResult = await User.deleteMany({ _id: { $in: userIds } });
      deletedCounts.users = usersResult.deletedCount || 0;
    } else {
      deletedCounts.refreshTokens = 0;
      deletedCounts.users = 0;
    }

    const businessDeletion = await Business.deleteOne({ _id: business._id });
    deletedCounts.businesses = businessDeletion.deletedCount || 0;

    return {
      success: true,
      deleted: true,
      businessId: toStringId(business._id),
      businessName: business.name,
      reason,
      deletedCounts,
    };
  }
}
