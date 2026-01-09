import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../config/cloudinary.js";
import AuditLog from "../models/AuditLog.js";
import Product from "../models/Product.js";
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

    // Validar que bundles/combos tengan productos
    if (
      (payload.type === "bundle" || payload.type === "combo") &&
      (!payload.comboItems || payload.comboItems.length === 0)
    ) {
      return res
        .status(400)
        .json({
          message: "Los bundles y combos deben tener al menos un producto",
        });
    }

    // Subir imagen si viene en base64
    let imageData = null;
    if (
      payload.image &&
      typeof payload.image === "string" &&
      payload.image.startsWith("data:")
    ) {
      const result = await uploadToCloudinary(payload.image, "promotions");
      imageData = { url: result.secure_url, publicId: result.public_id };
    }

    // Calcular precio original si es bundle/combo
    let originalPrice = 0;
    if (
      (payload.type === "bundle" || payload.type === "combo") &&
      payload.comboItems?.length
    ) {
      for (const item of payload.comboItems) {
        if (item.product) {
          const product = await Product.findById(item.product);
          if (product) {
            originalPrice +=
              (product.clientPrice || product.suggestedPrice || 0) *
              (item.quantity || 1);
          }
        }
      }
    }

    const promotion = await Promotion.create({
      ...payload,
      business: businessId,
      image: imageData || payload.image,
      originalPrice: originalPrice || payload.originalPrice || 0,
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

    const { status, type, showInCatalog } = req.query;
    const filter = { business: businessId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (showInCatalog === "true") filter.showInCatalog = true;

    const promotions = await Promotion.find(filter)
      .populate("branches", "name")
      .populate(
        "comboItems.product",
        "name image totalStock clientPrice suggestedPrice"
      )
      .populate("buyItems.product", "name image totalStock")
      .populate("rewardItems.product", "name image")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    // Calcular estadísticas generales
    const stats = {
      total: promotions.length,
      active: promotions.filter((p) => p.status === "active").length,
      paused: promotions.filter((p) => p.status === "paused").length,
      archived: promotions.filter((p) => p.status === "archived").length,
      totalRevenue: promotions.reduce(
        (sum, p) => sum + (p.totalRevenue || 0),
        0
      ),
      totalUnitsSold: promotions.reduce(
        (sum, p) => sum + (p.totalUnitsSold || 0),
        0
      ),
    };

    res.json({ promotions, stats });
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
    })
      .populate("branches", "name")
      .populate(
        "comboItems.product",
        "name image totalStock clientPrice suggestedPrice purchasePrice"
      )
      .populate("buyItems.product", "name image totalStock")
      .populate("rewardItems.product", "name image")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

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

    // Manejar imagen
    if (
      req.body.image &&
      typeof req.body.image === "string" &&
      req.body.image.startsWith("data:")
    ) {
      // Eliminar imagen anterior si existe
      if (promotion.image?.publicId) {
        await deleteFromCloudinary(promotion.image.publicId);
      }
      const result = await uploadToCloudinary(req.body.image, "promotions");
      promotion.image = { url: result.secure_url, publicId: result.public_id };
    } else if (req.body.image === null) {
      // Eliminar imagen
      if (promotion.image?.publicId) {
        await deleteFromCloudinary(promotion.image.publicId);
      }
      promotion.image = null;
    }

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
      "promotionPrice",
      "originalPrice",
      "totalStock",
      "usageLimit",
      "usageLimitPerCustomer",
      "displayOrder",
      "showInCatalog",
    ];

    for (const field of updatableFields) {
      if (field in req.body) {
        promotion[field] = req.body[field];
      }
    }

    // Recalcular precio original si es bundle/combo
    if (
      (promotion.type === "bundle" || promotion.type === "combo") &&
      promotion.comboItems?.length
    ) {
      let originalPrice = 0;
      for (const item of promotion.comboItems) {
        const productId = item.product?._id || item.product;
        if (productId) {
          const product = await Product.findById(productId);
          if (product) {
            originalPrice +=
              (product.clientPrice || product.suggestedPrice || 0) *
              (item.quantity || 1);
          }
        }
      }
      promotion.originalPrice = originalPrice;
    }

    promotion.updatedBy = req.user?._id;
    await promotion.save();

    await recordAudit(req, promotion, "promotion_updated", oldValues);

    // Repoblar para la respuesta
    await promotion.populate(
      "comboItems.product",
      "name image totalStock clientPrice suggestedPrice"
    );
    await promotion.populate("branches", "name");

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

