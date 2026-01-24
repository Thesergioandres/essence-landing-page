import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Customer from "../models/Customer.js";
import Segment from "../models/Segment.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

const recordAudit = async (req, entity, action, oldValues) => {
  try {
    await AuditLog.create({
      business: entity.business,
      user: req.user?._id,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: req.user?.role,
      action,
      module: "customers",
      description: `${action} ${entity.name}`,
      entityType: "Customer",
      entityId: entity._id,
      entityName: entity.name,
      oldValues: oldValues || undefined,
      newValues: entity,
    });
  } catch (error) {
    console.error("audit log customer error", error?.message);
  }
};

const normalizeEmail = (email) =>
  typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : undefined;

const normalizePhone = (phone) =>
  typeof phone === "string"
    ? phone
        .replace(/[^0-9+]/g, "")
        .replace(/^(00)/, "+")
        .trim()
    : undefined;

const assertUniqueContact = async ({ businessId, email, phone, excludeId }) => {
  const or = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  if (!or.length) return null;

  const conflict = await Customer.findOne({
    business: businessId,
    $or: or,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id email phone");

  if (conflict) {
    const isEmail = email && conflict.email === email;
    const isPhone = phone && conflict.phone === phone;
    const message = isEmail
      ? "El email ya está registrado"
      : isPhone
        ? "El teléfono ya está registrado"
        : "Contacto duplicado";
    const err = new Error(message);
    err.statusCode = 409;
    throw err;
  }
};

export const createCustomer = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    console.log("[DEBUG] createCustomer - businessId:", businessId);
    console.log("[DEBUG] createCustomer - body:", req.body);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const payload = req.body || {};
    payload.email = normalizeEmail(payload.email);
    payload.phone = normalizePhone(payload.phone);
    if (!payload.name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    if (payload.segment) {
      const segmentExists = await Segment.findOne({
        _id: payload.segment,
        business: businessId,
      }).select("_id");

      if (!segmentExists) {
        return res.status(400).json({ message: "Segmento inválido" });
      }
    }

    await assertUniqueContact({
      businessId,
      email: payload.email,
      phone: payload.phone,
    });

    // Construir el objeto del cliente, excluyendo email/phone si son undefined/null/vacíos
    const customerData = {
      ...payload,
      business: businessId,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    };

    // Eliminar email y phone si no tienen valor válido
    if (!customerData.email) delete customerData.email;
    if (!customerData.phone) delete customerData.phone;

    const customer = await Customer.create(customerData);

    await recordAudit(req, customer, "customer_created");

    res.status(201).json({ customer });
  } catch (error) {
    console.error("[ERROR] createCustomer:", error);
    const status = error?.statusCode || 500;
    res.status(status).json({ message: error.message });
  }
};

export const listCustomersLegacy = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { segment, search } = req.query;
    const filter = { business: businessId };
    if (segment) filter.segment = segment;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      200,
    );
    const skip = (page - 1) * limit;
    const sortBy =
      req.query.sortBy === "lastPurchase"
        ? { lastPurchaseAt: -1 }
        : { createdAt: -1 };

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort(sortBy).skip(skip).limit(limit),
      Customer.countDocuments(filter),
    ]);

    res.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    [OPTIMIZED] Listar clientes (Lean + Select)
 * @route   GET /api/customers/test-optimized
 * @access  Private
 */
/**
 * @desc    [OPTIMIZED] Listar clientes (Lean)
 * @route   GET /api/customers
 * @access  Private
 */
