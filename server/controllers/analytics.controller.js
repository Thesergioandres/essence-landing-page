import mongoose from "mongoose";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import Credit from "../models/Credit.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import DistributorStock from "../models/DistributorStock.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import SpecialSale from "../models/SpecialSale.js";

// Normaliza el filtro de negocio a ObjectId para evitar fallos de coincidencia
const buildBusinessFilter = (req) =>
  req.businessId
    ? { business: new mongoose.Types.ObjectId(req.businessId) }
    : {};

const ensureBusinessId = (req, res) => {
  const businessId =
    req.businessId || req.headers?.["x-business-id"] || req.query?.businessId;
  if (!businessId) {
    res.status(400).json({ message: "Falta x-business-id" });
    return null;
  }
  req.businessId = businessId;
  return businessId;
};

// Construye un rango de fechas usando la zona horaria de Colombia (UTC-5)
const buildColombiaRange = (startStr, endStr) => {
  if (!startStr && !endStr) return null;

  const range = {};

  if (startStr) {
    const date = new Date(startStr);
    range.$gte = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        5,
        0,
        0,
        0,
      ),
    );
  }
  if (endStr) {
    const date = new Date(endStr);
    range.$lte = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
        4,
        59,
        59,
        999,
      ),
    );
  }

  return range;
};

