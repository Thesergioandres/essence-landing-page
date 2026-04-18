import Sale from "../models/Sale.js";
import User from "../models/User.js";

const resolveSaleRevenue = (sale) => {
  if (
    typeof sale?.actualPayment === "number" &&
    Number.isFinite(sale.actualPayment)
  ) {
    return sale.actualPayment;
  }

  const gross = Number(sale?.salePrice || 0) * Number(sale?.quantity || 0);
  const discount = Number(sale?.discount || 0);
  return Math.max(0, gross - discount);
};

const buildSaleTransactionKeyExpression = () => ({
  $ifNull: [
    "$saleGroupId",
    {
      $ifNull: ["$saleId", { $toString: "$_id" }],
    },
  ],
});

export class SaleRepository {
  /**
   * Creates a new Sale document.
   * @param {Object} saleData - The raw sale data (DTO)
   * @param {mongoose.ClientSession} session - Optional MongoDB session for ACID transaction
   * @returns {Promise<Object>} The created sale document
   * @throws {Error} If creation fails
   */
  async create(saleData, session) {
    // We pass [saleData] as an array because Model.create() with options requires it,
    // or we use new Model(data).save({ session }).
    // Using create method: Model.create([doc], { session }) returns array.
    const [sale] = session
      ? await Sale.create([saleData], { session })
      : await Sale.create([saleData]);

    if (!sale) {
      throw new Error("Failed to persist Sale document.");
    }

    return sale;
  }

  /**
   * Finds a sale by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return Sale.findById(id).populate("product").populate("employee").lean();
  }

  /**
   * Finds sales by specialized filter
   * @param {Object} filter
   * @returns {Promise<Array>}
   */
  async find(filter = {}) {
    return Sale.find(filter).lean();
  }

  /**
   * List sales with pagination and filters
   * @param {string} businessId
   * @param {Object} options - { page, limit, branchId, employeeId, startDate, endDate, statsOnly }
   * @returns {Promise<{ sales: Array, stats: Object, total: number, page: number, totalPages: number }>}
   */
  async list(businessId, options = {}) {
    const {
      page = 1,
      limit = 20,
      branchId,
      employeeId,
      productId,
      startDate,
      endDate,
      statsOnly = false,
    } = options;
    const skip = (page - 1) * limit;

    const filter = { business: businessId };

    if (branchId) {
      filter.branch = branchId;
    }

    if (employeeId) {
      filter.employee = employeeId;
    }

    if (productId) {
      filter.product = productId;
    }

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    // Calculate statistics
    // Convert string IDs to ObjectId for aggregation pipeline
    const matchFilter = { ...filter };
    if (typeof matchFilter.business === "string") {
      matchFilter.business = Sale.base.Types.ObjectId.createFromHexString(
        matchFilter.business,
      );
    }
    if (matchFilter.employee && typeof matchFilter.employee === "string") {
      matchFilter.employee = Sale.base.Types.ObjectId.createFromHexString(
        matchFilter.employee,
      );
    }
    if (matchFilter.branch && typeof matchFilter.branch === "string") {
      matchFilter.branch = Sale.base.Types.ObjectId.createFromHexString(
        matchFilter.branch,
      );
    }

    const statsAggregation = await Sale.aggregate([
      { $match: { ...matchFilter, paymentStatus: "confirmado" } },
      {
        $group: {
          _id: null,
          uniqueTransactions: {
            $addToSet: buildSaleTransactionKeyExpression(),
          },
          totalRevenue: {
            $sum: { $multiply: ["$salePrice", "$quantity"] },
          },
          totalEmployeeProfit: { $sum: "$employeeProfit" },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $size: "$uniqueTransactions" },
          totalRevenue: 1,
          totalEmployeeProfit: 1,
          totalAdminProfit: 1,
          totalProfit: 1,
        },
      },
    ]);

    const stats = statsAggregation[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalEmployeeProfit: 0,
      totalAdminProfit: 0,
      totalProfit: 0,
    };

    // If only stats requested, skip fetching individual sales
    if (statsOnly) {
      return {
        sales: [],
        stats,
        total: stats.totalSales,
        page: Number(page),
        totalPages: 0,
      };
    }

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .populate(
          "product",
          "name sku clientPrice suggestedPrice employeePrice",
        )
        .populate("branch", "name")
        .populate("employee", "name email")
        .populate("paymentMethod", "name code")
        .populate(
          "creditId",
          "remainingAmount status originalAmount paidAmount",
        )
        .sort({ saleDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
    ]);

    const normalizedSales = sales.map((sale) => ({
      ...sale,
      credit: sale.creditId || sale.credit,
    }));

    const employeeIds = [
      ...new Set(
        normalizedSales
          .map((sale) => {
            const employee = sale?.employee;
            if (!employee) return null;
            if (typeof employee === "object") {
              return employee?._id ? String(employee._id) : null;
            }
            return String(employee);
          })
          .filter(Boolean),
      ),
    ];

