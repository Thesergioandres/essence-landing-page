import AuditLog from "../models/AuditLog.js";
import Promotion from "../models/Promotion.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const toNumber = (value) => Number(Number(value || 0).toFixed(2));

const buildPriceMap = (items = []) => {
  const map = new Map();
  for (const item of items) {
    map.set(item.product?.toString(), {
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
    });
  }
  return map;
};

const getCartQuantity = (items = [], productId) => {
  return items
    .filter((i) => i.product?.toString() === productId?.toString())
    .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
};

const anyIntersection = (arr = [], target = []) => {
  const set = new Set((arr || []).map((v) => v?.toString()));
  return (target || []).some((v) => set.has(v?.toString()));
};

export const evaluatePromotion = (promotion, payload) => {
  const now = new Date();
  const items = payload.items || [];
  const segments = payload.segments || payload.customerSegments || [];
  const branchId = payload.branchId;
  const customerId = payload.customerId;

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
      (b) => b?.toString() === branchId?.toString()
    );
    if (!allowed) {
      return { applicable: false, discountAmount: 0, reason: "branch_blocked" };
    }
  }

  if (promotion.customers?.length) {
    if (!customerId) {
      return {
        applicable: false,
        discountAmount: 0,
        reason: "customer_required",
      };
    }

    const allowed = promotion.customers.some(
      (c) => c?.toString() === customerId?.toString()
    );
    if (!allowed) {
      return {
        applicable: false,
        discountAmount: 0,
        reason: "customer_blocked",
      };
    }
  }

  if (promotion.segments?.length) {
    if (!anyIntersection(promotion.segments, segments)) {
      return {
        applicable: false,
        discountAmount: 0,
        reason: "segment_blocked",
      };
    }
  }

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0
  );
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

  const minQty = promotion.thresholds?.minQty || 0;
  const minSubtotal = promotion.thresholds?.minSubtotal || 0;

  if (minQty && totalQty < minQty) {
    return { applicable: false, discountAmount: 0, reason: "min_qty" };
  }

  if (minSubtotal && subtotal < minSubtotal) {
    return { applicable: false, discountAmount: 0, reason: "min_subtotal" };
  }

  const priceMap = buildPriceMap(items);
  let discountAmount = 0;
  let appliedTimes = 0;

  if (promotion.type === "bogo") {
    if (!promotion.buyItems?.length || !promotion.rewardItems?.length) {
      return { applicable: false, discountAmount: 0, reason: "no_rules" };
    }

    const times = Math.min(
      ...promotion.buyItems.map((rule) => {
        const qty = getCartQuantity(items, rule.product);
        return Math.floor(qty / Number(rule.quantity || 1));
      })
    );

    if (!times || times < 1) {
      return {
        applicable: false,
        discountAmount: 0,
        reason: "requirements_not_met",
      };
    }

    appliedTimes = times;

    for (const reward of promotion.rewardItems) {
      const unitInfo = priceMap.get(reward.product?.toString());
      const unitPrice = unitInfo?.price || 0;
      const quantity = Number(reward.quantity || 1) * times;

      if (reward.discountType === "free") {
        discountAmount += unitPrice * quantity;
      } else if (reward.discountType === "amount") {
        discountAmount += Number(reward.discountValue || 0) * quantity;
      } else {
        discountAmount +=
          unitPrice * quantity * (Number(reward.discountValue || 0) / 100);
      }
    }
  } else if (promotion.type === "combo") {
    if (!promotion.comboItems?.length || !promotion.discount) {
      return { applicable: false, discountAmount: 0, reason: "no_rules" };
    }

    const times = Math.min(
      ...promotion.comboItems.map((rule) => {
        const qty = getCartQuantity(items, rule.product);
        return Math.floor(qty / Number(rule.quantity || 1));
      })
    );

    if (!times || times < 1) {
      return {
        applicable: false,
        discountAmount: 0,
        reason: "requirements_not_met",
      };
    }

    appliedTimes = times;

    const comboBase = promotion.comboItems.reduce((sum, rule) => {
      const info = priceMap.get(rule.product?.toString());
      const unitPrice = info?.price || 0;
      return sum + unitPrice * Number(rule.quantity || 1);
    }, 0);

    const disc = promotion.discount?.value || 0;
    if (promotion.discount?.type === "amount") {
      discountAmount = disc * times;
    } else {
      discountAmount = comboBase * (disc / 100) * times;
    }
  } else if (promotion.type === "volume") {
    const rule = promotion.volumeRule || {};
    if (!rule.minQty || totalQty < rule.minQty) {
      return {
        applicable: false,
        discountAmount: 0,
        reason: "requirements_not_met",
      };
    }
    const disc = Number(rule.discountValue || 0);
    discountAmount =
      rule.discountType === "amount" ? disc : subtotal * (disc / 100);
  } else {
    // discount genérico
    if (!promotion.discount) {
      return { applicable: false, discountAmount: 0, reason: "no_rules" };
    }
    const disc = Number(promotion.discount.value || 0);
    discountAmount =
      promotion.discount.type === "amount" ? disc : subtotal * (disc / 100);
  }

  return {
    applicable: discountAmount > 0,
    discountAmount: toNumber(discountAmount),
    appliedTimes,
    exclusive: promotion.exclusive || false,
    subtotal: toNumber(subtotal),
  };
};

