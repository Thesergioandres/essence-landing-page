import mongoose from "mongoose";
import BranchStock from "../models/BranchStock.js";
import DefectiveProduct from "../models/DefectiveProduct.js";
import EmployeeStock from "../models/EmployeeStock.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import ProfitHistory from "../models/ProfitHistory.js";
import Sale from "../models/Sale.js";
import expenseRepository from "./ExpenseRepository.js";
import ProfitHistoryRepository from "./ProfitHistoryRepository.js";

export class DefectiveProductRepository {
  constructor() {
    this.expenseRepository = expenseRepository;
  }

  normalizeOperationId(operationId) {
    if (operationId === undefined || operationId === null) return null;
    const normalized = String(operationId).trim();
    return normalized || null;
  }

  isTransactionUnsupportedError(error) {
    const message = String(error?.message || "");
    return (
      message.includes(
        "Transaction numbers are only allowed on a replica set member or mongos",
      ) ||
      message.includes("does not support transactions") ||
      message.includes("NotYetInitialized")
    );
  }

  async runInOptionalTransaction(work) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await work(session);
      });
    } catch (error) {
      if (!this.isTransactionUnsupportedError(error)) {
        throw error;
      }

      await work(null);
    } finally {
      await session.endSession();
    }
  }

  buildWarrantyLedger({
    saleItem,
    replacementProduct,
    quantity,
    replacementPrice,
    cashRefundInput,
  }) {
    const originalUnitPrice = Number(saleItem.salePrice || 0);
    const originalUnitCost =
      saleItem.averageCostAtSale ||
      saleItem.purchasePrice ||
      saleItem.product?.averageCost ||
      saleItem.product?.purchasePrice ||
      0;
    const originalMargin = (originalUnitPrice - originalUnitCost) * quantity;

    const replacementUnitCost =
      replacementProduct.averageCost || replacementProduct.purchasePrice || 0;
    const replacementMargin =
      (replacementPrice - replacementUnitCost) * quantity;
    const marginDelta = replacementMargin - originalMargin;

    const originalTotal = originalUnitPrice * quantity;
    const replacementTotal = replacementPrice * quantity;
    const priceDifference = Math.max(0, replacementTotal - originalTotal);
    let cashRefund = Math.max(0, originalTotal - replacementTotal);

    if (cashRefundInput !== undefined) {
      const parsedRefund = Number(cashRefundInput);
      if (!Number.isFinite(parsedRefund) || parsedRefund < 0) {
        const err = new Error("Devolucion de efectivo invalida");
        err.statusCode = 400;
        throw err;
      }
      if (parsedRefund > originalTotal) {
        const err = new Error("La devolucion excede el total original");
        err.statusCode = 400;
        throw err;
      }
      cashRefund = parsedRefund;
    }

    const warrantyLossAmount = Math.max(0, originalMargin - replacementMargin);

    return {
      originalMargin,
      replacementMargin,
      marginDelta,
      priceDifference,
      cashRefund,
      replacementTotal,
      warrantyLossAmount,
    };
  }

  async getWarrantedQuantityForSaleItem(
    businessId,
    saleItemId,
    session = null,
  ) {
    const aggregateQuery = DefectiveProduct.aggregate([
      {
        $match: {
          business: new mongoose.Types.ObjectId(businessId),
          origin: "customer_warranty",
          originalSaleItem: new mongoose.Types.ObjectId(saleItemId),
        },
      },
      {
        $group: {
          _id: null,
          quantity: { $sum: "$quantity" },
        },
      },
    ]);

    if (session) {
      aggregateQuery.session(session);
    }

    const aggregation = await aggregateQuery;

    return Number(aggregation?.[0]?.quantity || 0);
  }

  getContextRole(actor) {
    return (
      actor?.membership?.role ||
      actor?.businessContext?.membership?.role ||
      null
    );
  }

  async reportFromAdmin(data, businessId, userId) {
    const product = await Product.findOne({
      _id: data.productId,
      business: businessId,
    });

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (product.warehouseStock < data.quantity) {
      const err = new Error(
        `Stock insuficiente en bodega. Disponible: ${product.warehouseStock}`,
      );
      err.statusCode = 400;
      throw err;
    }

    const lossAmount = data.hasWarranty
      ? 0
      : (product.purchasePrice || 0) * data.quantity;

    const defectiveReport = await DefectiveProduct.create({
      employee: null,
      product: data.productId,
      business: businessId,
      quantity: data.quantity,
      reason: data.reason,
      images: data.images || [],
      hasWarranty: data.hasWarranty,
      warrantyStatus: data.hasWarranty ? "pending" : "not_applicable",
      lossAmount,
      saleGroupId: data.saleGroupId,
      origin: data.origin || "direct",
      stockOrigin: "warehouse",
      status: "confirmado",
      confirmedAt: Date.now(),
      confirmedBy: userId,
      adminNotes: data.hasWarranty
        ? "Reporte con garantía - pendiente reposición de stock"
        : "Reporte sin garantía - pérdida registrada",
    });

    product.warehouseStock -= data.quantity;
    product.totalStock = Math.max(0, (product.totalStock || 0) - data.quantity);
    await product.save();

    return defectiveReport;
  }

  async reportFromEmployee(data, businessId, employeeId) {
    const product = await Product.findOne({
      _id: data.productId,
      business: businessId,
    });

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const employeeStock = await EmployeeStock.findOne({
      employee: employeeId,
      product: data.productId,
      business: businessId,
    });

    if (!employeeStock || employeeStock.quantity < data.quantity) {
      const err = new Error("Stock insuficiente del empleado");
      err.statusCode = 400;
      throw err;
    }

    const defectiveReport = await DefectiveProduct.create({
      employee: employeeId,
      product: data.productId,
      business: businessId,
      quantity: data.quantity,
      reason: data.reason,
      images: data.images || [],
      hasWarranty: data.hasWarranty,
      warrantyStatus: data.hasWarranty ? "pending" : "not_applicable",
      lossAmount: 0,
      stockOrigin: "employee",
      status: "pendiente",
    });

    return defectiveReport;
  }

  async reportFromBranch(data, businessId, userId, options = {}) {
    const branchId = data.branchId;
    if (!branchId) {
      const err = new Error("Falta branchId");
      err.statusCode = 400;
      throw err;
    }

    const product = await Product.findOne({
      _id: data.productId,
      business: businessId,
    });

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const branchStock = await BranchStock.findOne({
      branch: branchId,
      product: data.productId,
      business: businessId,
    });

    if (!branchStock || branchStock.quantity < data.quantity) {
      const err = new Error(
        `Stock insuficiente en la sede. Disponible: ${branchStock?.quantity || 0}`,
      );
      err.statusCode = 400;
      throw err;
    }

    const isEmployee = Boolean(options?.isEmployee);
    const hasWarranty = Boolean(data.hasWarranty);
    const unitCost = product.averageCost || product.purchasePrice || 0;
    const lossAmount = hasWarranty ? 0 : unitCost * data.quantity;

    const defectiveReport = await DefectiveProduct.create({
      employee: isEmployee ? userId : data.employeeId || null,
      product: data.productId,
      business: businessId,
      branch: branchId,
      quantity: data.quantity,
      reason: data.reason,
      images: data.images || [],
      hasWarranty,
      warrantyStatus: hasWarranty ? "pending" : "not_applicable",
      lossAmount: isEmployee ? 0 : lossAmount,
      stockOrigin: "branch",
      status: isEmployee ? "pendiente" : "confirmado",
      confirmedAt: isEmployee ? null : Date.now(),
      confirmedBy: isEmployee ? null : userId,
      adminNotes: isEmployee
        ? undefined
        : hasWarranty
          ? "Reporte con garantía - pendiente reposición de stock"
          : "Reporte sin garantía - pérdida registrada",
    });

    if (!isEmployee) {
      branchStock.quantity -= data.quantity;
      await branchStock.save();

      await Product.findByIdAndUpdate(product._id, {
        $inc: { totalStock: -data.quantity },
      });
    }

    return defectiveReport;
  }

  async generateWarrantyTicket(businessId, options = {}) {
    const { session } = options;
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const suffix = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0");
      const ticketId = `REF-GAR-${suffix}`;

      const ticketQuery = DefectiveProduct.findOne({
        business: businessId,
        ticketId,
      })
        .select("_id")
        .lean();

      const exists = session
        ? await ticketQuery.session(session)
        : await ticketQuery;

      if (!exists) return ticketId;
    }

    return `REF-GAR-${Date.now()}`;
  }

  async getSaleLookup(businessId, saleLookup, user) {
    const lookup = String(saleLookup || "").trim();
    if (!lookup) {
      const err = new Error("Falta el ID de la venta");
      err.statusCode = 400;
      throw err;
    }

    const orFilters = [{ saleId: lookup }, { saleGroupId: lookup }];
    if (mongoose.Types.ObjectId.isValid(lookup)) {
      orFilters.push({ _id: lookup });
    }

    const sale = await Sale.findOne({
      business: businessId,
      $or: orFilters,
    })
      .populate("product", "name image clientPrice employeePrice")
      .populate("branch", "name")
      .populate("employee", "name email")
      .populate("createdBy", "name email")
      .lean();

    if (!sale) {
      const err = new Error("Venta no encontrada");
      err.statusCode = 404;
      throw err;
    }

    const contextRole = this.getContextRole(user);

    if (contextRole === "employee") {
      const employeeId = user._id?.toString?.() || user.id?.toString?.();
      const saleEmployeeId =
        sale?.employee && typeof sale.employee === "object"
          ? sale.employee?._id?.toString?.() || null
          : sale?.employee?.toString?.() || null;
      const saleCreatorId =
        sale?.createdBy && typeof sale.createdBy === "object"
          ? sale.createdBy?._id?.toString?.() || null
          : sale?.createdBy?.toString?.() || null;

      const hasAccess =
        Boolean(employeeId) &&
        (saleEmployeeId === employeeId ||
          (!saleEmployeeId && saleCreatorId === employeeId));

      if (!hasAccess) {
        const err = new Error("No tienes acceso a esta venta");
        err.statusCode = 403;
        throw err;
      }
    }

    const saleGroupId = sale.saleGroupId || sale._id.toString();
    const sales = sale.saleGroupId
      ? await Sale.find({ business: businessId, saleGroupId })
          .populate("product", "name image clientPrice employeePrice")
          .populate("branch", "name")
          .populate("employee", "name email")
          .populate("createdBy", "name email")
          .lean()
      : [sale];

    const seller = sale.employee
      ? { role: "employee", user: sale.employee }
      : { role: "admin", user: sale.createdBy };

    const items = sales.map((item) => ({
      saleItemId: item._id,
      saleGroupId: item.saleGroupId,
      saleId: item.saleId,
      saleDate: item.saleDate,
      product: item.product,
      quantity: item.quantity,
      salePrice: item.salePrice,
      employee: item.employee,
      branch: item.branch,
      sourceLocation: item.sourceLocation,
      createdBy: item.createdBy,
    }));

    return {
      saleGroupId,
      saleId: sale.saleId,
      saleDate: sale.saleDate,
      seller,
      items,
    };
  }

  async createCustomerWarranty(data, businessId, user, options = {}) {
    const contextRole = this.getContextRole(user);
    const operationId = this.normalizeOperationId(
      data?.operationId || options?.operationId,
    );

    const userId = user?._id || user?.id;
    if (!userId) {
      const err = new Error("Usuario no autenticado");
      err.statusCode = 401;
      throw err;
    }

    const quantity = Number(data.quantity || 0);
    if (!quantity || quantity <= 0) {
      const err = new Error("Cantidad inválida");
      err.statusCode = 400;
      throw err;
    }

    if (!data.saleItemId) {
      const err = new Error("Falta la venta original");
      err.statusCode = 400;
      throw err;
    }

    if (!String(data.reason || "").trim()) {
      const err = new Error("Falta la descripción del fallo");
      err.statusCode = 400;
      throw err;
    }

    let result = null;

    await this.runInOptionalTransaction(async (session) => {
      if (operationId) {
        const existingQuery = DefectiveProduct.findOne({
          business: businessId,
          origin: "customer_warranty",
          warrantyOperationId: operationId,
        })
          .populate("upsellSale")
          .lean();

        const existingReport = session
          ? await existingQuery.session(session)
          : await existingQuery;

        if (existingReport) {
          result = {
            report: existingReport,
            upsellSale: existingReport.upsellSale || null,
          };
          return;
        }
      }

      const saleItemQuery = Sale.findOne({
        _id: data.saleItemId,
        business: businessId,
      })
        .populate("product", "name purchasePrice averageCost")
        .lean();

      const saleItem = session
        ? await saleItemQuery.session(session)
        : await saleItemQuery;

      if (!saleItem) {
        const err = new Error("Venta original no encontrada");
        err.statusCode = 404;
        throw err;
      }

      if (
        contextRole === "employee" &&
        saleItem.employee &&
        saleItem.employee.toString() !== userId.toString()
      ) {
        const err = new Error("No tienes acceso a esta venta");
        err.statusCode = 403;
        throw err;
      }

      const soldQty = Number(saleItem.quantity || 0);
      if (quantity > soldQty) {
        const err = new Error("La cantidad supera lo vendido");
        err.statusCode = 400;
        throw err;
      }

      const alreadyWarrantedQty = await this.getWarrantedQuantityForSaleItem(
        businessId,
        saleItem._id,
        session,
      );
      const availableWarrantyQty = soldQty - alreadyWarrantedQty;
      if (quantity > availableWarrantyQty) {
        const err = new Error(
          `La cantidad supera el saldo disponible para garantía (${availableWarrantyQty})`,
        );
        err.statusCode = 400;
        throw err;
      }

      if (!data.replacementProductId) {
        const err = new Error("Selecciona el producto de reemplazo");
        err.statusCode = 400;
        throw err;
      }

      if (data.replacementPrice !== undefined) {
        const parsedReplacementPrice = Number(data.replacementPrice);
        if (
          !Number.isFinite(parsedReplacementPrice) ||
          parsedReplacementPrice < 0
        ) {
          const err = new Error("Precio de reemplazo inválido");
          err.statusCode = 400;
          throw err;
        }
      }

      const defectiveProductId = saleItem.product?._id || saleItem.product;
      const replacementProductQuery = Product.findOne({
        _id: data.replacementProductId,
        business: businessId,
      }).lean();

      const replacementProduct = session
        ? await replacementProductQuery.session(session)
        : await replacementProductQuery;

      if (!replacementProduct) {
        const err = new Error("Producto de reemplazo no encontrado");
        err.statusCode = 404;
        throw err;
      }

      const replacementPrice =
        Number(data.replacementPrice) ||
        replacementProduct.clientPrice ||
        replacementProduct.suggestedPrice ||
        replacementProduct.employeePrice ||
        saleItem.salePrice ||
        0;

      const {
        originalMargin,
        replacementMargin,
        marginDelta,
        priceDifference,
        cashRefund,
        replacementTotal,
        warrantyLossAmount,
      } = this.buildWarrantyLedger({
        saleItem,
        replacementProduct,
        quantity,
        replacementPrice,
        cashRefundInput: data.cashRefund,
      });

      const replacementSource = data.replacementSource;
      if (!replacementSource) {
        const err = new Error("Selecciona el origen del reemplazo");
        err.statusCode = 400;
        throw err;
      }

      if (!["warehouse", "branch", "employee"].includes(replacementSource)) {
        const err = new Error("Origen de reemplazo inválido");
        err.statusCode = 400;
        throw err;
      }

      const resolvedReplacementSource = replacementSource;

      if (resolvedReplacementSource === "employee") {
        if (contextRole !== "employee") {
          const err = new Error(
            "Solo empleados pueden usar su inventario",
          );
          err.statusCode = 403;
          throw err;
        }

        const distStock = await EmployeeStock.findOneAndUpdate(
          {
            business: businessId,
            employee: userId,
            product: replacementProduct._id,
            quantity: { $gte: quantity },
          },
          { $inc: { quantity: -quantity } },
          session ? { new: true, session } : { new: true },
        );

        if (!distStock) {
          const err = new Error("Stock insuficiente del empleado");
          err.statusCode = 400;
          throw err;
        }

        await Product.findByIdAndUpdate(
          replacementProduct._id,
          {
            $inc: { totalStock: -quantity },
          },
          session ? { session } : {},
        );
      } else if (resolvedReplacementSource === "branch") {
        const branchId = data.replacementBranchId;
        if (!branchId) {
          const err = new Error("Falta la sede de reemplazo");
          err.statusCode = 400;
          throw err;
        }

        const branchStock = await BranchStock.findOneAndUpdate(
          {
            business: businessId,
            branch: branchId,
            product: replacementProduct._id,
            quantity: { $gte: quantity },
          },
          { $inc: { quantity: -quantity } },
          session ? { new: true, session } : { new: true },
        );

        if (!branchStock) {
          const err = new Error("Stock insuficiente en la sede");
          err.statusCode = 400;
          throw err;
        }

        await Product.findByIdAndUpdate(
          replacementProduct._id,
          {
            $inc: { totalStock: -quantity },
          },
          session ? { session } : {},
        );
      } else {
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: replacementProduct._id,
            business: businessId,
            warehouseStock: { $gte: quantity },
          },
          { $inc: { warehouseStock: -quantity, totalStock: -quantity } },
          session ? { new: true, session } : { new: true },
        );

        if (!updatedProduct) {
          const err = new Error("Stock insuficiente en bodega");
          err.statusCode = 400;
          throw err;
        }
      }

      const ticketId = await this.generateWarrantyTicket(businessId, {
        session,
      });
      const isEmployee = contextRole === "employee";
      const resolvedSaleGroupId =
        saleItem.saleGroupId || saleItem._id?.toString();

      const [report] = await DefectiveProduct.create(
        [
          {
            employee: isEmployee ? userId : saleItem.employee || null,
            product: defectiveProductId,
            business: businessId,
            branch: saleItem.branch || null,
            quantity,
            reason: data.reason,
            images: data.images || [],
            hasWarranty: true,
            warrantyStatus: "pending",
            lossAmount: warrantyLossAmount,
            saleGroupId: resolvedSaleGroupId,
            ticketId,
            originalSaleId: saleItem.saleId,
            originalSaleGroupId: resolvedSaleGroupId,
            originalSaleItem: saleItem._id,
            originalSaleDate: saleItem.saleDate,
            originalSalePrice: saleItem.salePrice,
            replacementProduct: replacementProduct._id,
            replacementQuantity: quantity,
            replacementPrice,
            replacementTotal,
            priceDifference,
            cashRefund,
            replacementStockOrigin: replacementSource,
            replacementBranch:
              resolvedReplacementSource === "branch"
                ? data.replacementBranchId
                : null,
            replacementEmployee:
              resolvedReplacementSource === "employee" ? userId : null,
            stockOrigin: resolvedReplacementSource,
            status: isEmployee ? "pendiente" : "confirmado",
            confirmedAt: isEmployee ? null : Date.now(),
            confirmedBy: isEmployee ? null : userId,
            adminNotes: data.adminNotes,
            origin: "customer_warranty",
            warrantyResolution: "pending",
            warrantyOperationId: operationId,
          },
        ],
        session ? { session } : {},
      );

      let upsellSale = null;

      if (priceDifference > 0) {
        const upsellNetProfit = marginDelta;

        upsellSale = new Sale({
          business: businessId,
          branch: saleItem.branch || null,
          customer: saleItem.customer || null,
          customerName: saleItem.customerName || null,
          customerEmail: saleItem.customerEmail || null,
          customerPhone: saleItem.customerPhone || null,
          saleGroupId: resolvedSaleGroupId,
          isComplementarySale: true,
          parentSaleId: saleItem._id,
          parentSaleGroupId: resolvedSaleGroupId,
          warrantyTicketId: ticketId,
          employee: saleItem.employee || null,
          product: replacementProduct._id,
          quantity: 1,
          purchasePrice: 0,
          employeePrice: Number(saleItem.employeePrice || 0),
          salePrice: priceDifference,
          sourceLocation: resolvedReplacementSource,
          createdBy: userId,
          paymentStatus: isEmployee ? "pendiente" : "confirmado",
          paymentConfirmedAt: isEmployee ? null : new Date(),
          paymentConfirmedBy: isEmployee ? null : userId,
          actualPayment: priceDifference,
          discount: 0,
          shippingCost: 0,
          totalAdditionalCosts: 0,
          employeeProfit: 0,
          adminProfit: priceDifference,
          totalProfit: priceDifference,
          totalGroupProfit: priceDifference,
          netProfit: upsellNetProfit,
          notes: `Venta complementaria por garantía ${ticketId}`,
        });
        await upsellSale.save(session ? { session } : {});

        report.upsellSale = upsellSale._id;
        await report.save({ session });
      }

      const adminMembershipQuery = Membership.findOne({
        business: businessId,
        role: "admin",
        status: "active",
      })
        .select("user")
        .lean();

      const adminMembership = session
        ? await adminMembershipQuery.session(session)
        : await adminMembershipQuery;

      if (adminMembership?.user) {
        const adjustmentMetadata = {
          quantity,
          ticketId,
          eventName: "warranty_margin_delta",
          operationId: operationId || null,
          originalSaleId: saleItem.saleId,
          originalSaleGroupId: saleItem.saleGroupId,
          originalMargin,
          replacementMargin,
          marginDelta,
          priceDifference,
          cashRefund,
        };

        if (marginDelta !== 0) {
          await ProfitHistoryRepository.create(
            {
              business: businessId,
              user: adminMembership.user,
              type: "ajuste",
              amount: marginDelta,
              sale: saleItem._id,
              product: replacementProduct._id,
              description: `Ajuste de margen por garantia (${ticketId})`,
              date: new Date(),
              metadata: adjustmentMetadata,
            },
            { session },
          );
        }

        if (upsellSale && priceDifference > 0) {
          await ProfitHistoryRepository.create(
            {
              business: businessId,
              user: adminMembership.user,
              type: "venta_normal",
              amount: priceDifference,
              sale: upsellSale._id,
              product: replacementProduct._id,
              description: `Ingreso por upselling en garantía (${ticketId})`,
              date: new Date(),
              metadata: {
                quantity,
                salePrice: priceDifference,
                saleId: upsellSale.saleId,
                eventName: "warranty_upsell_sale",
                operationId: operationId || null,
                ticketId,
                originalSaleId: saleItem.saleId,
                originalMargin,
                replacementMargin,
                marginDelta,
                priceDifference,
                cashRefund,
              },
            },
            { session },
          );
        }
      }

      result = {
        report,
        upsellSale,
      };
    });

    return result;
  }

  async resolveCustomerWarranty(reportId, businessId, userId, data) {
    const operationId = this.normalizeOperationId(data?.operationId);
    let resolvedReport = null;

    await this.runInOptionalTransaction(async (session) => {
      const reportQuery = DefectiveProduct.findOne({
        _id: reportId,
        business: businessId,
      });

      const report = session
        ? await reportQuery.session(session)
        : await reportQuery;

      if (!report) {
        const err = new Error("Reporte no encontrado");
        err.statusCode = 404;
        throw err;
      }

      if (report.origin !== "customer_warranty") {
        const err = new Error("El reporte no es una garantia al cliente");
        err.statusCode = 400;
        throw err;
      }

      if (
        report.warrantyResolution &&
        report.warrantyResolution !== "pending"
      ) {
        if (operationId && report.resolutionOperationId === operationId) {
          resolvedReport = report;
          return;
        }
        const err = new Error("La garantia ya fue resuelta");
        err.statusCode = 400;
        throw err;
      }

      const resolution = data?.resolution;
      if (!resolution || !["scrap", "supplier_warranty"].includes(resolution)) {
        const err = new Error("Resolucion invalida");
        err.statusCode = 400;
        throw err;
      }

      const previousLossAmount = Number(report.lossAmount || 0);

      report.warrantyResolution = resolution;
      report.warrantyResolvedAt = new Date();
      report.warrantyResolvedBy = userId;
      report.adminNotes = data?.adminNotes || report.adminNotes;
      report.status = "confirmado";
      if (operationId) {
        report.resolutionOperationId = operationId;
      }

      if (resolution === "scrap") {
        const productQuery = Product.findOne({
          _id: report.product,
          business: businessId,
        }).lean();

        const product = session
          ? await productQuery.session(session)
          : await productQuery;

        if (!product) {
          const err = new Error("Producto no encontrado");
          err.statusCode = 404;
          throw err;
        }

        const unitCost = product.averageCost || product.purchasePrice || 0;
        const lossAmount = unitCost * (report.quantity || 0);
        report.lossAmount = lossAmount;
        report.hasWarranty = false;
        report.warrantyStatus = "rejected";

        if (lossAmount > 0) {
          await this.expenseRepository.create(
            businessId,
            {
              type: "Pérdida por Garantía",
              amount: lossAmount,
              description: `Pérdida total por garantía (${report.quantity}): ${product.name}`,
              expenseDate: new Date(),
            },
            userId,
            {
              session,
              operationId:
                operationId ||
                `warranty-scrap:${report._id.toString()}:${report.updatedAt?.getTime?.() || Date.now()}`,
            },
          );
        }
      } else {
        report.lossAmount = 0;
        report.hasWarranty = true;
        report.warrantyStatus = "pending";

        if (previousLossAmount !== 0) {
          const existingCompensationQuery = ProfitHistory.findOne({
            business: businessId,
            type: "ajuste",
            "metadata.eventName": "warranty_supplier_compensation",
            "metadata.reportId": report._id,
          })
            .select("_id")
            .lean();

          const existingCompensation = session
            ? await existingCompensationQuery.session(session)
            : await existingCompensationQuery;

          if (!existingCompensation) {
            await ProfitHistory.create(
              [
                {
                  business: businessId,
                  user: userId,
                  type: "ajuste",
                  amount: previousLossAmount,
                  product: report.product,
                  description: `Reverso ajuste por garantía proveedor (${report.ticketId || report._id})`,
                  date: new Date(),
                  metadata: {
                    eventName: "warranty_supplier_compensation",
                    operationId: operationId || null,
                    reportId: report._id,
                    ticketId: report.ticketId,
                    originalSaleId: report.originalSaleId || null,
                    priceDifference: report.priceDifference || 0,
                    cashRefund: report.cashRefund || 0,
                    lossAmount: previousLossAmount,
                  },
                },
              ],
              session ? { session } : {},
            );
          }
        }
      }

      await report.save(session ? { session } : {});
      resolvedReport = report;
    });

    return resolvedReport;
  }

  async findByBusiness(businessId, filters = {}) {
    const query = { business: businessId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.employee) {
      query.employee = filters.employee;
    }

    if (filters.stockOrigin) {
      query.stockOrigin = filters.stockOrigin;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      DefectiveProduct.find(query)
        .populate("product", "name image purchasePrice averageCost")
        .populate("replacementProduct", "name image clientPrice")
        .populate("replacementBranch", "name")
        .populate("replacementEmployee", "name email")
        .populate("upsellSale", "saleId salePrice quantity")
        .populate("employee", "name email")
        .populate("confirmedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DefectiveProduct.countDocuments(query),
    ]);

    await this.normalizeConfirmedLosses(businessId, reports);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async normalizeConfirmedLosses(businessId, reports) {
    if (!Array.isArray(reports) || reports.length === 0) return;

    const fixes = reports.map(async (report) => {
      if (report.status !== "confirmado" || report.hasWarranty) return;

      const product =
        report.product && typeof report.product === "object"
          ? report.product
          : null;

      const unitCost = product?.averageCost || product?.purchasePrice || 0;
      if (!unitCost) return;

      const quantity = report.quantity || 0;
      const correctLoss = unitCost * quantity;

      if (Number(report.lossAmount || 0) !== correctLoss) {
        await DefectiveProduct.updateOne(
          { _id: report._id },
          { $set: { lossAmount: correctLoss } },
        );

        report.lossAmount = correctLoss;
      }

      await this.syncDefectiveProfitHistoryLoss(
        businessId,
        report,
        correctLoss,
        product?.name,
      );
    });

    await Promise.all(fixes);
  }

  async syncDefectiveProfitHistoryLoss(
    businessId,
    report,
    correctLoss,
    productName,
  ) {
    if (!correctLoss || !Number.isFinite(correctLoss)) return;

    const originLabel =
      report.stockOrigin === "employee" ? " (Empleado)" : "";
    const dateBase = report.confirmedAt || report.updatedAt || report.createdAt;

    const baseFilter = {
      business: businessId,
      type: "ajuste",
      "metadata.eventName": "defective_loss",
    };

    const reportId = report?._id;
    let history = reportId
      ? await ProfitHistory.findOne({
          ...baseFilter,
          "metadata.reportId": reportId,
        })
      : null;

    if (!history) {
      const description = `Pérdida por defectuoso${originLabel} (${report.quantity}): ${productName || "Producto"}`;
      const dateStart = dateBase ? new Date(dateBase) : null;
      const dateEnd = dateBase ? new Date(dateBase) : null;

      if (dateStart && dateEnd) {
        dateStart.setHours(0, 0, 0, 0);
        dateEnd.setHours(23, 59, 59, 999);
      }

      const dateFilter =
        dateStart && dateEnd
          ? { date: { $gte: dateStart, $lte: dateEnd } }
          : {};

      history = await ProfitHistory.findOne({
        ...baseFilter,
        description,
        ...dateFilter,
      }).sort({ date: -1 });
    }

    if (!history) {
      const confirmedById =
        report.confirmedBy && typeof report.confirmedBy === "object"
          ? report.confirmedBy._id
          : report.confirmedBy;

      if (!confirmedById) return;

      await ProfitHistory.create({
        business: businessId,
        user: confirmedById,
        type: "ajuste",
        amount: -correctLoss,
        product:
          report.product && typeof report.product === "object"
            ? report.product._id
            : report.product,
        description: `Pérdida por defectuoso${originLabel} (${report.quantity}): ${productName || "Producto"}`,
        date: dateBase ? new Date(dateBase) : new Date(),
        metadata: {
          quantity: report.quantity,
          salePrice: 0,
          saleId: null,
          eventName: "defective_loss",
          reportId: reportId,
          unitCost: correctLoss / (report.quantity || 1),
        },
      });
      return;
    }

    const expectedAmount = -correctLoss;
    if (history.amount === expectedAmount) return;

    history.amount = expectedAmount;
    history.product =
      report.product && typeof report.product === "object"
        ? report.product._id
        : report.product;
    history.metadata = {
      ...history.metadata,
      reportId: reportId || history.metadata?.reportId,
      unitCost: correctLoss / (report.quantity || 1),
    };

    await history.save();
  }

  async findById(id, businessId) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    })
      .populate("product", "name image purchasePrice employeePrice")
      .populate("replacementProduct", "name image clientPrice")
      .populate("replacementBranch", "name")
      .populate("replacementEmployee", "name email")
      .populate("upsellSale", "saleId salePrice quantity")
      .populate("employee", "name email")
      .populate("confirmedBy", "name email")
      .lean();

    return report;
  }

  async confirmReport(id, businessId, userId, data) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (report.status !== "pendiente") {
      const err = new Error("El reporte ya fue procesado");
      err.statusCode = 400;
      throw err;
    }

    const product = await Product.findOne({
      _id: report.product,
      business: businessId,
    }).lean();

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const hasWarranty = Boolean(data?.hasWarranty);
    const unitCost = product.averageCost || product.purchasePrice || 0;
    const lossAmount = hasWarranty ? 0 : unitCost * report.quantity;

    report.status = "confirmado";
    report.confirmedAt = Date.now();
    report.confirmedBy = userId;
    report.adminNotes = data.adminNotes;
    report.hasWarranty = hasWarranty;
    report.warrantyStatus = hasWarranty ? "approved" : "not_applicable";
    report.lossAmount = lossAmount;

    if (report.stockOrigin === "employee") {
      const employeeStock = await EmployeeStock.findOne({
        employee: report.employee,
        product: report.product,
        business: businessId,
      });

      if (employeeStock) {
        employeeStock.quantity -= report.quantity;
        await employeeStock.save();
      }

      await Product.findByIdAndUpdate(report.product, {
        $inc: { totalStock: -report.quantity },
      });
    } else if (report.stockOrigin === "branch" && report.branch) {
      await BranchStock.findOneAndUpdate(
        {
          branch: report.branch,
          product: report.product,
          business: businessId,
        },
        { $inc: { quantity: -report.quantity } },
      );

      await Product.findByIdAndUpdate(report.product, {
        $inc: { totalStock: -report.quantity },
      });
    } else if (report.stockOrigin === "warehouse") {
      await Product.findByIdAndUpdate(report.product, {
        $inc: {
          warehouseStock: -report.quantity,
          totalStock: -report.quantity,
        },
      });
    }

    if (!hasWarranty && lossAmount > 0) {
      const existing = await ProfitHistory.findOne({
        business: businessId,
        type: "ajuste",
        "metadata.eventName": "defective_loss",
        "metadata.reportId": report._id,
      });

      if (existing) {
        if (existing.amount !== -lossAmount) {
          existing.amount = -lossAmount;
          existing.product = report.product;
          existing.metadata = {
            ...existing.metadata,
            quantity: report.quantity,
            unitCost,
          };
          await existing.save();
        }
      } else {
        await ProfitHistory.create({
          business: businessId,
          user: userId,
          type: "ajuste",
          amount: -lossAmount,
          product: report.product,
          description: `Pérdida por defectuoso (${report.quantity}): ${product.name}`,
          date: new Date(),
          metadata: {
            quantity: report.quantity,
            salePrice: 0,
            saleId: null,
            eventName: "defective_loss",
            reportId: report._id,
            unitCost,
          },
        });
      }
    }

    await report.save();
    return report;
  }

  async rejectReport(id, businessId, userId, data) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (report.status !== "pendiente") {
      const err = new Error("El reporte ya fue procesado");
      err.statusCode = 400;
      throw err;
    }

    report.status = "rechazado";
    report.confirmedAt = Date.now();
    report.confirmedBy = userId;
    report.adminNotes = data.adminNotes;

    await report.save();
    return report;
  }

  async approveWarranty(id, businessId, userId, data) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (!report.hasWarranty) {
      const err = new Error("El reporte no tiene garantía");
      err.statusCode = 400;
      throw err;
    }

    if (report.warrantyStatus === "approved") {
      const err = new Error("La garantía ya fue aprobada");
      err.statusCode = 400;
      throw err;
    }

    if (report.warrantyStatus === "rejected") {
      const err = new Error("La garantía ya fue rechazada");
      err.statusCode = 400;
      throw err;
    }

    if (report.stockRestored) {
      const err = new Error("El stock ya fue repuesto");
      err.statusCode = 400;
      throw err;
    }

    report.warrantyStatus = "approved";
    report.stockRestored = true;
    report.stockRestoredAt = new Date();
    report.lossAmount = 0;
    report.adminNotes = data?.adminNotes || report.adminNotes;

    const quantity = report.quantity || 0;
    let newStock = { warehouseStock: 0, totalStock: 0 };

    if (quantity > 0) {
      if (report.stockOrigin === "employee" && report.employee) {
        await EmployeeStock.findOneAndUpdate(
          {
            employee: report.employee,
            product: report.product,
            business: businessId,
          },
          { $inc: { quantity } },
        );

        const product = await Product.findByIdAndUpdate(
          report.product,
          { $inc: { totalStock: quantity } },
          { new: true },
        ).lean();
        newStock = {
          warehouseStock: product?.warehouseStock || 0,
          totalStock: product?.totalStock || 0,
        };
      } else if (report.stockOrigin === "branch" && report.branch) {
        await BranchStock.findOneAndUpdate(
          {
            branch: report.branch,
            product: report.product,
            business: businessId,
          },
          { $inc: { quantity } },
        );

        const product = await Product.findByIdAndUpdate(
          report.product,
          { $inc: { totalStock: quantity } },
          { new: true },
        ).lean();
        newStock = {
          warehouseStock: product?.warehouseStock || 0,
          totalStock: product?.totalStock || 0,
        };
      } else {
        const product = await Product.findByIdAndUpdate(
          report.product,
          { $inc: { warehouseStock: quantity, totalStock: quantity } },
          { new: true },
        ).lean();
        newStock = {
          warehouseStock: product?.warehouseStock || 0,
          totalStock: product?.totalStock || 0,
        };
      }
    }

    await report.save();
    return { report, newStock };
  }

  async rejectWarranty(id, businessId, userId, data) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (!report.hasWarranty) {
      const err = new Error("El reporte no tiene garantía");
      err.statusCode = 400;
      throw err;
    }

    if (report.warrantyStatus === "approved") {
      const err = new Error("La garantía ya fue aprobada");
      err.statusCode = 400;
      throw err;
    }

    if (report.warrantyStatus === "rejected") {
      const err = new Error("La garantía ya fue rechazada");
      err.statusCode = 400;
      throw err;
    }

    const product = await Product.findOne({
      _id: report.product,
      business: businessId,
    }).lean();

    if (!product) {
      const err = new Error("Producto no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const unitCost = product.averageCost || product.purchasePrice || 0;
    const lossAmount = unitCost * (report.quantity || 0);

    report.warrantyStatus = "rejected";
    report.lossAmount = lossAmount;
    report.adminNotes = data?.adminNotes || report.adminNotes;

    if (lossAmount > 0) {
      const existing = await ProfitHistory.findOne({
        business: businessId,
        type: "ajuste",
        "metadata.eventName": "defective_loss",
        "metadata.reportId": report._id,
      });

      if (existing) {
        if (existing.amount !== -lossAmount) {
          existing.amount = -lossAmount;
          existing.product = report.product;
          existing.metadata = {
            ...existing.metadata,
            quantity: report.quantity,
            unitCost,
          };
          await existing.save();
        }
      } else {
        await ProfitHistory.create({
          business: businessId,
          user: userId,
          type: "ajuste",
          amount: -lossAmount,
          product: report.product,
          description: `Pérdida por garantía rechazada (${report.quantity}): ${product.name}`,
          date: new Date(),
          metadata: {
            quantity: report.quantity,
            salePrice: 0,
            saleId: null,
            eventName: "defective_loss",
            reportId: report._id,
            unitCost,
          },
        });
      }
    }

    await report.save();
    return { report, lossAmount };
  }

  async cancelReport(id, businessId) {
    const report = await DefectiveProduct.findOne({
      _id: id,
      business: businessId,
    });

    if (!report) {
      const err = new Error("Reporte no encontrado");
      err.statusCode = 404;
      throw err;
    }

    const isCustomerWarranty =
      report.origin === "customer_warranty" && report.replacementProduct;
    const shouldRestore = isCustomerWarranty
      ? true
      : report.status === "confirmado" && !report.stockRestored;
    const quantity =
      Number(
        isCustomerWarranty ? report.replacementQuantity : report.quantity,
      ) || 0;
    const productId = isCustomerWarranty
      ? report.replacementProduct
      : report.product;
    const stockOrigin = isCustomerWarranty
      ? report.replacementStockOrigin || report.stockOrigin
      : report.stockOrigin;
    const branchId = isCustomerWarranty
      ? report.replacementBranch
      : report.branch;
    const employeeId = isCustomerWarranty
      ? report.replacementEmployee
      : report.employee;

    if (shouldRestore && quantity > 0) {
      if (stockOrigin === "employee" && employeeId) {
        await EmployeeStock.findOneAndUpdate(
          {
            employee: employeeId,
            product: productId,
            business: businessId,
          },
          { $inc: { quantity } },
        );

        await Product.findByIdAndUpdate(productId, {
          $inc: { totalStock: quantity },
        });
      } else if (stockOrigin === "branch" && branchId) {
        await BranchStock.findOneAndUpdate(
          {
            branch: branchId,
            product: productId,
            business: businessId,
          },
          { $inc: { quantity } },
        );

        await Product.findByIdAndUpdate(productId, {
          $inc: { totalStock: quantity },
        });
      } else {
        await Product.findByIdAndUpdate(productId, {
          $inc: { warehouseStock: quantity, totalStock: quantity },
        });
      }
    }

    await DefectiveProduct.deleteOne({ _id: report._id });

    return {
      restoredQuantity: shouldRestore ? quantity : 0,
      restoredTo: stockOrigin || "warehouse",
    };
  }

  async getStats(businessId) {
    // Convertir businessId a ObjectId si es string
    const businessObjectId = mongoose.Types.ObjectId.isValid(businessId)
      ? new mongoose.Types.ObjectId(businessId)
      : businessId;

    const summary = await DefectiveProduct.aggregate([
      { $match: { business: businessObjectId } },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalLoss: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["confirmado", "procesado"]] },
                    { $gt: ["$lossAmount", 0] },
                  ],
                },
                "$lossAmount",
                0,
              ],
            },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pendiente"] }, 1, 0] },
          },
          confirmedCount: {
            $sum: { $cond: [{ $eq: ["$status", "confirmado"] }, 1, 0] },
          },
          rejectedCount: {
            $sum: { $cond: [{ $eq: ["$status", "rechazado"] }, 1, 0] },
          },
          withWarranty: {
            $sum: { $cond: ["$hasWarranty", 1, 0] },
          },
          warrantyPending: {
            $sum: { $cond: [{ $eq: ["$warrantyStatus", "pending"] }, 1, 0] },
          },
          warrantyApproved: {
            $sum: { $cond: [{ $eq: ["$warrantyStatus", "approved"] }, 1, 0] },
          },
          stockRestored: {
            $sum: { $cond: ["$stockRestored", "$quantity", 0] },
          },
        },
      },
    ]);

    const stats = summary[0] || {
      totalReports: 0,
      totalQuantity: 0,
      totalLoss: 0,
      pendingCount: 0,
      confirmedCount: 0,
      rejectedCount: 0,
      withWarranty: 0,
      warrantyPending: 0,
      warrantyApproved: 0,
      stockRestored: 0,
    };

    return stats;
  }
}
