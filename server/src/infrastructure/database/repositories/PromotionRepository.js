import Promotion from "../../../../models/Promotion.js";

export class PromotionRepository {
  async create(data, businessId) {
    const promotion = await Promotion.create({
      ...data,
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
        .populate("products", "name image salePrice")
        .populate("branches", "name")
        .populate("segments", "name")
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
      .populate("products", "name image salePrice purchasePrice")
      .populate("branches", "name")
      .populate("segments", "name")
      .lean();

    return promotion;
  }

  async update(id, businessId, data) {
    const promotion = await Promotion.findOneAndUpdate(
      { _id: id, business: businessId },
      data,
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
      .populate("products", "name salePrice")
      .populate("branches", "name")
      .populate("segments", "name")
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

    if (promotion.branches?.length && branchId) {
      const allowed = promotion.branches.some(
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

    if (promotion.discountType === "percentage") {
      const total = items.reduce(
        (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
        0,
      );
      discountAmount = (total * (promotion.discountValue || 0)) / 100;
    } else if (promotion.discountType === "fixed") {
      discountAmount = promotion.discountValue || 0;
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