const recordAudit = async (req, promotion, action, oldValues) => {
  try {
    await AuditLog.create({
      business: promotion.business,
      user: req.user?._id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action,
      module: "promotions",
      description: `${action} ${promotion.name}`,
      entityType: "Promotion",
      entityId: promotion._id,
      entityName: promotion.name,
      oldValues: oldValues || undefined,
      newValues: promotion,
    });
  } catch (error) {
    console.error("audit log promotion error", error?.message);
  }
};

export const createPromotion = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const payload = req.body || {};

    if (!payload.name || !payload.type) {
      return res
        .status(400)
        .json({ message: "Nombre y tipo son obligatorios" });
    }

    const promotion = await Promotion.create({
      ...payload,
      business: businessId,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    await recordAudit(req, promotion, "promotion_created");

    res.status(201).json({ promotion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const listPromotions = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { status } = req.query;
    const filter = { business: businessId };
    if (status) filter.status = status;

    const promotions = await Promotion.find(filter)
      .populate("branches", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ promotions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPromotionById = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const promotion = await Promotion.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!promotion) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    res.json({ promotion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePromotion = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const promotion = await Promotion.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!promotion) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    const oldValues = promotion.toObject();

    const updatableFields = [
      "name",
      "description",
      "type",
      "status",
      "exclusive",
      "startDate",
      "endDate",
      "branches",
      "segments",
      "customers",
      "buyItems",
      "rewardItems",
      "comboItems",
      "discount",
      "thresholds",
      "volumeRule",
      "financialImpact",
    ];

    for (const field of updatableFields) {
      if (field in req.body) {
        promotion[field] = req.body[field];
      }
    }

    promotion.updatedBy = req.user?._id;
    await promotion.save();

    await recordAudit(req, promotion, "promotion_updated", oldValues);

    res.json({ promotion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const promotion = await Promotion.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!promotion) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    const oldValues = promotion.toObject();

    promotion.status = "archived";
    promotion.updatedBy = req.user?._id;
    await promotion.save();

    await recordAudit(req, promotion, "promotion_deleted", oldValues);

    res.json({ message: "Promoción archivada", promotion });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const evaluatePromotionHandler = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const promotion = await Promotion.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!promotion) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    const result = evaluatePromotion(promotion, req.body || {});

    if (result.applicable) {
      promotion.usageCount = (promotion.usageCount || 0) + 1;
      promotion.lastUsedAt = new Date();
      await promotion.save();
    }

    res.json({ result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