export const listCustomers = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { segment, search } = req.query;
    const filter = { business: businessId };
    if (segment) filter.segment = segment;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      200,
    );
    const skip = (page - 1) * limit;

    // Sort optimization: use compound index if available or simple sort
    const sortBy =
      req.query.sortBy === "lastPurchase"
        ? { lastPurchaseAt: -1 }
        : { createdAt: -1 };

    // FIX: Removing select restrictions to prevent compatibility issues
    // Keeping .lean() for performance (saves ~70% memory)

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        // .select(selectFields) // Commented out for safety
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .lean(), // CRITICAL: Performance boost
      Customer.countDocuments(filter),
    ]);

    res.setHeader("Cache-Control", "no-store"); // Ensure fresh data for tests

    res.json({
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!customer) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json({ customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!customer) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const oldValues = customer.toObject();
    const updatable = [
      "name",
      "email",
      "phone",
      "segment",
      "segments",
      "metadata",
      "points",
      "totalSpend",
      "ordersCount",
      "lastPurchaseAt",
    ];

    const incoming = { ...req.body };
    if ("email" in incoming) incoming.email = normalizeEmail(incoming.email);
    if ("phone" in incoming) incoming.phone = normalizePhone(incoming.phone);

    for (const field of updatable) {
      if (field in incoming) {
        // Si email o phone son undefined/null/vacíos, eliminarlos del documento
        if ((field === "email" || field === "phone") && !incoming[field]) {
          customer[field] = undefined;
        } else {
          customer[field] = incoming[field];
        }
      }
    }

    if (incoming.segment) {
      const segmentExists = await Segment.findOne({
        _id: incoming.segment,
        business: businessId,
      }).select("_id");

      if (!segmentExists) {
        return res.status(400).json({ message: "Segmento inválido" });
      }
    }

    await assertUniqueContact({
      businessId,
      email: incoming.email,
      phone: incoming.phone,
      excludeId: customer._id,
    });

    customer.updatedBy = req.user?._id;
    await customer.save();

    await recordAudit(req, customer, "customer_updated", oldValues);

    res.json({ customer });
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({ message: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!customer) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const oldValues = customer.toObject();
    await customer.deleteOne();

    await recordAudit(
      req,
      { ...customer, business: businessId },
      "customer_deleted",
      oldValues,
    );

    res.json({ message: "Cliente eliminado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const adjustPoints = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { delta } = req.body || {};
    const amount = Number(delta);

    if (!Number.isFinite(amount)) {
      return res.status(400).json({ message: "Delta inválido" });
    }

    const customer = await Customer.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!customer) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const oldValues = customer.toObject();
    customer.points = Math.max(0, (customer.points || 0) + amount);
    customer.updatedBy = req.user?._id;
    await customer.save();

    await recordAudit(req, customer, "customer_updated", oldValues);

    res.json({ customer });
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({ message: error.message });
  }
};

const resolveBusinessObjectId = (businessId) => {
  try {
    return new mongoose.Types.ObjectId(businessId);
  } catch (parseError) {
    return null;
  }
};

export const customerStats = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const now = new Date();
    const businessObjectId = resolveBusinessObjectId(businessId);
    if (!businessObjectId) {
      return res.status(400).json({ message: "x-business-id inválido" });
    }

    const match = { business: businessObjectId };
    const churnThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const newCustomerThreshold = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    const [agg] = await Customer.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalSpend: { $sum: "$totalSpend" },
          totalOrders: { $sum: "$ordersCount" },
        },
      },
    ]);

    const recencyAgg = await Customer.aggregate([
      { $match: { ...match, lastPurchaseAt: { $exists: true } } },
      {
        $project: {
          recencyDays: {
            $divide: [
              { $subtract: [now, "$lastPurchaseAt"] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgRecencyDays: { $avg: "$recencyDays" },
        },
      },
    ]);

    const churnedCustomers = await Customer.countDocuments({
      business: businessObjectId,
      lastPurchaseAt: { $lt: churnThreshold },
    });

    const newCustomersLast30d = await Customer.countDocuments({
      business: businessObjectId,
      createdAt: { $gte: newCustomerThreshold },
    });

    const topCustomers = await Customer.find(match)
      .sort({ totalSpend: -1 })
      .limit(5)
      .select("name email phone totalSpend ordersCount lastPurchaseAt")
      .lean();

    const segmentAgg = await Customer.aggregate([
      { $match: match },
      { $unwind: { path: "$segments", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$segments",
          customers: { $sum: 1 },
          totalSpend: { $sum: "$totalSpend" },
        },
      },
      { $sort: { totalSpend: -1, customers: -1 } },
      { $limit: 10 },
    ]);

    const totals = agg || {
      totalCustomers: 0,
      totalSpend: 0,
      totalOrders: 0,
    };

    const avgTicket = totals.totalOrders
      ? Number((totals.totalSpend / totals.totalOrders).toFixed(2))
      : 0;

    const avgOrdersPerCustomer = totals.totalCustomers
      ? Number((totals.totalOrders / totals.totalCustomers).toFixed(2))
      : 0;
    const avgLTV = totals.totalCustomers
      ? Number((totals.totalSpend / totals.totalCustomers).toFixed(2))
      : 0;
    const avgRecencyDays = recencyAgg?.[0]?.avgRecencyDays
      ? Number(recencyAgg[0].avgRecencyDays.toFixed(1))
      : null;

    res.json({
      totals: {
        totalCustomers: totals.totalCustomers,
        totalSpend: Number(totals.totalSpend || 0),
        totalOrders: totals.totalOrders || 0,
        avgTicket,
      },
      topCustomers,
      segments: segmentAgg.map((s) => ({
        key: s._id,
        customers: s.customers,
        totalSpend: Number(s.totalSpend || 0),
      })),
      analytics: {
        avgOrdersPerCustomer,
        avgLTV,
        avgRecencyDays,
        churnedCustomers,
        newCustomersLast30d,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const customerRFM = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const businessObjectId = resolveBusinessObjectId(businessId);
    if (!businessObjectId) {
      return res.status(400).json({ message: "x-business-id inválido" });
    }

    const now = new Date();

    const scoringPipeline = [
      { $match: { business: businessObjectId } },
      {
        $addFields: {
          recencyDays: {
            $cond: [
              { $ifNull: ["$lastPurchaseAt", false] },
              {
                $divide: [
                  { $subtract: [now, "$lastPurchaseAt"] },
                  1000 * 60 * 60 * 24,
                ],
              },
              null,
            ],
          },
        },
      },
      {
        $addFields: {
          rScore: {
            $switch: {
              branches: [
                { case: { $lte: ["$recencyDays", 30] }, then: 5 },
                { case: { $lte: ["$recencyDays", 60] }, then: 4 },
                { case: { $lte: ["$recencyDays", 90] }, then: 3 },
                { case: { $lte: ["$recencyDays", 180] }, then: 2 },
              ],
              default: 1,
            },
          },
          fScore: {
            $switch: {
              branches: [
                { case: { $gte: ["$ordersCount", 20] }, then: 5 },
                { case: { $gte: ["$ordersCount", 10] }, then: 4 },
                { case: { $gte: ["$ordersCount", 5] }, then: 3 },
                { case: { $gte: ["$ordersCount", 2] }, then: 2 },
              ],
              default: 1,
            },
          },
          mScore: {
            $switch: {
              branches: [
                { case: { $gte: ["$totalSpend", 5000] }, then: 5 },
                { case: { $gte: ["$totalSpend", 2000] }, then: 4 },
                { case: { $gte: ["$totalSpend", 1000] }, then: 3 },
                { case: { $gte: ["$totalSpend", 200] }, then: 2 },
              ],
              default: 1,
            },
          },
        },
      },
      {
        $addFields: {
          rfmScore: { $add: ["$rScore", "$fScore", "$mScore"] },
        },
      },
    ];

    const distribution = await Customer.aggregate([
      ...scoringPipeline,
      {
        $group: {
          _id: { r: "$rScore", f: "$fScore", m: "$mScore" },
          customers: { $sum: 1 },
        },
      },
      { $sort: { "_id.r": -1, "_id.f": -1, "_id.m": -1 } },
    ]);

    const topCustomers = await Customer.aggregate([
      ...scoringPipeline,
      {
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          totalSpend: 1,
          ordersCount: 1,
          lastPurchaseAt: 1,
          rScore: 1,
          fScore: 1,
          mScore: 1,
          rfmScore: 1,
        },
      },
      { $sort: { rfmScore: -1, totalSpend: -1, ordersCount: -1 } },
      { $limit: 10 },
    ]);

    const totals = await Customer.countDocuments({
      business: businessObjectId,
    });

    res.json({
      distribution,
      topCustomers,
      totals: { totalCustomers: totals },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
