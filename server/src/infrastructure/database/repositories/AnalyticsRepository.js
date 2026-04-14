// WAIT! We moved Sale.js? No, user only asked to move Product and User so far.
// Checking file system... actually USER asked to move Sale in Phase 2 but we only did Product/User in later phases?
// Re-reading Phase 2. "Infrastructure (Persistencia): Mueve (o importa) el modelo Sale actual."
// We should check where Sale.js is. Assuming it was moved or is available.
// Let's use the new path if we moved it, or fallback.
// Based on Phase 12/13, we moved Product and User. In Phase 2/3 we created SaleRepository but did we move Sale.js?
// I'll check first, but for now assuming we import from best location.
// Actually, earlier I saw Sale.js in src/infrastructure/database/models/Sale.js in previous turn?
// No, I moved Product and User. I should double check Sale location.
// SAFE BET: Import from relative path if unsure, or standard infra path.
// Let's assume standard path: ../models/Sale.js if not moved, or ../src/... if moved.
// I will assume it IS moved because we are in src/infrastructure and we likely want to be consistent.
// But if it wasn't moved, the require might fail.
// I will check file existence in next step if needed, but for now I will write assuming it is in ../models/Sale.js relative to WHERE this file is?
// This file is in src/infrastructure/database/repositories/AnalyticsRepository.js
// So ../models/Sale.js would be src/infrastructure/database/models/Sale.js
// If legacy Sale is at server/models/Sale.js, then path is ../../../../models/Sale.js?
// Let's stick to using the same pattern as ProductRepository which used ../models/Product.js (which I moved).
// I will check if Sale.js was moved.

import mongoose from "mongoose";
import BranchStock from "../models/BranchStock.js";
import EmployeeStock from "../models/EmployeeStock.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import SaleModel from "../models/Sale.js";

