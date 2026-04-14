import mongoose from "mongoose";
import DispatchRequest from "../models/DispatchRequest.js";
import EmployeeStock from "../models/EmployeeStock.js";
import InventoryMovement from "../models/InventoryMovement.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";

const DISPATCH_STATUS = {
  PENDING: "PENDIENTE",
  DISPATCHED: "DESPACHADO",
  RECEIVED: "RECIBIDO",
  CANCELED: "CANCELADO",
};

const MAX_LIMIT = 100;

const aggregateItems = (items = []) => {
  const byProduct = new Map();

  for (const item of items) {
    const quantity = Number(item?.quantity || 0);
    if (!mongoose.isValidObjectId(item?.productId)) {
      throw new Error("Producto inválido en la solicitud");
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("La cantidad debe ser mayor a 0");
    }

    const productId = String(item.productId);
    byProduct.set(productId, Number(byProduct.get(productId) || 0) + quantity);
  }

  return [...byProduct.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

const normalizeStatus = (status) => {
  if (!status) return undefined;
  return String(status).trim().toUpperCase();
};

const toObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const buildDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) return null;

  const range = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }

  return Object.keys(range).length > 0 ? range : null;
};

class DispatchRepository {
  async createRequest(data, businessId, requesterId) {
    const employeeId = data?.employeeId || requesterId;
    const items = Array.isArray(data?.items) ? data.items : [];

    if (!mongoose.isValidObjectId(employeeId)) {
      throw new Error("Employee inválido para la solicitud");
    }

    if (items.length === 0) {
      throw new Error("Debes agregar al menos un producto a la solicitud");
    }

    const normalizedItems = aggregateItems(items);

    const productIds = [
      ...new Set(normalizedItems.map((item) => item.productId)),
    ];
    const existingProducts = await Product.find({
      _id: { $in: productIds },
      business: businessId,
      isDeleted: { $ne: true },
    })
      .select("_id")
      .lean();

    if (existingProducts.length !== productIds.length) {
      throw new Error("Uno o más productos no existen en el negocio activo");
    }

    const totalUnits = normalizedItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const request = await DispatchRequest.create({
      business: businessId,
      employee: employeeId,
      requestedBy: requesterId,
      items: normalizedItems.map((item) => ({
        product: item.productId,
        quantity: item.quantity,
      })),
      totalUnits,
      notes: String(data?.notes || "").trim(),
      status: DISPATCH_STATUS.PENDING,
    });

    return this.findById(request._id, businessId);
  }

  async findById(requestId, businessId) {
    return DispatchRequest.findOne({ _id: requestId, business: businessId })
      .populate("employee", "name email")
      .populate("requestedBy", "name email")
      .populate("dispatchedBy", "name email")
      .populate("receivedBy", "name email")
      .populate("items.product", "name image")
      .lean();
  }

  async findRequests(businessId, filters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { business: businessId };
    const status = normalizeStatus(filters.status);
    if (status) {
      query.status = status;
    }

    if (
      filters.employeeId &&
      mongoose.isValidObjectId(filters.employeeId)
    ) {
      query.employee = filters.employeeId;
    }

    if (filters.requestedBy && mongoose.isValidObjectId(filters.requestedBy)) {
      query.requestedBy = filters.requestedBy;
    }

    const dateRange = buildDateRange(filters.startDate, filters.endDate);
    if (dateRange) {
      query.createdAt = dateRange;
    }

    const [requests, total] = await Promise.all([
      DispatchRequest.find(query)
        .populate("employee", "name email")
        .populate("requestedBy", "name email")
        .populate("dispatchedBy", "name email")
        .populate("receivedBy", "name email")
        .populate("items.product", "name image")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DispatchRequest.countDocuments(query),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async dispatchRequest(requestId, businessId, userId, payload = {}) {
    const shippingGuide = String(payload.shippingGuide || "").trim();
    const guideImage = String(payload.guideImage || "").trim();

    if (!shippingGuide && !guideImage) {
      throw new Error("Debes adjuntar guía de envío o evidencia de despacho");
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const request = await DispatchRequest.findOne({
          _id: requestId,
          business: businessId,
          status: DISPATCH_STATUS.PENDING,
        }).session(session);

        if (!request) {
          throw new Error("La solicitud no existe o ya fue despachada");
        }

        for (const item of request.items) {
          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.product,
              business: businessId,
              warehouseStock: { $gte: item.quantity },
            },
            { $inc: { warehouseStock: -item.quantity } },
            { new: true, session },
          );

          if (!updatedProduct) {
            throw new Error(
              "Stock insuficiente en bodega para completar el despacho",
            );
          }

          await EmployeeStock.findOneAndUpdate(
            {
              business: businessId,
              employee: request.employee,
              product: item.product,
            },
            {
              $inc: { inTransitQuantity: item.quantity },
              $setOnInsert: {
                business: businessId,
                employee: request.employee,
                product: item.product,
                quantity: 0,
              },
            },
            { new: true, upsert: true, session },
          );

          await InventoryMovement.create(
            [
              {
                business: businessId,
                product: item.product,
                quantity: item.quantity,
                movementType: "DISPATCH_OUTBOUND",
                fromLocation: {
                  type: "warehouse",
                  name: "Bodega Central",
                },
                toLocation: {
                  type: "transit",
                  id: request.employee,
                  name: "En tránsito a employee",
                },
                referenceModel: "DispatchRequest",
                referenceId: request._id,
                performedBy: userId,
                notes: `Despacho marcado como ${DISPATCH_STATUS.DISPATCHED}`,
                metadata: {
                  status: DISPATCH_STATUS.DISPATCHED,
                  shippingGuide,
                },
              },
            ],
            { session },
          );
        }

        request.status = DISPATCH_STATUS.DISPATCHED;
        request.shippingGuide = shippingGuide;
        request.guideImage = guideImage;
        request.dispatchNotes = String(payload.dispatchNotes || "").trim();
        request.dispatchedAt = new Date();
        request.dispatchedBy = userId;

        await request.save({ session });
      });
    } finally {
      session.endSession();
    }