// @desc    Obtener resumen de ganancias del mes actual
// @route   GET /api/analytics/monthly-profit
// @access  Private/Admin
export const getMonthlyProfit = async (req, res) => {
  try {
    const businessId = ensureBusinessId(req, res);
    if (!businessId) return;
    const businessFilter = buildBusinessFilter(req);

    // Límites de mes en UTC para evitar desfaces por timezone
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0) - 1);

    const startOfLastMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfLastMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - 1);

    const baseSaleMatch = {
      paymentStatus: "confirmado",
      ...businessFilter,
    };

    const sumPipeline = (start, end) => [
      { $match: { ...baseSaleMatch } },
      {
        $addFields: {
          opDate: { $ifNull: ["$saleDate", "$createdAt"] },
        },
      },
      {
        $match: {
          opDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          adminProfit: { $sum: "$adminProfit" },
          distributorProfit: { $sum: "$distributorProfit" },
          totalProfit: { $sum: "$totalProfit" },
          // Ganancia neta (descontando costos adicionales, envío y descuentos)
          netProfit: { $sum: { $ifNull: ["$netProfit", "$totalProfit"] } },
          // Costos adicionales totales
          totalAdditionalCosts: {
            $sum: { $ifNull: ["$totalAdditionalCosts", 0] },
          },
          totalShippingCosts: { $sum: { $ifNull: ["$shippingCost", 0] } },
          totalDiscounts: { $sum: { $ifNull: ["$discount", 0] } },
          revenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          cost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          // Contar ventas únicas por saleGroupId
          saleGroupIds: { $addToSet: "$saleGroupId" },
          salesCount: { $sum: 1 },
          unitsCount: { $sum: "$quantity" },
        },
      },
      {
        $addFields: {
          // Número de órdenes únicas (grupos de ventas)
          ordersCount: {
            $size: {
              $filter: {
                input: "$saleGroupIds",
                as: "groupId",
                cond: { $ne: ["$$groupId", null] },
              },
            },
          },
        },
      },
    ];

    const sumSpecialPipeline = (start, end) => [
      { $match: { status: "active", ...businessFilter } },
      {
        $addFields: {
          opDate: { $ifNull: ["$saleDate", "$createdAt"] },
        },
      },
      {
        $match: {
          opDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$totalProfit" },
          revenue: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
          cost: { $sum: { $multiply: ["$cost", "$quantity"] } },
          salesCount: { $sum: 1 },
          unitsCount: { $sum: "$quantity" },
        },
      },
    ];

    const [currentSaleAgg, lastSaleAgg, currentSpecialAgg, lastSpecialAgg] =
      await Promise.all([
        Sale.aggregate(sumPipeline(startOfMonth, endOfMonth)),
        Sale.aggregate(sumPipeline(startOfLastMonth, endOfLastMonth)),
        SpecialSale.aggregate(sumSpecialPipeline(startOfMonth, endOfMonth)),
        SpecialSale.aggregate(
          sumSpecialPipeline(startOfLastMonth, endOfLastMonth),
        ),
      ]);

    const normalize = (main = {}, special = {}) => {
      const m = main || {};
      const s = special || {};
      return {
        adminProfit: m.adminProfit || 0,
        distributorProfit: m.distributorProfit || 0,
        totalProfit: (m.totalProfit || 0) + (s.totalProfit || 0),
        // Ganancia neta (después de costos adicionales, envío y descuentos)
        netProfit: (m.netProfit || 0) + (s.totalProfit || 0),
        // Costos adicionales agregados
        totalAdditionalCosts: m.totalAdditionalCosts || 0,
        totalShippingCosts: m.totalShippingCosts || 0,
        totalDiscounts: m.totalDiscounts || 0,
        revenue: (m.revenue || 0) + (s.revenue || 0),
        cost: (m.cost || 0) + (s.cost || 0),
        // salesCount = número de documentos de venta (productos vendidos)
        salesCount: (m.salesCount || 0) + (s.salesCount || 0),
        // ordersCount = número de órdenes únicas (grupos de productos)
        ordersCount: (m.ordersCount || m.salesCount || 0) + (s.salesCount || 0),
        unitsCount: (m.unitsCount || 0) + (s.unitsCount || 0),
      };
    };

    const currentMonth = normalize(currentSaleAgg[0], currentSpecialAgg[0]);
    const lastMonth = normalize(lastSaleAgg[0], lastSpecialAgg[0]);

    // Calcular porcentaje de crecimiento usando ganancia NETA
    const growthPercentage =
      lastMonth.netProfit > 0
        ? ((currentMonth.netProfit - lastMonth.netProfit) /
            lastMonth.netProfit) *
          100
        : currentMonth.netProfit > 0
          ? 100
          : 0;

    res.json({
      currentMonth,
      lastMonth,
      growthPercentage: parseFloat(growthPercentage.toFixed(2)),
      // Ticket promedio por orden (no por documento de venta)
      averageTicket:
        currentMonth.ordersCount > 0
          ? currentMonth.revenue / currentMonth.ordersCount
          : 0,
      // Debug info
      _debug: {
        nowUTC: now.toISOString(),
        nowColombia: now.toISOString(),
        startOfMonth: startOfMonth.toISOString(),
        endOfMonth: endOfMonth.toISOString(),
        startOfLastMonth: startOfLastMonth.toISOString(),
        endOfLastMonth: endOfLastMonth.toISOString(),
        currentMonthSalesCount: currentMonth.salesCount,
        currentMonthOrdersCount: currentMonth.ordersCount,
        lastMonthSalesCount: lastMonth.salesCount,
        lastMonthOrdersCount: lastMonth.ordersCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener ganancias por producto
// @route   GET /api/analytics/profit-by-product
// @access  Private/Admin
export const getProfitByProduct = async (req, res) => {
  try {
    const businessId = ensureBusinessId(req, res);
    if (!businessId) return;
    const businessFilter = buildBusinessFilter(req);
    const { startDate, endDate } = req.query;

    const filter = { paymentStatus: "confirmado", ...businessFilter };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) {
        // Convertir fecha a inicio del día en Colombia (00:00 Colombia = 05:00 UTC)
        const date = new Date(startDate);
        filter.saleDate.$gte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            5,
            0,
            0,
          ),
        );
      }
      if (endDate) {
        // Convertir fecha a fin del día en Colombia (23:59:59 Colombia = 04:59:59 UTC del día siguiente)
        const date = new Date(endDate);
        filter.saleDate.$lte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1,
            4,
            59,
            59,
            999,
          ),
        );
      }
    }

    const salesAgg = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: {
            $sum: { $multiply: ["$salePrice", "$quantity"] },
          },
          totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
          totalProfit: { $sum: "$totalProfit" },
          // Ganancia neta después de costos adicionales
          totalNetProfit: { $sum: { $ifNull: ["$netProfit", "$totalProfit"] } },
          totalAdditionalCosts: {
            $sum: { $ifNull: ["$totalAdditionalCosts", 0] },
          },
          // Contar órdenes únicas
          saleGroupIds: { $addToSet: "$saleGroupId" },
        },
      },
      {
        $addFields: {
          totalOrders: {
            $size: {
              $filter: {
                input: "$saleGroupIds",
                as: "groupId",
                cond: { $ne: ["$$groupId", null] },
              },
            },
          },
        },
      },
    ]);

    const specialMatch = {
      status: "active",
      ...businessFilter,
      ...(filter.saleDate ? { saleDate: filter.saleDate } : {}),
      "product.productId": { $exists: true, $ne: null },
    };

    const specialAgg = await SpecialSale.aggregate([
      { $match: specialMatch },
      {
        $group: {
          _id: "$product.productId",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: {
            $sum: { $multiply: ["$specialPrice", "$quantity"] },
          },
          totalCost: { $sum: { $multiply: ["$cost", "$quantity"] } },
          totalAdminProfit: { $sum: "$totalProfit" },
          totalDistributorProfit: { $sum: 0 },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    const merged = new Map();

    for (const item of [...salesAgg, ...specialAgg]) {
      const key = item._id?.toString();
      if (!key) continue;
      const existing = merged.get(key) || {
        _id: item._id,
        totalQuantity: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalAdminProfit: 0,
        totalDistributorProfit: 0,
        totalProfit: 0,
      };

      existing.totalQuantity += item.totalQuantity || 0;
      existing.totalSales += item.totalSales || 0;
      existing.totalRevenue += item.totalRevenue || 0;
      existing.totalCost += item.totalCost || 0;
      existing.totalAdminProfit += item.totalAdminProfit || 0;
      existing.totalDistributorProfit += item.totalDistributorProfit || 0;
      existing.totalProfit += item.totalProfit || 0;

      merged.set(key, existing);
    }

    const profitByProduct = await Promise.all(
      [...merged.values()].map(async (item) => {
        const product = await mongoose
          .model("Product")
          .findById(item._id)
          .select("name image")
          .lean();

        const totalRevenue = item.totalRevenue || 0;
        const totalProfit = item.totalProfit || 0;

        return {
          productId: item._id,
          productName: product?.name || "Producto eliminado",
          productImage: product?.image,
          totalQuantity: item.totalQuantity,
          totalSales: item.totalSales,
          totalRevenue,
          totalCost: item.totalCost || 0,
          totalAdminProfit: item.totalAdminProfit,
          totalDistributorProfit: item.totalDistributorProfit,
          totalProfit,
          profitMargin:
            totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
        };
      }),
    );

    res.json(profitByProduct.sort((a, b) => b.totalProfit - a.totalProfit));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener ganancias por distribuidor
// @route   GET /api/analytics/profit-by-distributor
// @access  Private/Admin
export const getProfitByDistributor = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const { startDate: startDateStr, endDate: endDateStr } = req.query;
    const dateRange = buildColombiaRange(startDateStr, endDateStr);

    const filter = {
      paymentStatus: "confirmado",
      ...businessFilter,
    };

    if (dateRange) filter.saleDate = dateRange;

    const salesAgg = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$distributor",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: {
            $sum: { $multiply: ["$salePrice", "$quantity"] },
          },
          totalCost: { $sum: { $multiply: ["$purchasePrice", "$quantity"] } },
          totalAdminProfit: { $sum: "$adminProfit" },
          totalDistributorProfit: { $sum: "$distributorProfit" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    const specialMatch = {
      status: "active",
      ...businessFilter,
      ...(dateRange ? { saleDate: dateRange } : {}),
    };

    const specialAgg = await SpecialSale.aggregate([
      { $match: specialMatch },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: 1 },
          totalRevenue: {
            $sum: { $multiply: ["$specialPrice", "$quantity"] },
          },
          totalCost: { $sum: { $multiply: ["$cost", "$quantity"] } },
          totalAdminProfit: { $sum: "$totalProfit" },
          totalDistributorProfit: { $sum: 0 },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    const merged = new Map();

    for (const item of salesAgg) {
      merged.set(item._id ? item._id.toString() : "admin", item);
    }

    if (specialAgg[0]) {
      const key = "admin"; // ventas especiales se cuentan como admin
      const existing = merged.get(key) || {
        _id: null,
        totalQuantity: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalAdminProfit: 0,
        totalDistributorProfit: 0,
        totalProfit: 0,
      };

      existing.totalQuantity += specialAgg[0].totalQuantity || 0;
      existing.totalSales += specialAgg[0].totalSales || 0;
      existing.totalRevenue += specialAgg[0].totalRevenue || 0;
      existing.totalCost += specialAgg[0].totalCost || 0;
      existing.totalAdminProfit += specialAgg[0].totalAdminProfit || 0;
      existing.totalDistributorProfit +=
        specialAgg[0].totalDistributorProfit || 0;
      existing.totalProfit += specialAgg[0].totalProfit || 0;

      merged.set(key, existing);
    }

    const profitByDistributor = await Promise.all(
      [...merged.values()].map(async (item) => {
        const distributorDoc = item._id
          ? await mongoose
              .model("User")
              .findById(item._id)
              .select("name email")
              .lean()
          : null;

        const totalRevenue = item.totalRevenue || 0;
        const totalSales = item.totalSales || 0;

        return {
          distributorName: distributorDoc?.name || "Ventas administradas",
          distributorEmail: distributorDoc?.email || null,
          totalQuantity: item.totalQuantity,
          totalSales,
          totalRevenue,
          totalCost: item.totalCost || 0,
          totalAdminProfit: item.totalAdminProfit,
          totalDistributorProfit: item.totalDistributorProfit,
          totalProfit: item.totalProfit,
          averageSale: totalSales > 0 ? totalRevenue / totalSales : 0,
        };
      }),
    );

    res.json(
      profitByDistributor.sort((a, b) => b.totalRevenue - a.totalRevenue),
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener promedios diarios/semanales/mensuales
// @route   GET /api/analytics/averages
// @access  Private/Admin
export const getAverages = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const {
      period = "month",
      startDate: startDateStr,
      endDate: endDateStr,
    } = req.query; // day, week, month

    const now = new Date();
    let startDate, endDate, days;

    const buildColombiaRange = (startStr, endStr) => {
      if (!startStr && !endStr) return null;

      const range = {};

      if (startStr) {
        const date = new Date(startStr);
        range.$gte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            5,
            0,
            0,
            0,
          ),
        );
      }
      if (endStr) {
        const date = new Date(endStr);
        range.$lte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1,
            4,
            59,
            59,
            999,
          ),
        );
      }

      return range;
    };

    const computeDaysInclusive = (startStr, endStr) => {
      if (!startStr || !endStr) return null;
      const s = new Date(startStr);
      const e = new Date(endStr);
      const sDay = Date.UTC(
        s.getUTCFullYear(),
        s.getUTCMonth(),
        s.getUTCDate(),
      );
      const eDay = Date.UTC(
        e.getUTCFullYear(),
        e.getUTCMonth(),
        e.getUTCDate(),
      );
      const diff = Math.floor((eDay - sDay) / 86400000) + 1;
      return Math.max(diff, 1);
    };

    const customDays = computeDaysInclusive(startDateStr, endDateStr);

    if (startDateStr || endDateStr) {
      const range = buildColombiaRange(startDateStr, endDateStr);
      startDate = range?.$gte;
      endDate = range?.$lte;
      days = customDays ?? 1;
    } else {
      switch (period) {
        case "day":
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          days = 1;
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          days = 7;
          break;
        case "month":
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          days = now.getDate();
          break;
      }
    }

    const saleFilter = {
      paymentStatus: "confirmado",
      ...businessFilter,
      ...(startDate || endDate
        ? {
            saleDate: {
              ...(startDate ? { $gte: startDate } : {}),
              ...(endDate ? { $lte: endDate } : {}),
            },
          }
        : { saleDate: { $gte: startDate } }),
    };

    const specialFilter = {
      status: "active",
      ...businessFilter,
      ...(startDate || endDate
        ? {
            saleDate: {
              ...(startDate ? { $gte: startDate } : {}),
              ...(endDate ? { $lte: endDate } : {}),
            },
          }
        : { saleDate: { $gte: startDate } }),
    };

    const [sales, specialSales] = await Promise.all([
      Sale.find(saleFilter),
      SpecialSale.find(specialFilter),
    ]);

    const totals = sales.reduce(
      (acc, sale) => {
        acc.totalRevenue += sale.salePrice * sale.quantity;
        acc.totalProfit += sale.totalProfit;
        acc.totalSales += 1;
        acc.totalUnits += sale.quantity;
        return acc;
      },
      { totalRevenue: 0, totalProfit: 0, totalSales: 0, totalUnits: 0 },
    );

    // Incluir ventas especiales en promedios
    specialSales.forEach((sale) => {
      totals.totalRevenue += sale.specialPrice * sale.quantity;
      totals.totalProfit += sale.totalProfit;
      totals.totalSales += 1;
      totals.totalUnits += sale.quantity;
    });

    res.json({
      period,
      days,
      averageRevenuePerDay: totals.totalRevenue / days,
      averageProfitPerDay: totals.totalProfit / days,
      averageSalesPerDay: totals.totalSales / days,
      averageUnitsPerDay: totals.totalUnits / days,
      totalRevenue: totals.totalRevenue,
      totalProfit: totals.totalProfit,
      totalSales: totals.totalSales,
      totalUnits: totals.totalUnits,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener datos para gráfica de ventas en el tiempo
// @route   GET /api/analytics/sales-timeline
// @access  Private/Admin
export const getSalesTimeline = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const {
      days = 30,
      startDate: startDateStr,
      endDate: endDateStr,
    } = req.query;

    let dateFilter;
    if (startDateStr || endDateStr) {
      dateFilter = buildColombiaRange(startDateStr, endDateStr);
    } else {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      startDate.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startDate };
    }

    const opDateFilter = {
      $or: [
        { saleDate: dateFilter },
        { paymentConfirmedAt: dateFilter },
        { createdAt: dateFilter },
      ],
    };

    const sales = await Sale.find({
      paymentStatus: "confirmado",
      ...businessFilter,
      ...opDateFilter,
    })
      .select(
        "saleDate salePrice quantity totalProfit netProfit totalAdditionalCosts shippingCost discount purchasePrice paymentStatus saleGroupId",
      )
      .sort({ saleDate: 1 })
      .lean();

    const specialSales = await SpecialSale.find({
      ...businessFilter,
      status: "active",
      $or: [{ saleDate: dateFilter }, { createdAt: dateFilter }],
    })
      .select("saleDate specialPrice quantity totalProfit cost status")
      .sort({ saleDate: 1 })
      .lean();

    // Agrupar por día
    const salesByDay = {};
    const orderIdsByDay = {}; // Para contar órdenes únicas por día
    const toColombiaDayKey = (date) => {
      // Convertimos a día Colombia (UTC-5) para evitar corrimientos de fecha
      const colombia = new Date(date.getTime() - 5 * 60 * 60000);
      return colombia.toISOString().split("T")[0];
    };
    sales.forEach((sale) => {
      const opDate = sale.saleDate || sale.paymentConfirmedAt || sale.createdAt;
      if (!opDate) return; // omit invalid records
      const day = toColombiaDayKey(new Date(opDate));
      if (!salesByDay[day]) {
        salesByDay[day] = {
          date: day,
          sales: 0,
          ordersCount: 0,
          revenue: 0,
          profit: 0,
          units: 0,
          cost: 0,
        };
        orderIdsByDay[day] = new Set();
      }
      salesByDay[day].sales += 1;
      // Contar órdenes únicas por saleGroupId
      const orderId = sale.saleGroupId?.toString() || sale._id?.toString();
      orderIdsByDay[day].add(orderId);
      salesByDay[day].revenue += sale.salePrice * sale.quantity;
      // Usar netProfit si existe, sino calcular: totalProfit - deducciones
      const saleNetProfit =
        sale.netProfit ??
        (sale.totalProfit || 0) -
          (sale.totalAdditionalCosts || 0) -
          (sale.shippingCost || 0) -
          (sale.discount || 0);
      salesByDay[day].profit += saleNetProfit;
      salesByDay[day].units += sale.quantity;
      salesByDay[day].cost += sale.purchasePrice * sale.quantity;
    });

    // Agregar ventas especiales
    specialSales.forEach((sale) => {
      const opDate = sale.saleDate || sale.createdAt;
      if (!opDate) return; // omit invalid records
      const day = toColombiaDayKey(new Date(opDate));
      if (!salesByDay[day]) {
        salesByDay[day] = {
          date: day,
          sales: 0,
          ordersCount: 0,
          revenue: 0,
          profit: 0,
          units: 0,
          cost: 0,
        };
        orderIdsByDay[day] = new Set();
      }
      salesByDay[day].sales += 1;
      // Ventas especiales se cuentan como órdenes individuales
      orderIdsByDay[day].add(`special_${sale._id?.toString()}`);
      salesByDay[day].revenue += sale.specialPrice * sale.quantity;
      salesByDay[day].profit += sale.totalProfit;
      salesByDay[day].units += sale.quantity;
      salesByDay[day].cost += sale.cost * sale.quantity;
    });

    // Calcular ordersCount final para cada día
    Object.keys(salesByDay).forEach((day) => {
      salesByDay[day].ordersCount = orderIdsByDay[day]?.size || 0;
    });

    const timeline = Object.values(salesByDay);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener resumen financiero completo
// @route   GET /api/analytics/financial-summary
// @access  Private/Admin
export const getFinancialSummary = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const { startDate, endDate } = req.query;

    const filter = { paymentStatus: "confirmado", ...businessFilter };
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) {
        // Convertir fecha a inicio del día en Colombia (00:00 Colombia = 05:00 UTC)
        const date = new Date(startDate);
        filter.saleDate.$gte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            5,
            0,
            0,
          ),
        );
      }
      if (endDate) {
        // Convertir fecha a fin del día en Colombia (23:59:59 Colombia = 04:59:59 UTC del día siguiente)
        const date = new Date(endDate);
        filter.saleDate.$lte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1,
            4,
            59,
            59,
            999,
          ),
        );
      }
    }

    const sales = await Sale.find(filter)
      .select(
        "salePrice purchasePrice quantity totalProfit netProfit totalAdditionalCosts shippingCost discount adminProfit distributorProfit saleGroupId",
      )
      .lean();

    const specialFilter = { status: "active", ...businessFilter };
    if (startDate || endDate) {
      specialFilter.saleDate = {};
      if (startDate) {
        const date = new Date(startDate);
        specialFilter.saleDate.$gte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            5,
            0,
            0,
          ),
        );
      }
      if (endDate) {
        const date = new Date(endDate);
        specialFilter.saleDate.$lte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1,
            4,
            59,
            59,
            999,
          ),
        );
      }
    }

    const specialSales = await SpecialSale.find(specialFilter)
      .select("specialPrice cost quantity totalProfit")
      .lean();

    const defectiveDateRange = buildColombiaRange(startDate, endDate);

    const defectiveProducts = await DefectiveProduct.find({
      status: "confirmado",
      ...businessFilter,
      ...(defectiveDateRange ? { reportDate: defectiveDateRange } : {}),
    });

    // Calcular totales
    const saleGroupIds = new Set();
    const totals = sales.reduce(
      (acc, sale) => {
        acc.totalCost += sale.purchasePrice * sale.quantity;
        acc.totalRevenue += sale.salePrice * sale.quantity;
        acc.totalAdminProfit += sale.adminProfit;
        acc.totalDistributorProfit += sale.distributorProfit;
        // Usar netProfit si existe, sino calcular: totalProfit - deducciones
        const saleNetProfit =
          sale.netProfit ??
          (sale.totalProfit || 0) -
            (sale.totalAdditionalCosts || 0) -
            (sale.shippingCost || 0) -
            (sale.discount || 0);
        acc.totalProfit += saleNetProfit;
        acc.totalSales += 1;
        acc.totalUnits += sale.quantity;
        // Agregar saleGroupId al Set (si no existe, usar _id del documento)
        saleGroupIds.add(sale.saleGroupId?.toString() || sale._id?.toString());
        return acc;
      },
      {
        totalCost: 0,
        totalRevenue: 0,
        totalAdminProfit: 0,
        totalDistributorProfit: 0,
        totalProfit: 0,
        totalSales: 0,
        totalUnits: 0,
      },
    );

    // Agregar ventas especiales a los totales
    specialSales.forEach((sale) => {
      totals.totalCost += sale.cost * sale.quantity;
      totals.totalRevenue += sale.specialPrice * sale.quantity;
      totals.totalProfit += sale.totalProfit;
      totals.totalSales += 1;
      totals.totalUnits += sale.quantity;
    });

    // Calcular pérdidas por defectuosos
    const defectiveLoss = defectiveProducts.reduce((sum, def) => {
      return sum + def.quantity;
    }, 0);

    console.log("[getFinancialSummary] saleGroupIds:", [...saleGroupIds]);
    console.log(
      "[getFinancialSummary] totalSales:",
      totals.totalSales,
      "ordersCount:",
      saleGroupIds.size,
    );

    res.json({
      ...totals,
      ordersCount: saleGroupIds.size,
      profitMargin:
        totals.totalRevenue > 0
          ? (totals.totalProfit / totals.totalRevenue) * 100
          : 0,
      averageTicket:
        saleGroupIds.size > 0 ? totals.totalRevenue / saleGroupIds.size : 0,
      defectiveUnits: defectiveLoss,
      defectiveRate:
        totals.totalUnits > 0 ? (defectiveLoss / totals.totalUnits) * 100 : 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener dashboard completo de analytics
// @route   GET /api/analytics/dashboard
// @access  Private/Admin
export const getAnalyticsDashboard = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ventas del mes
    const monthlySales = await Sale.find({
      saleDate: { $gte: startOfMonth },
      paymentStatus: "confirmado",
      ...businessFilter,
    });

    // Ventas especiales del mes
    const monthlySpecialSales = await SpecialSale.find({
      saleDate: { $gte: startOfMonth },
      status: "active",
      ...businessFilter,
    });

    // Top productos (incluye especiales)
    const topProducts = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfMonth },
          paymentStatus: "confirmado",
          ...businessFilter,
        },
      },
      {
        $project: {
          product: "$product",
          quantity: "$quantity",
          totalProfit: "$totalProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                status: "active",
                saleDate: { $gte: startOfMonth },
                ...businessFilter,
              },
            },
            { $match: { "product.productId": { $exists: true, $ne: null } } },
            {
              $project: {
                product: "$product.productId",
                quantity: "$quantity",
                totalProfit: "$totalProfit",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$product",
          totalQuantity: { $sum: "$quantity" },
          totalProfit: { $sum: "$totalProfit" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.name",
          image: "$product.image",
          totalQuantity: 1,
          totalProfit: 1,
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    // Top distribuidores (incluye especiales como ventas administradas)
    const topDistributors = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfMonth },
          paymentStatus: "confirmado",
          ...businessFilter,
        },
      },
      {
        $project: {
          distributor: "$distributor",
          adminProfit: "$adminProfit",
        },
      },
      {
        $unionWith: {
          coll: "specialsales",
          pipeline: [
            {
              $match: {
                status: "active",
                saleDate: { $gte: startOfMonth },
                ...businessFilter,
              },
            },
            {
              $project: {
                distributor: null,
                adminProfit: "$totalProfit",
              },
            },
          ],
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalSales: { $sum: 1 },
          totalProfit: { $sum: "$adminProfit" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "distributor",
        },
      },
      {
        $unwind: {
          path: "$distributor",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: { $ifNull: ["$distributor.name", "Ventas administradas"] },
          totalSales: 1,
          totalProfit: 1,
        },
      },
      { $sort: { totalProfit: -1 } },
      { $limit: 5 },
    ]);

    const monthlyTotals = monthlySales.reduce(
      (acc, sale) => {
        acc.totalRevenue += sale.salePrice * sale.quantity;
        acc.totalProfit += sale.totalProfit;
        acc.totalSales += 1;
        return acc;
      },
      { totalRevenue: 0, totalProfit: 0, totalSales: 0 },
    );

    // Agregar ventas especiales a los totales mensuales
    monthlySpecialSales.forEach((sale) => {
      monthlyTotals.totalRevenue += sale.specialPrice * sale.quantity;
      monthlyTotals.totalProfit += sale.totalProfit;
      monthlyTotals.totalSales += 1;
    });

    // Métricas de créditos/fiados
    const creditStats = await Credit.aggregate([
      { $match: businessFilter },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalCredits: { $sum: 1 },
                totalDebt: { $sum: "$remainingAmount" },
                totalPaid: { $sum: "$paidAmount" },
                totalOriginal: { $sum: "$originalAmount" },
              },
            },
          ],
          overdue: [
            {
              $match: {
                status: { $in: ["pending", "partial", "overdue"] },
                dueDate: { $lt: new Date() },
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                amount: { $sum: "$remainingAmount" },
              },
            },
          ],
          topDebtors: [
            {
              $match: {
                status: { $in: ["pending", "partial", "overdue"] },
              },
            },
            {
              $group: {
                _id: "$customer",
                totalDebt: { $sum: "$remainingAmount" },
                creditsCount: { $sum: 1 },
              },
            },
            { $sort: { totalDebt: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "customers",
                localField: "_id",
                foreignField: "_id",
                as: "customer",
              },
            },
            { $unwind: "$customer" },
            {
              $project: {
                customerId: "$_id",
                customerName: "$customer.name",
                totalDebt: 1,
                creditsCount: 1,
              },
            },
          ],
        },
      },
    ]);

    const creditMetrics = {
      totalCredits: creditStats[0]?.totals[0]?.totalCredits || 0,
      totalDebt: creditStats[0]?.totals[0]?.totalDebt || 0,
      totalPaid: creditStats[0]?.totals[0]?.totalPaid || 0,
      overdueCount: creditStats[0]?.overdue[0]?.count || 0,
      overdueAmount: creditStats[0]?.overdue[0]?.amount || 0,
      recoveryRate:
        creditStats[0]?.totals[0]?.totalOriginal > 0
          ? (
              (creditStats[0]?.totals[0]?.totalPaid /
                creditStats[0]?.totals[0]?.totalOriginal) *
              100
            ).toFixed(2)
          : 0,
      topDebtors: creditStats[0]?.topDebtors || [],
    };

    res.json({
      monthlyTotals,
      topProducts,
      topDistributors,
      creditMetrics,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener resumen combinado (ventas normales + especiales)
// @route   GET /api/analytics/combined-summary
// @access  Private/Admin
export const getCombinedSummary = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const { startDate, endDate } = req.query;

    // Filtros para ventas normales
    const salesFilter = { paymentStatus: "confirmado", ...businessFilter };
    if (startDate || endDate) {
      salesFilter.saleDate = {};
      if (startDate) {
        const date = new Date(startDate);
        salesFilter.saleDate.$gte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            5,
            0,
            0,
          ),
        );
      }
      if (endDate) {
        const date = new Date(endDate);
        salesFilter.saleDate.$lte = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1,
            4,
            59,
            59,
            999,
          ),
        );
      }
    }

    // Filtros para ventas especiales
    const specialSalesFilter = { status: "active", ...businessFilter };
    if (startDate || endDate) {
      specialSalesFilter.saleDate = {};
      if (startDate) specialSalesFilter.saleDate.$gte = new Date(startDate);
      if (endDate) specialSalesFilter.saleDate.$lte = new Date(endDate);
    }

    // Obtener ventas normales
    const normalSales = await Sale.find(salesFilter);
    const normalTotals = normalSales.reduce(
      (acc, sale) => {
        acc.revenue += sale.salePrice * sale.quantity;
        acc.cost += sale.purchasePrice * sale.quantity;
        acc.profit += sale.totalProfit;
        acc.count += 1;
        return acc;
      },
      { revenue: 0, cost: 0, profit: 0, count: 0 },
    );

    // Obtener ventas especiales
    const specialSales = await SpecialSale.find(specialSalesFilter);
    const specialTotals = specialSales.reduce(
      (acc, sale) => {
        acc.revenue += sale.specialPrice * sale.quantity;
        acc.cost += sale.cost * sale.quantity;
        acc.profit += sale.totalProfit;
        acc.count += 1;
        return acc;
      },
      { revenue: 0, cost: 0, profit: 0, count: 0 },
    );

    res.json({
      success: true,
      data: {
        normal: {
          revenue: normalTotals.revenue,
          cost: normalTotals.cost,
          profit: normalTotals.profit,
          count: normalTotals.count,
        },
        special: {
          revenue: specialTotals.revenue,
          cost: specialTotals.cost,
          profit: specialTotals.profit,
          count: specialTotals.count,
        },
        combined: {
          revenue: normalTotals.revenue + specialTotals.revenue,
          cost: normalTotals.cost + specialTotals.cost,
          profit: normalTotals.profit + specialTotals.profit,
          count: normalTotals.count + specialTotals.count,
        },
      },
    });
  } catch (error) {
    console.error("Error al obtener resumen combinado:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener el resumen combinado",
    });
  }
};

