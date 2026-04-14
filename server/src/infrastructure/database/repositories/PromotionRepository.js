import Promotion from "../models/Promotion.js";

export class PromotionRepository {
  async create(data, businessId) {
    const normalizedData = { ...data };
    if (
      normalizedData.totalStock !== undefined &&
      normalizedData.totalStock !== null &&
      (normalizedData.currentStock === undefined ||
        normalizedData.currentStock === null)
    ) {
      normalizedData.currentStock = normalizedData.totalStock;
    }
    const promotion = await Promotion.create({
      ...normalizedData,
      business: businessId,
    });

    return promotion;
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.active !== undefined) {
      const now = new Date();
      if (filters.active === "true") {
        query.status = "active";
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
      }
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .populate(
          "buyItems.product",
          "name image clientPrice employeePrice purchasePrice averageCost",
        )
        .populate(
          "rewardItems.product",
          "name image clientPrice employeePrice purchasePrice averageCost",
        )
        .populate(
          "comboItems.product",
          "name image clientPrice employeePrice purchasePrice averageCost",
        )
        .populate("branches", "name")
        .populate("allowedLocations", "name")
        .populate("allowedEmployees", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Promotion.countDocuments(query),
    ]);

    return {
      promotions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id, businessId) {
    const promotion = await Promotion.findOne({ _id: id, business: businessId })
      .populate(
        "buyItems.product",
        "name image clientPrice employeePrice purchasePrice averageCost",
      )
      .populate(
        "rewardItems.product",
        "name image clientPrice employeePrice purchasePrice averageCost",
      )
      .populate(
        "comboItems.product",
        "name image clientPrice employeePrice purchasePrice averageCost",
      )
      .populate("branches", "name")
      .populate("allowedLocations", "name")
      .populate("allowedEmployees", "name email")
      .lean();

    return promotion;
  }

  async update(id, businessId, data) {
    const normalizedData = { ...data };
    if (
      normalizedData.totalStock !== undefined &&
      normalizedData.totalStock !== null &&
      (normalizedData.currentStock === undefined ||
        normalizedData.currentStock === null)
    ) {
      normalizedData.currentStock = normalizedData.totalStock;
    }

    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, business: businessId },
      normalizedData,
      { new: true },
    );

    if (!promotion) {
      const err = new Error("Promoción no encontrada");
      err.statusCode = 404;
      throw err;
    }

    return promotion;
  }

  async delete(id, businessId) {
    const promotion = await Promotion.findOneAndDelete({
      _id: id,
      business: businessId,
    });

    if (!promotion) {
      const err = new Error("Promoción no encontrada");
      err.statusCode = 404;
      throw err;
    }

    return promotion;
  }

  async findActive(businessId) {
    const now = new Date();
    const promotions = await Promotion.find({
      business: businessId,
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate(
        "buyItems.product",
        "name image clientPrice employeePrice purchasePrice averageCost",
      )
      .populate(
        "rewardItems.product",
        "name image clientPrice employeePrice purchasePrice averageCost",
      )
      .populate(
        "comboItems.product",
        "name image clientPrice employeePrice purchasePrice averageCost",
      )
      .populate("branches", "name")
      .populate("allowedLocations", "name")
      .populate("allowedEmployees", "name email")
      .lean();

    return promotions;
  }

  evaluatePromotion(promotion, payload) {
    const now = new Date();
    const items = payload.items || [];
    const segments = payload.segments || payload.customerSegments || [];
    const branchId = payload.branchId;

    if (!promotion || promotion.status !== "active") {
      return { applicable: false, discountAmount: 0, reason: "inactive" };
    }

    if (promotion.startDate && now < promotion.startDate) {
      return { applicable: false, discountAmount: 0, reason: "not_started" };
    }

    if (promotion.endDate && now > promotion.endDate) {
      return { applicable: false, discountAmount: 0, reason: "expired" };
    }

    const locationRestrictionEnabled =
      promotion.allowAllLocations === false ||
      (promotion.allowAllLocations === undefined &&
        ((promotion.allowedLocations?.length ?? 0) > 0 ||
          (promotion.branches?.length ?? 0) > 0));

    if (locationRestrictionEnabled) {
      const allowedLocations =
        promotion.allowedLocations && promotion.allowedLocations.length > 0
          ? promotion.allowedLocations
          : promotion.branches || [];

      if (!allowedLocations.length) {
        return {
          applicable: false,
          discountAmount: 0,
          reason: "branch_not_eligible",
        };
      }

      if (branchId) {
        const allowed = allowedLocations.some(
          (b) => b?.toString() === branchId?.toString(),
        );
        if (!allowed) {
          return {
            applicable: false,
            discountAmount: 0,
            reason: "branch_not_eligible",
          };
        }
      }
    }

    if (promotion.segments?.length && segments?.length) {
      const hasMatch = segments.some((s) =>
        promotion.segments.some((ps) => ps?.toString() === s?.toString()),
      );
      if (!hasMatch) {
        return {
          applicable: false,
          discountAmount: 0,
          reason: "segment_not_eligible",
        };
      }
    }

    let discountAmount = 0;

    const discountType = promotion?.discount?.type;
    const discountValue = promotion?.discount?.value || 0;

    if (discountType === "percentage") {
      const total = items.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
        0,
      );
      discountAmount = (total * discountValue) / 100;
    } else if (discountType === "amount") {
      discountAmount = discountValue;
    }

    return {
      applicable: true,
      discountAmount,
      promotion: {
        id: promotion._id,
        name: promotion.name,
        description: promotion.description,
      },
    };
  }
}