    return this.findById(requestId, businessId);
  }

  async confirmReception(
    requestId,
    businessId,
    userId,
    { allowGodBypass = false } = {},
  ) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const request = await DispatchRequest.findOne({
          _id: requestId,
          business: businessId,
          status: DISPATCH_STATUS.DISPATCHED,
        }).session(session);

        if (!request) {
          throw new Error("No hay un despacho pendiente de recepción");
        }

        if (!allowGodBypass && String(request.employee) !== String(userId)) {
          const err = new Error(
            "Solo el employee destino o GOD puede confirmar recepción",
          );
          err.statusCode = 403;
          throw err;
        }

        for (const item of request.items) {
          const updatedStock = await EmployeeStock.findOneAndUpdate(
            {
              business: businessId,
              employee: request.employee,
              product: item.product,
              inTransitQuantity: { $gte: item.quantity },
            },
            {
              $inc: {
                inTransitQuantity: -item.quantity,
                quantity: item.quantity,
              },
            },
            { new: true, session },
          );

          if (!updatedStock) {
            throw new Error(
              "No hay stock en tránsito suficiente para confirmar la recepción",
            );
          }

          await InventoryMovement.create(
            [
              {
                business: businessId,
                product: item.product,
                quantity: item.quantity,
                movementType: "DISPATCH_RECEIVED",
                fromLocation: {
                  type: "transit",
                  id: request.employee,
                  name: "Tránsito logístico",
                },
                toLocation: {
                  type: "employee",
                  id: request.employee,
                  name: "Stock disponible de employee",
                },
                referenceModel: "DispatchRequest",
                referenceId: request._id,
                performedBy: userId,
                notes: `Despacho marcado como ${DISPATCH_STATUS.RECEIVED}`,
                metadata: {
                  status: DISPATCH_STATUS.RECEIVED,
                },
              },
            ],
            { session },
          );
        }

        request.status = DISPATCH_STATUS.RECEIVED;
        request.receivedAt = new Date();
        request.receivedBy = userId;

        await request.save({ session });
      });
    } finally {
      session.endSession();
    }

    return this.findById(requestId, businessId);
  }

  async getPendingCount(businessId, options = {}) {
    const query = {
      business: businessId,
      status: DISPATCH_STATUS.PENDING,
    };

    if (
      options.employeeId &&
      mongoose.isValidObjectId(options.employeeId)
    ) {
      query.employee = options.employeeId;
    }

    return DispatchRequest.countDocuments(query);
  }

  async getHotSectors(businessId, options = {}) {
    const businessObjectId = toObjectId(businessId);
    if (!businessObjectId) {
      throw new Error("Negocio inválido");
    }

    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || 5));
    const dateRange = buildDateRange(options.startDate, options.endDate);

    const baseMatch = {
      business: businessObjectId,
      paymentStatus: "confirmado",
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const [employeeRows, branchRows] = await Promise.all([
      Sale.aggregate([
        { $match: { ...baseMatch, employee: { $ne: null } } },
        {
          $group: {
            _id: "$employee",
            units: { $sum: "$quantity" },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$salePrice", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
            marginProfit: { $sum: { $ifNull: ["$netProfit", "$totalProfit"] } },
          },
        },
        { $sort: { units: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "employeeInfo",
          },
        },
        {
          $unwind: {
            path: "$employeeInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
      ]),
      Sale.aggregate([
        { $match: { ...baseMatch, branch: { $ne: null } } },
        {
          $group: {
            _id: "$branch",
            units: { $sum: "$quantity" },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$salePrice", 0] },
                  { $ifNull: ["$quantity", 0] },
                ],
              },
            },
            marginProfit: { $sum: { $ifNull: ["$netProfit", "$totalProfit"] } },
            branchNameSnapshot: { $first: "$branchName" },
          },
        },
        { $sort: { units: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: "branches",
            localField: "_id",
            foreignField: "_id",
            as: "branchInfo",
          },
        },
        { $unwind: { path: "$branchInfo", preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    const canViewFinancialMargins =
      options.includeFinancialMargins === true &&
      options.hideFinancialData !== true;

    const normalizeZone = (entry, type) => {
      const zoneName =
        type === "employee"
          ? entry.employeeInfo?.name || "Employee sin nombre"
          : entry.branchInfo?.name ||
            entry.branchNameSnapshot ||
            "Sede sin nombre";

      return {
        zoneId: String(entry._id || ""),
        zoneName,
        zoneType: type,
        units: Number(entry.units || 0),
        revenue: canViewFinancialMargins ? Number(entry.revenue || 0) : 0,
        marginProfit: canViewFinancialMargins
          ? Number(entry.marginProfit || 0)
          : 0,
      };
    };

    return {
      canViewFinancialMargins,
      employees: employeeRows.map((entry) =>
        normalizeZone(entry, "employee"),
      ),
      branches: branchRows.map((entry) => normalizeZone(entry, "branch")),
    };
  }
}

export { DISPATCH_STATUS };
export default new DispatchRepository();