// @desc    Obtener métricas por método de pago
// @route   GET /api/analytics/payment-methods
// @access  Private/Admin
export const getPaymentMethodMetrics = async (req, res) => {
  try {
    const businessFilter = buildBusinessFilter(req);
    const { startDate, endDate, paymentMethodId, paymentMethodCode } =
      req.query;

    // Construir filtro base
    const filter = { paymentStatus: "confirmado", ...businessFilter };

    // Agregar filtro de fechas si se proporciona
    const dateRange = buildColombiaRange(startDate, endDate);
    if (dateRange) {
      filter.saleDate = dateRange;
    }

    // Filtrar por método de pago específico si se proporciona
    if (paymentMethodId) {
      filter.paymentMethod = new mongoose.Types.ObjectId(paymentMethodId);
    } else if (paymentMethodCode) {
      filter.paymentMethodCode = paymentMethodCode;
    }

    // Agregación por método de pago
    const byPaymentMethod = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            paymentMethod: "$paymentMethod",
            paymentMethodCode: "$paymentMethodCode",
            isCredit: "$isCredit",
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          totalQuantity: { $sum: "$quantity" },
        },
      },
      {
        $lookup: {
          from: "paymentmethods",
          localField: "_id.paymentMethod",
          foreignField: "_id",
          as: "methodInfo",
        },
      },
      {
        $project: {
          paymentMethodId: "$_id.paymentMethod",
          paymentMethodCode: {
            $ifNull: [
              "$_id.paymentMethodCode",
              { $cond: ["$_id.isCredit", "credit", "cash"] },
            ],
          },
          paymentMethodName: {
            $ifNull: [
              { $arrayElemAt: ["$methodInfo.name", 0] },
              { $cond: ["$_id.isCredit", "Crédito", "Efectivo"] },
            ],
          },
          isCredit: { $ifNull: ["$_id.isCredit", false] },
          totalSales: 1,
          totalRevenue: 1,
          totalProfit: 1,
          totalQuantity: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Calcular totales generales
    const totals = byPaymentMethod.reduce(
      (acc, item) => {
        acc.totalSales += item.totalSales;
        acc.totalRevenue += item.totalRevenue;
        acc.totalProfit += item.totalProfit;
        acc.totalQuantity += item.totalQuantity;
        if (item.isCredit) {
          acc.creditSales += item.totalSales;
          acc.creditRevenue += item.totalRevenue;
        } else {
          acc.cashSales += item.totalSales;
          acc.cashRevenue += item.totalRevenue;
        }
        return acc;
      },
      {
        totalSales: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalQuantity: 0,
        creditSales: 0,
        creditRevenue: 0,
        cashSales: 0,
        cashRevenue: 0,
      },
    );

    res.json({
      success: true,
      data: {
        byPaymentMethod,
        totals,
        filters: {
          startDate,
          endDate,
          paymentMethodId,
          paymentMethodCode,
        },
      },
    });
  } catch (error) {
    console.error("Error al obtener métricas por método de pago:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener métricas por método de pago",
    });
  }
};