    if (employeeIds.length > 0) {
      const fixedCommissionUsers = await User.find({
        _id: { $in: employeeIds },
        $or: [{ isCommissionFixed: true }, { fixedCommissionOnly: true }],
      })
        .select(
          "_id customCommissionRate fixedCommissionOnly isCommissionFixed",
        )
        .lean();

      const fixedRateByUser = new Map(
        fixedCommissionUsers.map((user) => [
          String(user._id),
          Number.isFinite(Number(user.customCommissionRate))
            ? Math.max(0, Math.min(95, Number(user.customCommissionRate)))
            : null,
        ]),
      );

      for (const sale of normalizedSales) {
        const employee = sale?.employee;
        const employeeId =
          typeof employee === "object"
            ? String(employee?._id || "")
            : String(employee || "");

        const fixedRate = fixedRateByUser.get(employeeId);
        if (fixedRate === null || fixedRate === undefined) continue;

        const revenue = resolveSaleRevenue(sale);
        const employeeProfit = (revenue * fixedRate) / 100;

        sale.employeeProfitPercentage = fixedRate;
        sale.employeeProfit = employeeProfit;
        sale.commissionBonus = 0;
        sale.commissionBonusAmount = 0;
        sale.isCommissionFixed = true;
      }
    }

    return {
      sales: normalizedSales,
      stats,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Deletes a single sale by ID and restores stock
   * @param {string} saleId
   * @param {string} businessId
   * @param {mongoose.ClientSession} session
   * @returns {Promise<{ sale: Object, restoredStock: number }>}
   */
  async deleteById(saleId, businessId, session) {
    const sale = await Sale.findOne({
      _id: saleId,
      business: businessId,
    }).session(session);

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    await Sale.deleteOne({ _id: saleId }).session(session);

    return {
      sale,
      restoredStock: sale.quantity,
    };
  }

  /**
   * Deletes all sales in a group (cart) and restores stock
   * @param {string} saleGroupId
   * @param {string} businessId
   * @param {mongoose.ClientSession} session
   * @returns {Promise<{ deletedCount: number, totalRestoredStock: number, sales: Array }>}
   */
  async deleteByGroupId(saleGroupId, businessId, session) {
    const sales = await Sale.find({
      saleGroupId,
      business: businessId,
    }).session(session);

    if (!sales || sales.length === 0) {
      throw new Error("Grupo de ventas no encontrado");
    }

    const totalRestoredStock = sales.reduce((sum, s) => sum + s.quantity, 0);

    await Sale.deleteMany({
      saleGroupId,
      business: businessId,
    }).session(session);

    return {
      deletedCount: sales.length,
      totalRestoredStock,
      sales,
    };
  }

  /**
   * Finds sales by group ID
   * @param {string} saleGroupId
   * @param {string} businessId
   * @returns {Promise<Array>}
   */
  async findByGroupId(saleGroupId, businessId) {
    return Sale.find({
      saleGroupId,
      business: businessId,
    })
      .populate("product", "name sku")
      .lean();
  }

  /**
   * Validate and cleanup orphan sales for a business.
   * - Normalizes invalid paymentStatus to "pendiente".
   * - Removes sales with missing product references when no productName snapshot exists.
   */
  async validateIntegrity(businessId, options = {}) {
    const { dryRun = false } = options;
    const businessObjectId =
      typeof businessId === "string"
        ? Sale.base.Types.ObjectId.createFromHexString(businessId)
        : businessId;

    const invalidStatusFilter = {
      business: businessObjectId,
      paymentStatus: { $nin: ["pendiente", "confirmado"] },
    };
    const invalidStatusCount = await Sale.countDocuments(invalidStatusFilter);
    let statusUpdated = 0;
    if (!dryRun && invalidStatusCount > 0) {
      const updateResult = await Sale.updateMany(invalidStatusFilter, {
        $set: { paymentStatus: "pendiente" },
      });
      statusUpdated = updateResult.modifiedCount || 0;
    }

    const orphanCandidates = await Sale.aggregate([
      { $match: { business: businessObjectId } },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      {
        $addFields: {
          productMissing: { $eq: [{ $size: "$productInfo" }, 0] },
        },
      },
      { $match: { productMissing: true } },
      { $project: { _id: 1, productName: 1 } },
    ]);

    const orphanIds = orphanCandidates
      .filter((sale) => !sale.productName || !String(sale.productName).trim())
      .map((sale) => sale._id);

    let orphanDeleted = 0;
    if (!dryRun && orphanIds.length > 0) {
      const deleteResult = await Sale.deleteMany({ _id: { $in: orphanIds } });
      orphanDeleted = deleteResult.deletedCount || 0;
    }

    return {
      invalidStatusCount,
      statusUpdated,
      orphanCandidates: orphanCandidates.length,
      orphanDeleted,
    };
  }
}