// Verificar stock disponible para una promoción
export const checkPromotionStock = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const promotion = await Promotion.findOne({
      _id: req.params.id,
      business: businessId,
    }).populate("comboItems.product", "name totalStock");

    if (!promotion) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    const quantity = parseInt(req.query.quantity) || 1;
    const stockIssues = [];
    let maxAvailable = Infinity;

    // Verificar stock de cada producto del combo
    for (const item of promotion.comboItems || []) {
      const product = item.product;
      if (!product) continue;

      const requiredQty = (item.quantity || 1) * quantity;
      const available = product.totalStock || 0;

      if (available < requiredQty) {
        stockIssues.push({
          product: product.name,
          productId: product._id,
          required: requiredQty,
          available,
          shortfall: requiredQty - available,
        });
      }

      const productMax = Math.floor(available / (item.quantity || 1));
      maxAvailable = Math.min(maxAvailable, productMax);
    }

    res.json({
      available: stockIssues.length === 0,
      maxAvailable: maxAvailable === Infinity ? 0 : maxAvailable,
      stockIssues,
      requestedQuantity: quantity,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener métricas de promociones
export const getPromotionMetrics = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { startDate, endDate } = req.query;

    // Obtener todas las promociones con sus estadísticas
    const promotions = await Promotion.find({ business: businessId })
      .populate("comboItems.product", "name")
      .lean();

    // Calcular métricas
    const topSelling = [...promotions]
      .sort((a, b) => (b.totalUnitsSold || 0) - (a.totalUnitsSold || 0))
      .slice(0, 5);

    const topRevenue = [...promotions]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 5);

    // Productos más usados en promociones
    const productUsage = new Map();
    for (const promo of promotions) {
      for (const item of promo.comboItems || []) {
        const productId = item.product?._id?.toString();
        const productName = item.product?.name || "Desconocido";
        if (productId) {
          const current = productUsage.get(productId) || {
            name: productName,
            count: 0,
            quantity: 0,
          };
          current.count += 1;
          current.quantity +=
            (item.quantity || 1) * (promo.totalUnitsSold || 0);
          productUsage.set(productId, current);
        }
      }
    }

    const topProducts = Array.from(productUsage.entries())
      .map(([id, data]) => ({ productId: id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Estadísticas generales
    const totalRevenue = promotions.reduce(
      (sum, p) => sum + (p.totalRevenue || 0),
      0
    );
    const totalUnitsSold = promotions.reduce(
      (sum, p) => sum + (p.totalUnitsSold || 0),
      0
    );
    const activePromotions = promotions.filter(
      (p) => p.status === "active"
    ).length;

    // Calcular ahorro total generado para clientes
    const totalSavings = promotions.reduce((sum, p) => {
      const savings =
        ((p.originalPrice || 0) - (p.promotionPrice || 0)) *
        (p.totalUnitsSold || 0);
      return sum + Math.max(0, savings);
    }, 0);

    res.json({
      overview: {
        totalPromotions: promotions.length,
        activePromotions,
        totalRevenue,
        totalUnitsSold,
        totalSavings,
        averageOrderValue:
          totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0,
      },
      topSelling: topSelling.map((p) => ({
        _id: p._id,
        name: p.name,
        type: p.type,
        unitsSold: p.totalUnitsSold || 0,
        revenue: p.totalRevenue || 0,
      })),
      topRevenue: topRevenue.map((p) => ({
        _id: p._id,
        name: p.name,
        type: p.type,
        revenue: p.totalRevenue || 0,
        unitsSold: p.totalUnitsSold || 0,
      })),
      topProducts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle estado de promoción
export const togglePromotionStatus = async (req, res) => {
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

    // Toggle entre active y paused
    promotion.status = promotion.status === "active" ? "paused" : "active";
    promotion.updatedBy = req.user?._id;
    await promotion.save();

    await recordAudit(req, promotion, "promotion_status_toggled", oldValues);

    res.json({
      promotion,
      message: `Promoción ${
        promotion.status === "active" ? "activada" : "pausada"
      }`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Obtener promociones para catálogo público
export const getCatalogPromotions = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const now = new Date();

    const promotions = await Promotion.find({
      business: businessId,
      status: "active",
      showInCatalog: true,
      $or: [{ startDate: null }, { startDate: { $lte: now } }],
      $and: [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }],
    })
      .populate("comboItems.product", "name image clientPrice suggestedPrice")
      .sort({ displayOrder: 1 })
      .lean();

    // Enriquecer con datos de ahorro
    const enrichedPromotions = promotions.map((p) => ({
      ...p,
      savings: Math.max(0, (p.originalPrice || 0) - (p.promotionPrice || 0)),
      savingsPercentage:
        p.originalPrice > 0
          ? Math.round(
              ((p.originalPrice - (p.promotionPrice || 0)) / p.originalPrice) *
                100
            )
          : 0,
    }));

    res.json({ promotions: enrichedPromotions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