// @desc    Obtener ganancia estimada total del sistema
// @route   GET /api/analytics/estimated-profit
// @access  Private/Admin
export const getEstimatedProfit = async (req, res) => {
  try {
    const businessId = ensureBusinessId(req, res);
    if (!businessId) return;

    const businessObjId = new mongoose.Types.ObjectId(businessId);

    // 1. Obtener productos con su warehouseStock (bodega)
    const products = await Product.find({ business: businessObjId }).lean();

    // 2. Obtener stock de sedes
    const branchStocks = await BranchStock.find({ business: businessObjId })
      .populate("product", "name purchasePrice clientPrice distributorPrice")
      .populate("branch", "name")
      .lean();

    // 3. Obtener stock de distribuidores
    const distributorStocks = await DistributorStock.find({
      business: businessObjId,
    })
      .populate("product", "name purchasePrice clientPrice distributorPrice")
      .populate("distributor", "name email")
      .lean();

    // 4. Verificar si hay sedes activas
    const branches = await Branch.find({
      business: businessObjId,
      active: true,
    }).lean();
    const hasBranches = branches.length > 0;

    // 5. Verificar si hay distribuidores activos
    const distributorMemberships = await Membership.find({
      business: businessObjId,
      role: "distribuidor",
    }).lean();
    const hasDistributors = distributorMemberships.length > 0;

    // Calcular ganancia estimada de bodega
    // ADMIN gana: clientPrice - purchasePrice
    let warehouseEstimate = {
      grossProfit: 0,
      adminProfit: 0, // Ganancia del admin
      netProfit: 0,
      totalProducts: 0,
      totalUnits: 0,
      investment: 0,
      salesValue: 0,
    };

    for (const product of products) {
      const qty = product.warehouseStock || 0;
      if (qty > 0) {
        const purchasePrice = product.purchasePrice || 0;
        const clientPrice =
          product.clientPrice ||
          product.distributorPrice ||
          purchasePrice * 1.3;
        const investment = purchasePrice * qty;
        const salesValue = clientPrice * qty;
        const grossProfit = salesValue - investment;

        warehouseEstimate.totalProducts += 1;
        warehouseEstimate.totalUnits += qty;
        warehouseEstimate.investment += investment;
        warehouseEstimate.salesValue += salesValue;
        warehouseEstimate.grossProfit += grossProfit;
        warehouseEstimate.adminProfit += grossProfit; // Admin gana todo en ventas de bodega
      }
    }
    warehouseEstimate.netProfit = warehouseEstimate.grossProfit; // Sin gastos deducidos aquí

    // Calcular ganancia estimada de sedes
    // ADMIN gana: clientPrice - purchasePrice (las sedes trabajan con precio de compra del admin)
    let branchesEstimate = {
      grossProfit: 0,
      adminProfit: 0, // Ganancia del admin
      netProfit: 0,
      totalProducts: 0,
      totalUnits: 0,
      investment: 0,
      salesValue: 0,
      branches: [],
    };

    const branchStockByBranch = {};
    for (const stock of branchStocks) {
      if (!stock.product || stock.quantity <= 0) continue;
      const branchId = stock.branch?._id?.toString() || "unknown";
      const branchName = stock.branch?.name || "Sin nombre";

      if (!branchStockByBranch[branchId]) {
        branchStockByBranch[branchId] = {
          name: branchName,
          grossProfit: 0,
          adminProfit: 0,
          investment: 0,
          salesValue: 0,
          totalProducts: 0,
          totalUnits: 0,
        };
      }

      const purchasePrice = stock.product.purchasePrice || 0;
      const clientPrice =
        stock.product.clientPrice ||
        stock.product.distributorPrice ||
        purchasePrice * 1.3;
      const investment = purchasePrice * stock.quantity;
      const salesValue = clientPrice * stock.quantity;
      const profit = salesValue - investment;

      branchStockByBranch[branchId].investment += investment;
      branchStockByBranch[branchId].salesValue += salesValue;
      branchStockByBranch[branchId].grossProfit += profit;
      branchStockByBranch[branchId].adminProfit += profit; // Admin gana todo en ventas de sedes
      branchStockByBranch[branchId].totalProducts += 1;
      branchStockByBranch[branchId].totalUnits += stock.quantity;
    }

    for (const [branchId, data] of Object.entries(branchStockByBranch)) {
      branchesEstimate.grossProfit += data.grossProfit;
      branchesEstimate.adminProfit += data.adminProfit;
      branchesEstimate.investment += data.investment;
      branchesEstimate.salesValue += data.salesValue;
      branchesEstimate.totalProducts += data.totalProducts;
      branchesEstimate.totalUnits += data.totalUnits;
      branchesEstimate.branches.push({ id: branchId, ...data });
    }
    branchesEstimate.netProfit = branchesEstimate.grossProfit;

    // Calcular ganancia estimada de distribuidores
    // ADMIN gana: distributorPrice - purchasePrice (solo el markup/margen, NO la comisión del distribuidor)
    let distributorsEstimate = {
      grossProfit: 0, // Ganancia total del distribuidor (clientPrice - distributorPrice)
      adminProfit: 0, // Ganancia del ADMIN (distributorPrice - purchasePrice)
      netProfit: 0,
      totalProducts: 0,
      totalUnits: 0,
      investment: 0,
      salesValue: 0,
      distributors: [],
    };

    const distStockByDist = {};
    for (const stock of distributorStocks) {
      if (!stock.product || stock.quantity <= 0) continue;
      const distId = stock.distributor?._id?.toString() || "unknown";
      const distName = stock.distributor?.name || "Sin nombre";
      const distEmail = stock.distributor?.email || "";

      if (!distStockByDist[distId]) {
        distStockByDist[distId] = {
          name: distName,
          email: distEmail,
          grossProfit: 0,
          adminProfit: 0,
          investment: 0,
          salesValue: 0,
          totalProducts: 0,
          totalUnits: 0,
        };
      }

      const purchasePrice = stock.product.purchasePrice || 0;
      const distributorPrice =
        stock.product.distributorPrice || purchasePrice * 1.2;
      const clientPrice = stock.product.clientPrice || distributorPrice * 1.1;

      // Para distribuidores:
      // - Inversión del admin: purchasePrice
      // - Venta del admin al distribuidor: distributorPrice
      // - Ganancia del admin: distributorPrice - purchasePrice
      // - Ganancia del distribuidor: clientPrice - distributorPrice (esto NO es del admin)
      const adminInvestment = purchasePrice * stock.quantity;
      const adminSalesValue = distributorPrice * stock.quantity;
      const adminProfit = adminSalesValue - adminInvestment;

      // Ganancia bruta del distribuidor (para referencia)
      const distributorInvestment = distributorPrice * stock.quantity;
      const distributorSalesValue = clientPrice * stock.quantity;
      const distributorGrossProfit =
        distributorSalesValue - distributorInvestment;

      distStockByDist[distId].investment += adminInvestment;
      distStockByDist[distId].salesValue += adminSalesValue;
      distStockByDist[distId].adminProfit += adminProfit; // Admin gana solo el markup
      distStockByDist[distId].grossProfit += distributorGrossProfit; // Ganancia del distribuidor (referencia)
      distStockByDist[distId].totalProducts += 1;
      distStockByDist[distId].totalUnits += stock.quantity;
    }

    for (const [distId, data] of Object.entries(distStockByDist)) {
      distributorsEstimate.grossProfit += data.grossProfit;
      distributorsEstimate.adminProfit += data.adminProfit;
      distributorsEstimate.investment += data.investment;
      distributorsEstimate.salesValue += data.salesValue;
      distributorsEstimate.totalProducts += data.totalProducts;
      distributorsEstimate.totalUnits += data.totalUnits;
      distributorsEstimate.distributors.push({ id: distId, ...data });
    }
    distributorsEstimate.netProfit = distributorsEstimate.grossProfit;

    // Calcular totales consolidados
    const adminProfitTotal =
      warehouseEstimate.adminProfit +
      branchesEstimate.adminProfit +
      distributorsEstimate.adminProfit;

    const consolidated = {
      grossProfit:
        warehouseEstimate.grossProfit +
        branchesEstimate.grossProfit +
        distributorsEstimate.grossProfit,
      adminProfit: adminProfitTotal, // GANANCIA REAL DEL ADMIN
      netProfit:
        warehouseEstimate.netProfit +
        branchesEstimate.netProfit +
        distributorsEstimate.netProfit,
      totalProducts:
        warehouseEstimate.totalProducts +
        branchesEstimate.totalProducts +
        distributorsEstimate.totalProducts,
      totalUnits:
        warehouseEstimate.totalUnits +
        branchesEstimate.totalUnits +
        distributorsEstimate.totalUnits,
      investment:
        warehouseEstimate.investment +
        branchesEstimate.investment +
        distributorsEstimate.investment,
      salesValue:
        warehouseEstimate.salesValue +
        branchesEstimate.salesValue +
        distributorsEstimate.salesValue,
    };

    // Determinar el escenario
    let scenario = "D"; // Default: tiene sedes y distribuidores
    let message =
      "Tu ganancia si se vende todo el inventario de bodega, sedes y distribuidores.";

    if (!hasBranches && !hasDistributors) {
      scenario = "A";
      message =
        "Tu ganancia si se vende todo el inventario de la bodega principal.";
    } else if (!hasBranches && hasDistributors) {
      scenario = "B";
      message =
        "Tu ganancia si se vende todo el inventario de bodega y distribuidores.";
    } else if (hasBranches && !hasDistributors) {
      scenario = "C";
      message = "Tu ganancia si se vende todo el inventario de bodega y sedes.";
    }

    res.json({
      success: true,
      scenario,
      message,
      hasBranches,
      hasDistributors,
      warehouse: warehouseEstimate,
      branches: branchesEstimate,
      distributors: distributorsEstimate,
      consolidated,
    });
  } catch (error) {
    console.error("Error al calcular ganancia estimada:", error);
    res.status(500).json({
      success: false,
      message: "Error al calcular ganancia estimada",
    });
  }
};