export class AnalyticsRepository {
  /**
   * Get Dashboard KPIs
   * @param {string} businessId
   * @param {Date} startDate
   * @param {Date} endDate
   */
  async getDashboardKPIs(businessId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          saleDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          // 💰 CASH FLOW: Revenue/Profit solo de ventas confirmadas (pagadas)
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                {
                  $multiply: [
                    { $ifNull: ["$salePrice", 0] },
                    { $ifNull: ["$quantity", 0] },
                  ],
                },
                0,
              ],
            },
          },
          totalProfit: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                {
                  $ifNull: [
                    "$totalProfit",
                    {
                      $ifNull: [
                        "$netProfit",
                        { $add: ["$adminProfit", "$employeeProfit"] },
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
          // 📊 COUNT: Todas las ventas (pendientes + confirmadas)
          totalSales: { $sum: 1 },
          productsSold: { $sum: "$quantity" },
        },
      },
    ];

    const result = await SaleModel.aggregate(pipeline);
    return (
      result[0] || {
        totalRevenue: 0,
        totalProfit: 0,
        totalSales: 0,
        productsSold: 0,
      }
    );
  }

  /**
   * Get Sales Timeline (Daily)
   */
  async getSalesTimeline(businessId, startDate, endDate) {
    const pipeline = [
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          saleDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
          // 💰 CASH FLOW: Solo ventas confirmadas en revenue/profit
          revenue: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                {
                  $multiply: [
                    { $ifNull: ["$salePrice", 0] },
                    { $ifNull: ["$quantity", 0] },
                  ],
                },
                0,
              ],
            },
          },
          profit: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "confirmado"] },
                {
                  $ifNull: [
                    "$totalProfit",
                    {
                      $ifNull: [
                        "$netProfit",
                        { $add: ["$adminProfit", "$employeeProfit"] },
                      ],
                    },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    return SaleModel.aggregate(pipeline);
  }

  /**
   * Get Top Products by Revenue
   */
  async getTopProducts(businessId, startDate, endDate, limit = 10) {
    const pipeline = [
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          saleDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productData",
        },
      },
      {
        $unwind: { path: "$productData", preserveNullAndEmptyArrays: true },
      },
      {
        $group: {
          _id: "$product",
          name: {
            $first: { $ifNull: ["$productData.name", "Producto Eliminado"] },
          },
          quantity: { $sum: "$quantity" },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$salePrice", 0] },
                { $ifNull: ["$quantity", 0] },
              ],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          name: 1,
          quantity: 1,
          revenue: 1,
        },
      },
    ];

    return SaleModel.aggregate(pipeline);
  }

  /**
   * Get Estimated Profit (Admin Dashboard)
   * Calculates estimated profit based on INVENTORY (warehouse + employees)
   * Returns the profit that would be made if all inventory was sold at clientPrice
   */
  async getEstimatedProfit(businessId) {
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    // Get warehouse products (products with warehouseStock > 0)
    const warehouseProducts = await Product.find({
      business: businessObjectId,
      warehouseStock: { $gt: 0 },
      isDeleted: { $ne: true },
    })
      .select(
        "name warehouseStock purchasePrice averageCost employeePrice clientPrice",
      )
      .lean();

    // Get employee stocks with user info
    const employeeStocks = await EmployeeStock.find({
      business: businessObjectId,
      quantity: { $gt: 0 },
    })
      .populate(
        "product",
        "name purchasePrice averageCost clientPrice employeePrice",
      )
      .populate("employee", "name email")
      .lean();

    const branchStocks = await BranchStock.find({
      business: businessObjectId,
      quantity: { $gt: 0 },
    })
      .populate(
        "product",
        "name purchasePrice averageCost clientPrice employeePrice",
      )
      .populate("branch", "name")
      .lean();

    // Check if business has employees
    const employeeMemberships = await Membership.find({
      business: businessObjectId,
      role: "employee",
      status: "active",
    })
      .select("user")
      .lean();
    const hasEmployees = employeeMemberships.length > 0;

    const hasBranches = branchStocks.length > 0;

    // Calculate warehouse metrics
    let warehouseGrossProfit = 0;
    let warehouseInvestment = 0;
    let warehouseSalesValue = 0;
    let warehouseTotalUnits = 0;

    for (const product of warehouseProducts) {
      const qty = product.warehouseStock || 0;
      const costPrice = product.averageCost || product.purchasePrice || 0;
      const sellPrice = product.clientPrice || product.employeePrice || 0;

      warehouseInvestment += costPrice * qty;
      warehouseSalesValue += sellPrice * qty;
      warehouseTotalUnits += qty;
    }
    warehouseGrossProfit = warehouseSalesValue - warehouseInvestment;

    // Calculate employee metrics (aggregated and per-employee)
    let employeesGrossProfit = 0;
    let employeesInvestment = 0;
    let employeesSalesValue = 0;
    let employeesTotalUnits = 0;
    const employeeMap = new Map();

    for (const stock of employeeStocks) {
      if (!stock.product || !stock.employee) continue;

      const qty = stock.quantity || 0;
      const product = stock.product;
      const employee = stock.employee;

      // Admin's perspective for employee inventory: profit is B2B margin
      // Sales value is at employeePrice (already excludes employee commission)
      const costPrice = product.averageCost || product.purchasePrice || 0;
      let sellPrice = product.employeePrice || 0;
      if (sellPrice <= 0) {
        // Fallback to avoid zero B2B price when stock exists
        sellPrice = product.clientPrice || 0;
        if (sellPrice <= 0) {
          console.warn(
            "[EstimatedProfit] Missing B2B price for employee stock",
            {
              productId: product._id,
              employeeId: employee._id,
            },
          );
        }
      }

      const investment = costPrice * qty;
      const salesValue = sellPrice * qty;
      const profit = salesValue - investment;

      employeesInvestment += investment;
      employeesSalesValue += salesValue;
      employeesTotalUnits += qty;

      // Per-employee breakdown
      const distId = employee._id.toString();
      if (!employeeMap.has(distId)) {
        employeeMap.set(distId, {
          id: distId,
          name: employee.name || "Employee",
          email: employee.email || "",
          grossProfit: 0,
          adminProfit: 0,
          investment: 0,
          salesValue: 0,
          totalProducts: 0,
          totalUnits: 0,
        });
      }
      const d = employeeMap.get(distId);
      d.grossProfit += profit;
      d.adminProfit += profit; // For admin, the profit is the margin
      d.investment += investment;
      d.salesValue += salesValue;
      d.totalUnits += qty;
      d.totalProducts += 1;
    }
    employeesGrossProfit = employeesSalesValue - employeesInvestment;

    // Calculate branches metrics (aggregated and per-branch)
    let branchesGrossProfit = 0;
    let branchesInvestment = 0;
    let branchesSalesValue = 0;
    let branchesTotalUnits = 0;
    const branchMap = new Map();

    for (const stock of branchStocks) {
      if (!stock.product || !stock.branch) continue;

      const qty = stock.quantity || 0;
      const product = stock.product;
      const branch = stock.branch;

      const costPrice = product.averageCost || product.purchasePrice || 0;
      const sellPrice = product.clientPrice || product.employeePrice || 0;

      const investment = costPrice * qty;
      const salesValue = sellPrice * qty;
      const profit = salesValue - investment;

      branchesInvestment += investment;
      branchesSalesValue += salesValue;
      branchesTotalUnits += qty;

      const branchId = branch._id.toString();
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          id: branchId,
          name: branch.name || "Sede",
          grossProfit: 0,
          adminProfit: 0,
          investment: 0,
          salesValue: 0,
          totalProducts: 0,
          totalUnits: 0,
        });
      }

      const b = branchMap.get(branchId);
      b.grossProfit += profit;
      b.adminProfit += profit;
      b.investment += investment;
      b.salesValue += salesValue;
      b.totalUnits += qty;
      b.totalProducts += 1;
    }
    branchesGrossProfit = branchesSalesValue - branchesInvestment;

    // Consolidated totals
    const totalGrossProfit =
      warehouseGrossProfit + branchesGrossProfit + employeesGrossProfit;
    const totalInvestment =
      warehouseInvestment + branchesInvestment + employeesInvestment;
    const totalSalesValue =
      warehouseSalesValue + branchesSalesValue + employeesSalesValue;
    const totalUnits =
      warehouseTotalUnits + branchesTotalUnits + employeesTotalUnits;
    const totalProducts =
      warehouseProducts.length +
      new Set(branchStocks.map((s) => s.product?._id?.toString())).size +
      new Set(employeeStocks.map((s) => s.product?._id?.toString())).size;

    // Determine scenario
    let scenario = "A"; // Default: only warehouse
    if (hasEmployees && !hasBranches) scenario = "B";
    else if (!hasEmployees && hasBranches) scenario = "C";
    else if (hasEmployees && hasBranches) scenario = "D";

    const scenarioMessages = {
      A: "Ganancia estimada basada en inventario de almacén",
      B: "Ganancia estimada: almacén + inventario de employees",
      C: "Ganancia estimada: almacén + sucursales",
      D: "Ganancia estimada: almacén + sucursales + employees",
    };

    return {
      success: true,
      scenario,
      message: scenarioMessages[scenario],
      hasBranches,
      hasEmployees,
      warehouse: {
        grossProfit: warehouseGrossProfit,
        adminProfit: warehouseGrossProfit, // Admin keeps full margin
        netProfit: warehouseGrossProfit,
        totalProducts: warehouseProducts.length,
        totalUnits: warehouseTotalUnits,
        investment: warehouseInvestment,
        salesValue: warehouseSalesValue,
      },
      branches: {
        grossProfit: branchesGrossProfit,
        adminProfit: branchesGrossProfit,
        netProfit: branchesGrossProfit,
        totalProducts: branchMap.size,
        totalUnits: branchesTotalUnits,
        investment: branchesInvestment,
        salesValue: branchesSalesValue,
        branches: Array.from(branchMap.values()),
      },
      employees: {
        grossProfit: employeesGrossProfit,
        adminProfit: employeesGrossProfit,
        netProfit: employeesGrossProfit,
        totalProducts: employeeMap.size,
        totalUnits: employeesTotalUnits,
        investment: employeesInvestment,
        salesValue: employeesSalesValue,
        employees: Array.from(employeeMap.values()),
      },
      consolidated: {
        grossProfit: totalGrossProfit,
        adminProfit: totalGrossProfit,
        netProfit: totalGrossProfit,
        totalProducts,
        totalUnits,
        investment: totalInvestment,
        salesValue: totalSalesValue,
        profitability:
          totalInvestment > 0
            ? Math.round((totalGrossProfit / totalInvestment) * 100)
            : 0,
        costMultiplier:
          totalInvestment > 0
            ? Math.round((totalSalesValue / totalInvestment) * 100)
            : 0,
      },
    };
  }

  /**
   * Get Employee Estimated Profit
   * Calcula la ganancia estimada del employee basándose en su INVENTARIO ACTUAL
   * (cuánto ganaría si vendiera todo su stock disponible)
   */
  async getEmployeeEstimatedProfit(businessId, employeeId) {
    // Get employee's current stock with product details
    const stock = await EmployeeStock.find({
      business: new mongoose.Types.ObjectId(businessId),
      employee: new mongoose.Types.ObjectId(employeeId),
      quantity: { $gt: 0 }, // Only products with stock > 0
    })
      .populate("product", "name image employeePrice clientPrice")
      .lean();

    if (!stock || stock.length === 0) {
      return {
        // Format expected by frontend (EmployeeEstimate interface)
        grossProfit: 0,
        netProfit: 0,
        totalProducts: 0,
        totalUnits: 0,
        investment: 0,
        salesValue: 0,
        profitMargin: "0",
        profitability: 0,
        products: [],
      };
    }

    let totalInvestment = 0;
    let totalSalesValue = 0;
    let totalUnits = 0;
    const products = [];

    for (const item of stock) {
      if (!item.product) continue;

      const product = item.product;
      const quantity = item.quantity;
      const employeePrice = product.employeePrice || 0;
      const clientPrice = product.clientPrice || 0;

      const investment = employeePrice * quantity;
      const salesValue = clientPrice * quantity;
      const estimatedProfit = salesValue - investment;
      const profitPercentage =
        investment > 0
          ? ((estimatedProfit / investment) * 100).toFixed(1)
          : "0";

      totalInvestment += investment;
      totalSalesValue += salesValue;
      totalUnits += quantity;

      products.push({
        productId: product._id.toString(),
        name: product.name,
        image: product.image,
        quantity,
        employeePrice,
        clientPrice,
        investment,
        salesValue,
        estimatedProfit,
        profitPercentage,
      });
    }

    const grossProfit = totalSalesValue - totalInvestment;
    const profitMargin =
      totalSalesValue > 0
        ? ((grossProfit / totalSalesValue) * 100).toFixed(1)
        : "0";
    const profitability =
      totalInvestment > 0 ? (grossProfit / totalInvestment) * 100 : 0;

    return {
      grossProfit,
      netProfit: grossProfit, // For now, net = gross (no deductions)
      totalProducts: products.length,
      totalUnits,
      investment: totalInvestment,
      salesValue: totalSalesValue,
      profitMargin,
      profitability,
      products,
    };
  }
}