// @desc    Obtener ganancia estimada para un distribuidor específico
// @route   GET /api/analytics/estimated-profit/distributor/:distributorId
// @access  Private
export const getDistributorEstimatedProfit = async (req, res) => {
  try {
    const businessId = ensureBusinessId(req, res);
    if (!businessId) return;

    const { distributorId } = req.params;
    const businessObjId = new mongoose.Types.ObjectId(businessId);

    // Si distributorId es "me", usar el usuario actual
    const targetDistributorId =
      distributorId === "me" ? req.user.id : distributorId;

    const distObjId = new mongoose.Types.ObjectId(targetDistributorId);

    // Obtener stock del distribuidor
    const distributorStocks = await DistributorStock.find({
      business: businessObjId,
      distributor: distObjId,
      quantity: { $gt: 0 },
    })
      .populate(
        "product",
        "name purchasePrice clientPrice distributorPrice image",
      )
      .lean();

    let estimate = {
      grossProfit: 0,
      netProfit: 0,
      totalProducts: 0,
      totalUnits: 0,
      investment: 0,
      salesValue: 0,
      products: [],
    };

    for (const stock of distributorStocks) {
      if (!stock.product) continue;

      const purchasePrice = stock.product.purchasePrice || 0;
      const distributorPrice =
        stock.product.distributorPrice || purchasePrice * 1.2;
      const clientPrice = stock.product.clientPrice || distributorPrice * 1.1;

      const investment = distributorPrice * stock.quantity;
      const salesValue = clientPrice * stock.quantity;
      const profit = salesValue - investment;

      estimate.investment += investment;
      estimate.salesValue += salesValue;
      estimate.grossProfit += profit;
      estimate.totalProducts += 1;
      estimate.totalUnits += stock.quantity;

      estimate.products.push({
        productId: stock.product._id,
        name: stock.product.name,
        image: stock.product.image,
        quantity: stock.quantity,
        distributorPrice,
        clientPrice,
        investment,
        salesValue,
        estimatedProfit: profit,
        profitPercentage:
          investment > 0 ? ((profit / investment) * 100).toFixed(2) : 0,
      });
    }

    estimate.netProfit = estimate.grossProfit;
    estimate.profitMargin =
      estimate.investment > 0
        ? ((estimate.grossProfit / estimate.investment) * 100).toFixed(2)
        : 0;

    res.json({
      success: true,
      distributorId: targetDistributorId,
      estimate,
    });
  } catch (error) {
    console.error(
      "Error al calcular ganancia estimada del distribuidor:",
      error,
    );
    res.status(500).json({
      success: false,
      message: "Error al calcular ganancia estimada",
    });
  }
};
