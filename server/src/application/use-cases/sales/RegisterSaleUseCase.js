import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { CommissionPolicyService } from "../../../domain/services/CommissionPolicyService.js";
import { FinanceService } from "../../../domain/services/FinanceService.js";
import { GamificationService } from "../../../domain/services/GamificationService.js";
import { InventoryService } from "../../../domain/services/InventoryService.js";
import SaleWriteRepositoryAdapter from "../../../infrastructure/adapters/repositories/SaleWriteRepositoryAdapter.js";
import Branch from "../../../infrastructure/database/models/Branch.js";
import BranchStock from "../../../infrastructure/database/models/BranchStock.js";
import DefectiveProduct from "../../../infrastructure/database/models/DefectiveProduct.js";
import EmployeePoints from "../../../infrastructure/database/models/EmployeePoints.js";
import EmployeeStock from "../../../infrastructure/database/models/EmployeeStock.js";
import GamificationConfig from "../../../infrastructure/database/models/GamificationConfig.js";
import Membership from "../../../infrastructure/database/models/Membership.js";
import PaymentMethod from "../../../infrastructure/database/models/PaymentMethod.js";
import { getEmployeeCommissionInfo } from "../../../infrastructure/services/employeePricing.service.js";
import { resolveManualEmployeePrice } from "../../../infrastructure/services/productPricing.service.js";
import { employeeRoleQuery } from "../../../utils/roleAliases.js";
import CreditRepository from "../repository-gateways/CreditPersistenceUseCase.js";
import { ProductPersistenceUseCase } from "../repository-gateways/ProductPersistenceUseCase.js";
import ProfitHistoryRepository from "../repository-gateways/ProfitHistoryPersistenceUseCase.js";
export class RegisterSaleUseCase {
  constructor({ saleWriteRepository, productRepository } = {}) {
    this.saleRepository =
      saleWriteRepository || new SaleWriteRepositoryAdapter();
    this.productRepository =
      productRepository || new ProductPersistenceUseCase();
  }

  /**
   * Orchestrates the BULK sale registration process.
   *
   * ⚠️ INVENTORY SYMMETRY NOTE:
   * This V2 implementation deducts stock from Product.totalStock (global warehouse).
   * If you need to support sales from Branches or Employee Stock, you must:
   * 1. Add branchId parameter to identify source
   * 2. Call BranchStock.findOneAndUpdate() or EmployeeStock.findOneAndUpdate()
   * 3. Ensure DeleteSaleController mirrors this logic when restoring stock
   *
   * Currently, DeleteSaleController checks sale.branch/sale.employee fields,
   * but this UseCase does NOT set those fields from actual stock sources.
   *
   * @param {Object} input - DTO containing sale details
   * @param {Array} input.items - Array of { productId, quantity, salePrice|unitPrice|finalPrice }
   * @param {Object} input.user - User performing the action
   * @param {mongoose.ClientSession} session - Active transaction session
   */
  async execute(input, session) {
    const {
      user,
      items, // Expecting Array
      businessId,
      employeeId,
      branchId,
      notes,
      paymentMethodId,
      customerId,
      creditDueDate,
      initialPayment,
      paymentProof,
      paymentProofMimeType,
      saleDate,
      deliveryMethodId,
      shippingCost,
      locationType,
      discount = 0,
      additionalCosts = [],
      warranties = [],
      employeeProfitPercentage = 20,
    } = input;

    const resolveSaleDate = (rawDate) => {
      if (!rawDate) return new Date();
      if (rawDate instanceof Date) return rawDate;
      if (typeof rawDate === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          const [year, month, day] = rawDate.split("-").map(Number);
          return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
        }
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      return new Date();
    };

    const resolvedSaleDate = resolveSaleDate(saleDate);

    const resolveRequestedSalePrice = (item) => {
      const candidates = [
        item?.salePrice,
        item?.unitPrice,
        item?.finalPrice,
        item?.price,
      ];

      for (const value of candidates) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
      }

      return 0;
    };

    const resolveCatalogSalePrice = (product) => {
      const candidates = [
        product?.clientPrice,
        product?.salePrice,
        product?.price,
        product?.suggestedPrice,
      ];

      for (const value of candidates) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
      }

      return 0;
    };

    // 1. Validation (Business Rules)
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No items provided for sale.");
    }

    let branchName = null;
    if (branchId) {
      const branch = await Branch.findOne({
        _id: branchId,
        business: businessId,
      })
        .select("name")
        .lean();
      branchName = branch?.name || null;
    }

    // 1.1 Resolve PaymentMethod
    // If paymentMethodId is a string code like "cash", "credit", find the actual ObjectId
    let resolvedPaymentMethodId = paymentMethodId;
    let paymentMethodCode = null;

    if (paymentMethodId && typeof paymentMethodId === "string") {
      // Check if it's a valid ObjectId format (24 hex chars)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(paymentMethodId);

      if (!isObjectId) {
        // It's a code like "cash", "credit", need to lookup
        const paymentMethod = await PaymentMethod.findOne({
          business: businessId,
          code: paymentMethodId,
        });

        if (paymentMethod) {
          resolvedPaymentMethodId = paymentMethod._id;
          paymentMethodCode = paymentMethod.code;
        } else {
          // If not found in business-specific methods, try system-wide defaults
          // For backwards compatibility or system codes
          console.warn(
            `PaymentMethod with code "${paymentMethodId}" not found for business ${businessId}. Using code directly.`,
          );
          // Keep the code, but don't set ObjectId
          resolvedPaymentMethodId = null;
          paymentMethodCode = paymentMethodId;
        }
      }
    }

    if (!paymentMethodCode && resolvedPaymentMethodId) {
      const paymentMethod = await PaymentMethod.findOne({
        _id: resolvedPaymentMethodId,
        business: businessId,
      });
      if (paymentMethod) {
        paymentMethodCode = paymentMethod.code;
      }
    }

    const saleGroupId = uuidv4(); // Unique ID for this batch

    // 2. PHASE 1: Validate ALL items BEFORE making any changes
    const validatedItems = [];

    let commissionPolicy = CommissionPolicyService.resolveEmployeeCommission({
      requestedCommissionRate: employeeProfitPercentage,
    });

    // === GAMIFICATION: Resolve tier bonus for commission ===
    let gamificationConfig = null;
    let employeeMembershipForGamification = null;
    let gamificationTierBonus = 0;

    if (employeeId) {
      const commissionInfo = await getEmployeeCommissionInfo(
        employeeId,
        businessId,
      );

      // Load gamification config for this business
      gamificationConfig = await GamificationConfig.findOne({
        business: businessId,
        enabled: true,
      }).lean();

      if (gamificationConfig && !commissionInfo?.isCommissionFixed) {
        // Check if employee is eligible for gamification bonus
        employeeMembershipForGamification = await Membership.findOne({
          business: businessId,
          user: employeeId,
          role: employeeRoleQuery,
          status: "active",
        })
          .select("eligibleForGamificationBonus")
          .lean();

        const isEligible =
          employeeMembershipForGamification?.eligibleForGamificationBonus !== false;

        // Get current points to determine tier
        const employeePointsDoc = await EmployeePoints.findOne({
          employee: employeeId,
          business: businessId,
        })
          .select("currentPoints")
          .lean();

        const currentPoints = employeePointsDoc?.currentPoints || 0;
        const tierResult = GamificationService.resolveTier(
          currentPoints,
          gamificationConfig.tiers,
        );

        gamificationTierBonus = GamificationService.getTierBonusIfEligible(
          isEligible,
          tierResult.tier,
        );
      }

      if (commissionInfo?.isCommissionFixed) {
        commissionPolicy = CommissionPolicyService.resolveEmployeeCommission({
          isCommissionFixed: true,
          customCommissionRate:
            commissionInfo.customCommissionRate ??
            commissionInfo.profitPercentage,
        });
      } else {
        commissionPolicy = CommissionPolicyService.resolveEmployeeCommission({
          requestedCommissionRate: employeeProfitPercentage,
          baseCommissionRate:
            commissionInfo?.baseCommissionPercentage ??
            employeeProfitPercentage,
          bonusCommission: gamificationTierBonus,
        });
      }
    }

    const { baseCommissionPercentage, employeeCommissionBonus } =
      commissionPolicy;

    const discountTotal = Math.max(0, Number(discount || 0));
    const additionalChargesTotal = (additionalCosts || []).reduce(
      (sum, cost) =>
        sum + (Number(cost?.amount || 0) > 0 ? Number(cost.amount) : 0),
      0,
    );
    const additionalAdjustmentsTotal = (additionalCosts || []).reduce(
      (sum, cost) =>
        sum +
        (Number(cost?.amount || 0) < 0 ? Math.abs(Number(cost.amount)) : 0),
      0,
    );
    const additionalTotal = additionalChargesTotal + additionalAdjustmentsTotal;

    const normalizedWarranties = Array.isArray(warranties) ? warranties : [];
    const warrantyItems = [];

    for (const warranty of normalizedWarranties) {
      const productId = warranty?.productId;
      const quantity = Number(warranty?.quantity || 0);

      if (!productId) {
        throw new Error("Producto de garantia invalido.");
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(
          `Cantidad de garantia invalida para producto ${productId}.`,
        );
      }

      const type =
        warranty?.type === "supplier_replacement"
          ? "supplier_replacement"
          : "total_loss";

      warrantyItems.push({
        productId,
        quantity,
        type,
        reason: warranty?.reason,
      });
    }

    const requiredByProduct = new Map();
    items.forEach((item) => {
      const key = String(item.productId);
      requiredByProduct.set(
        key,
        (requiredByProduct.get(key) || 0) + Number(item.quantity || 0),
      );
    });
    warrantyItems.forEach((warranty) => {
      const key = String(warranty.productId);
      requiredByProduct.set(
        key,
        (requiredByProduct.get(key) || 0) + Number(warranty.quantity || 0),
      );
    });

    const productCache = new Map();
    let warrantyLossTotal = 0;

    for (const warranty of warrantyItems) {
      if (warranty.type !== "total_loss") continue;
      const productKey = String(warranty.productId);
      const product =
        productCache.get(productKey) ||
        (await this.productRepository.findById(warranty.productId));

      if (!product) {
        throw new Error(`Product not found: ${warranty.productId}`);
      }

      productCache.set(productKey, product);

      const unitCost = product.averageCost || product.purchasePrice || 0;
      warrantyLossTotal += unitCost * Number(warranty.quantity || 0);
    }

    const sourceLocation = locationType || input.sourceLocation;
    const resolvedSourceLocation =
      sourceLocation === "employee" && employeeId
        ? "employee"
        : sourceLocation === "branch" && branchId
          ? "branch"
          : "warehouse";

    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      const employeeMembership = await Membership.findOne({
        business: businessId,
        user: employeeId,
        role: employeeRoleQuery,
        status: "active",
      })
        .select("allowedBranches")
        .lean();

      const allowedBranches = Array.isArray(employeeMembership?.allowedBranches)
        ? employeeMembership.allowedBranches.map((branch) => String(branch))
        : [];

      const hasBranchRestrictions = allowedBranches.length > 0;

      if (hasBranchRestrictions && resolvedSourceLocation === "branch") {
        if (!allowedBranches.includes(String(branchId))) {
          throw new Error(
            "No tienes permiso para vender desde la sede seleccionada.",
          );
        }
      }

      if (hasBranchRestrictions && resolvedSourceLocation === "warehouse") {
        const hasWarehousePermission = await Branch.exists({
          business: businessId,
          _id: { $in: allowedBranches },
          isWarehouse: true,
          active: true,
        });

        if (!hasWarehousePermission) {
          throw new Error(
            "No tienes permiso para vender desde la bodega central.",
          );
        }
      }
    }

    const resolveStockAvailability = async (productId) => {
      const useEmployeeStock =
        Boolean(employeeId) && resolvedSourceLocation === "employee";
      const useBranchStock =
        resolvedSourceLocation === "branch" && Boolean(branchId);

      if (useEmployeeStock) {
        const distStock = await EmployeeStock.findOne({
          business: businessId,
          employee: employeeId,
          product: productId,
        });
        return {
          availableStock: distStock?.quantity || 0,
          stockOrigin: "employee",
        };
      }

      if (useBranchStock) {
        const branchStock = await BranchStock.findOne({
          business: businessId,
          branch: branchId,
          product: productId,
        });
        return {
          availableStock: branchStock?.quantity || 0,
          stockOrigin: "branch",
        };
      }

      const product = await this.productRepository.findById(productId);
      return {
        availableStock: product?.warehouseStock ?? 0,
        stockOrigin: "warehouse",
      };
    };

    for (const item of items) {
      const { productId, quantity } = item;

      if (quantity <= 0)
        throw new Error(`Invalid quantity for product ${productId}`);

      // 🛡️ Anti-IDOR y Anti-Manipulación de Precios
      const product = await this.productRepository.findById(productId);
      if (!product) throw new Error(`Product not found: ${productId}`);

      // Muro Anti-IDOR: Verificar pertinencia de negocio si NO es GOD
      if (
        user?.role !== "god" &&
        String(product.business) !== String(businessId)
      ) {
        throw new Error(
          `Acceso denegado: El producto no pertenece a tu negocio.`,
        );
      }

      // Usar el precio modificado si se envía desde el frontend
      const requestedSalePrice = resolveRequestedSalePrice(item);
      let salePrice = resolveCatalogSalePrice(product);

      if (requestedSalePrice > 0) {
        salePrice = requestedSalePrice;
      }

      if (salePrice <= 0) {
        throw new Error(
          `Precio de venta inválido para ${product.name}. Configura clientPrice en catálogo antes de vender. Precio recibido en payload: ${requestedSalePrice}.`,
        );
      }

      const itemSubtotal = Number(salePrice || 0) * Number(quantity || 0);

      productCache.set(String(productId), product);

      const requiredQuantity =
        requiredByProduct.get(String(productId)) || quantity;

      let availableStock = 0;
      const useEmployeeStock =
        Boolean(employeeId) && resolvedSourceLocation === "employee";
      const useBranchStock =
        resolvedSourceLocation === "branch" && Boolean(branchId);

      if (useEmployeeStock) {
        const distStock = await EmployeeStock.findOne({
          business: businessId,
          employee: employeeId,
          product: productId,
        });

        availableStock = distStock?.quantity || 0;
        if (
          !InventoryService.hasSufficientStock(availableStock, requiredQuantity)
        ) {
          throw new Error(
            `Stock insuficiente en el employee para ${product.name}. Disponible: ${availableStock}`,
          );
        }
      } else if (useBranchStock) {
        const branchStock = await BranchStock.findOne({
          business: businessId,
          branch: branchId,
          product: productId,
        });

        availableStock = branchStock?.quantity || 0;
        if (
          !InventoryService.hasSufficientStock(availableStock, requiredQuantity)
        ) {
          throw new Error(
            `Stock insuficiente en la sede para ${product.name}. Disponible: ${availableStock}`,
          );
        }
      } else {
        availableStock = product.warehouseStock ?? 0;
        if (
          !InventoryService.hasSufficientStock(availableStock, requiredQuantity)
        ) {
          throw new Error(
            `Stock insuficiente en bodega para ${product.name}. Disponible: ${availableStock}`,
          );
        }
      }

      // Calculate financials
      const costBasis = product.averageCost || product.purchasePrice || 0;
      const isEmployeeSale = Boolean(employeeId);
      const rawEffectiveEmployeeProfitPercentage =
        baseCommissionPercentage + employeeCommissionBonus;
      const effectiveEmployeeProfitPercentage = isEmployeeSale
        ? Math.max(0, Math.min(95, rawEffectiveEmployeeProfitPercentage))
        : 0;
      const appliedCommissionBonus = isEmployeeSale
        ? Math.max(
            0,
            effectiveEmployeeProfitPercentage - baseCommissionPercentage,
          )
        : 0;
      let employeePrice = salePrice;
      if (isEmployeeSale) {
        const manualEmployeePrice = resolveManualEmployeePrice(product);
        if (manualEmployeePrice !== null && manualEmployeePrice >= 0) {
          employeePrice = manualEmployeePrice;
        } else {
          employeePrice = FinanceService.calculateEmployeePrice(
            salePrice,
            effectiveEmployeeProfitPercentage,
          );
        }
      }
      const employeeProfit = isEmployeeSale
        ? FinanceService.calculateEmployeeProfit(
            salePrice,
            employeePrice,
            quantity,
          )
        : 0;
      const adminProfit = FinanceService.calculateAdminProfit(
        salePrice,
        costBasis,
        employeeProfit,
        quantity,
      );
      const totalProfit = employeeProfit + adminProfit;

      validatedItems.push({
        productId,
        product,
        quantity,
        salePrice,
        itemSubtotal,
        discountShare: 0,
        actualPayment: itemSubtotal,
        additionalShare: 0,
        costBasis,
        employeePrice,
        employeeProfit,
        adminProfit,
        totalProfit,
        adminNetProfit: adminProfit,
        employeeProfitPercentage: effectiveEmployeeProfitPercentage,
        commissionBonus: appliedCommissionBonus,
        commissionBonusAmount: isEmployeeSale
          ? (salePrice * quantity * appliedCommissionBonus) / 100
          : 0,
      });
    }

    const totalSubtotal = validatedItems.reduce(
      (sum, item) => sum + Number(item.itemSubtotal || 0),
      0,
    );

    if (!Number.isFinite(totalSubtotal) || totalSubtotal <= 0) {
      throw new Error(
        "No se pudo calcular el total de la venta. Verifica que los productos tengan precio de venta válido.",
      );
    }

    for (const item of validatedItems) {
      const discountShare = (item.itemSubtotal / totalSubtotal) * discountTotal;
      const additionalShare =
        (item.itemSubtotal / totalSubtotal) * additionalTotal;
      const actualPayment = Math.max(
        0,
        item.itemSubtotal - discountShare - additionalShare,
      );

      item.discountShare = discountShare;
      item.additionalShare = additionalShare;
      item.actualPayment = actualPayment;
      item.adminNetProfit = item.adminProfit - additionalShare - discountShare;
    }

    const totalTransactionAmountFromItems = validatedItems.reduce(
      (sum, item) => sum + Number(item.actualPayment || 0),
      0,
    );

    if (
      !Number.isFinite(totalTransactionAmountFromItems) ||
      totalTransactionAmountFromItems <= 0
    ) {
      throw new Error(
        "La venta no puede registrarse con total $0. Verifica precios, descuentos y costos adicionales.",
      );
    }

    const validatedProductIds = new Set(
      validatedItems.map((item) => String(item.productId)),
    );

    for (const warranty of warrantyItems) {
      const productKey = String(warranty.productId);
      if (validatedProductIds.has(productKey)) continue;

      const product =
        productCache.get(productKey) ||
        (await this.productRepository.findById(warranty.productId));
      if (!product) {
        throw new Error(`Product not found: ${warranty.productId}`);
      }

      productCache.set(productKey, product);

      const { availableStock } = await resolveStockAvailability(
        warranty.productId,
      );
      const requiredQuantity =
        requiredByProduct.get(productKey) || warranty.quantity;

      if (
        !InventoryService.hasSufficientStock(availableStock, requiredQuantity)
      ) {
        throw new Error(
          `Stock insuficiente para garantia en ${product.name}. Disponible: ${availableStock}`,
        );
      }
    }

    // 3. PHASE 2: All validations passed, now make the changes
    const results = [];
    const creditItems = [];
    const totalTransactionAmount = totalTransactionAmountFromItems;
    let netTransactionProfit = 0;
    let adminMembership = null;

    const resolveAdminMembership = async () => {
      if (adminMembership) return adminMembership;
      adminMembership = await Membership.findOne({
        business: businessId,
        role: "admin",
        status: "active",
      })
        .select("user")
        .lean();
      return adminMembership;
    };

    for (const item of validatedItems) {
      const {
        productId,
        product,
        quantity,
        salePrice,
        itemSubtotal,
        discountShare,
        actualPayment,
        additionalShare,
        costBasis,
        employeePrice,
        employeeProfit,
        adminProfit,
        totalProfit,
        adminNetProfit,
        employeeProfitPercentage,
        commissionBonus,
        commissionBonusAmount,
      } = item;

      // E. Create Sale Record FIRST (Infra)
      const requiresAdminConfirmation = Boolean(employeeId);
      const isCreditSale = paymentMethodCode === "credit";
      const shouldConfirmNow = !requiresAdminConfirmation && !isCreditSale;

      const additionalCostsForSale = [];
      const additionalChargeShare =
        additionalTotal > 0
          ? (additionalShare * additionalChargesTotal) / additionalTotal
          : 0;
      const additionalAdjustmentShare =
        additionalTotal > 0
          ? (additionalShare * additionalAdjustmentsTotal) / additionalTotal
          : 0;

      if (additionalChargeShare > 0) {
        additionalCostsForSale.push({
          type: "costo",
          description: "Costo adicional prorrateado",
          amount: additionalChargeShare,
        });
      }

      if (additionalAdjustmentShare > 0) {
        additionalCostsForSale.push({
          type: "ajuste",
          description: "Ajuste prorrateado",
          amount: -additionalAdjustmentShare,
        });
      }

      if (warrantyLossTotal > 0 && totalSubtotal > 0) {
        const warrantyShare =
          (itemSubtotal / totalSubtotal) * warrantyLossTotal;
        if (warrantyShare > 0) {
          additionalCostsForSale.push({
            type: "warranty",
            description: "Garantia prorrateada",
            amount: warrantyShare,
          });
        }
      }

      const saleData = {
        business: businessId,
        product: productId,
        productName: product.name,
        quantity,
        salePrice,
        unitPrice: salePrice,
        totalPrice: salePrice * quantity,
        actualPayment,
        discount: discountShare,
        additionalCosts: additionalCostsForSale,
        purchasePrice: product.purchasePrice,
        averageCostAtSale: costBasis,
        costAtSale: costBasis,
        employeePrice,
        employeeProfit,
        adminProfit,
        totalProfit,
        netProfit: adminNetProfit,
        employeeProfitPercentage,
        commissionBonus,
        commissionBonusAmount,
        notes,
        saleDate: resolvedSaleDate,
        sourceLocation: resolvedSourceLocation,
        saleGroupId, // Link them!
        paymentMethod: resolvedPaymentMethodId, // Use resolved ObjectId
        paymentMethodCode: paymentMethodCode, // Store the code for quick lookups
        paymentProof: paymentProof || null,
        paymentProofMimeType: paymentProofMimeType || null,
        deliveryMethod: deliveryMethodId,
        shippingCost: shippingCost ?? 0,
        createdBy: user.id, // Track who created the sale
        // 💰 FINANCIAL LOGIC FIX:
        // Cash sales (non-credit) must be CONFIRMED immediately to count towards profit.
        // Credit sales remain PENDING until fully paid.
        paymentStatus: shouldConfirmNow ? "confirmado" : "pendiente",
        paymentConfirmedAt: shouldConfirmNow ? resolvedSaleDate : null,
      };

      // Track employee and branch attribution independently
      if (employeeId) {
        saleData.employee = employeeId;
      }
      if (branchId) {
        saleData.branch = branchId;
        if (branchName) {
          saleData.branchName = branchName;
        }
      }

      const createdSale = await this.saleRepository.create(saleData, session);
      results.push(createdSale);

      creditItems.push({
        product: productId,
        productName: product.name,
        quantity,
        unitPrice: salePrice,
        subtotal: salePrice * quantity,
        cost: costBasis * quantity,
        image: product.image?.url || product.image || "",
      });

      const useEmployeeStock =
        Boolean(employeeId) && resolvedSourceLocation === "employee";
      const useBranchStock =
        resolvedSourceLocation === "branch" && Boolean(branchId);

      // F. Deduct Stock ONLY AFTER sale is confirmed (Infra) - LOCATION-AWARE
      // This ensures stock is only deducted if the sale was successfully created
      if (useEmployeeStock) {
        // Employee Sale → Deduct from EmployeeStock
        const distStock = await EmployeeStock.findOneAndUpdate(
          {
            business: businessId,
            employee: employeeId,
            product: productId,
          },
          { $inc: { quantity: -quantity } },
          session ? { session, new: true } : { new: true },
        );

        if (!distStock) {
          throw new Error(
            `Employee stock not found for product ${productId}. Ensure stock is assigned first.`,
          );
        }

        console.log(
          `📦 Deducted ${quantity} from EmployeeStock (employee: ${employeeId})`,
        );
      } else if (useBranchStock) {
        // Admin Sale from Branch → Deduct from BranchStock
        const updatedBranchStock = await BranchStock.findOneAndUpdate(
          {
            business: businessId,
            branch: branchId,
            product: productId,
            quantity: { $gte: quantity },
          },
          { $inc: { quantity: -quantity } },
          session ? { session, new: true } : { new: true },
        );

        if (!updatedBranchStock) {
          throw new Error(
            `Stock insuficiente en la sede para ${product.name}.`,
          );
        }

        console.log(`📦 Deducted ${quantity} from BranchStock (admin sale)`);
      } else {
        // Admin Sale → Deduct from Warehouse
        await this.productRepository.updateWarehouseStock(
          productId,
          -quantity,
          session,
        );
        console.log(`📦 Deducted ${quantity} from Warehouse (admin sale)`);
      }

      // Always update global totalStock counter for statistics
      await this.productRepository.updateStock(productId, -quantity, session);

      // G. Create ProfitHistory entries for tracking
      // Only create entries for CONFIRMED sales
      if (saleData.paymentStatus === "confirmado") {
        const saleDate = resolvedSaleDate;

        // If employee sale, create entry for employee's profit
        if (employeeId && employeeProfit > 0) {
          await ProfitHistoryRepository.create({
            business: businessId,
            user: employeeId,
            type: "venta_normal",
            amount: employeeProfit,
            sale: createdSale._id,
            product: productId,
            description: `Comisión por venta ${createdSale.saleId}`,
            date: saleDate,
            metadata: {
              quantity,
              salePrice,
              saleId: createdSale.saleId,
              commission: employeeProfitPercentage,
            },
          });
        }

        // Create entry for admin's profit
        if (adminProfit > 0) {
          // Find admin user for this business via Membership
          const adminMembership = await resolveAdminMembership();

          if (adminMembership) {
            await ProfitHistoryRepository.create({
              business: businessId,
              user: adminMembership.user,
              type: "venta_normal",
              amount: adminProfit,
              sale: createdSale._id,
              product: productId,
              description: employeeId
                ? `Ganancia de venta ${createdSale.saleId} (employee)`
                : `Venta directa ${createdSale.saleId}`,
              date: saleDate,
              metadata: {
                quantity,
                salePrice,
                saleId: createdSale.saleId,
              },
            });

            if (additionalShare > 0) {
              await ProfitHistoryRepository.create({
                business: businessId,
                user: adminMembership.user,
                type: "ajuste",
                amount: -additionalShare,
                sale: createdSale._id,
                product: productId,
                description: `Costo adicional venta ${createdSale.saleId}`,
                date: saleDate,
                metadata: {
                  quantity,
                  salePrice,
                  saleId: createdSale.saleId,
                },
              });
            }
          }
        }
      }

      // === GAMIFICATION: Accrue points atomically ===
      if (
        employeeId &&
        gamificationConfig &&
        saleData.paymentStatus === "confirmado"
      ) {
        const pointsMultiplier = product.gamificationPointsMultiplier || 1;
        const amountPerPoint =
          gamificationConfig.pointsRatio?.amountPerPoint || 1000;
        const { points } = GamificationService.calculatePointsForSale(
          salePrice * quantity,
          pointsMultiplier,
          amountPerPoint,
        );

        if (points > 0) {
          const pointsEntry = {
            type: "earned",
            points,
            sale: createdSale._id,
            saleGroupId,
            productName: product.name,
            multiplier: pointsMultiplier,
            saleAmount: salePrice * quantity,
            description: `+${points} pts por venta ${createdSale.saleId}`,
            createdAt: new Date(),
          };

          const updatedPoints = await EmployeePoints.findOneAndUpdate(
            { employee: employeeId, business: businessId },
            {
              $inc: { currentPoints: points },
              $push: {
                history: {
                  $each: [pointsEntry],
                  $slice: -500, // Keep last 500 entries to prevent unbounded growth
                },
              },
              $set: { lastPointsEarnedAt: new Date() },
            },
            session
              ? { session, upsert: true, new: true }
              : { upsert: true, new: true },
          );

          // Update cached tier
          if (updatedPoints) {
            const tierResult = GamificationService.resolveTier(
              updatedPoints.currentPoints,
              gamificationConfig.tiers,
            );
            updatedPoints.currentTier = {
              name: tierResult.tier?.name || null,
              bonusPercentage: tierResult.bonusPercentage,
            };
            await updatedPoints.save(session ? { session } : undefined);
          }
        }
      }

      netTransactionProfit += adminNetProfit;
    }

    if (warrantyItems.length > 0) {
      const adminMembership = await resolveAdminMembership();

      for (const warranty of warrantyItems) {
        const productKey = String(warranty.productId);
        const product =
          productCache.get(productKey) ||
          (await this.productRepository.findById(warranty.productId));

        if (!product) {
          throw new Error(`Product not found: ${warranty.productId}`);
        }

        const quantity = Number(warranty.quantity || 0);
        if (quantity <= 0) continue;

        if (resolvedSourceLocation === "employee" && employeeId) {
          const distStock = await EmployeeStock.findOneAndUpdate(
            {
              business: businessId,
              employee: employeeId,
              product: warranty.productId,
              quantity: { $gte: quantity },
            },
            { $inc: { quantity: -quantity } },
            session ? { session, new: true } : { new: true },
          );

          if (!distStock) {
            throw new Error(
              `Stock insuficiente en el employee para ${product.name}.`,
            );
          }
        } else if (resolvedSourceLocation === "branch" && branchId) {
          const branchStock = await BranchStock.findOneAndUpdate(
            {
              business: businessId,
              branch: branchId,
              product: warranty.productId,
              quantity: { $gte: quantity },
            },
            { $inc: { quantity: -quantity } },
            session ? { session, new: true } : { new: true },
          );

          if (!branchStock) {
            throw new Error(
              `Stock insuficiente en la sede para ${product.name}.`,
            );
          }
        } else {
          await this.productRepository.updateWarehouseStock(
            warranty.productId,
            -quantity,
            session,
          );
        }

        await this.productRepository.updateStock(
          warranty.productId,
          -quantity,
          session,
        );

        const hasWarranty = warranty.type === "supplier_replacement";
        const unitCost = product.averageCost || product.purchasePrice || 0;
        const lossAmount = hasWarranty ? 0 : unitCost * quantity;

        const reportData = {
          employee: resolvedSourceLocation === "employee" ? employeeId : null,
          branch: resolvedSourceLocation === "branch" ? branchId : null,
          product: warranty.productId,
          business: businessId,
          quantity,
          reason:
            warranty.reason ||
            `${hasWarranty ? "Reemplazo proveedor" : "Pérdida total"} - Orden ${saleGroupId}`,
          images: [],
          hasWarranty,
          warrantyStatus: hasWarranty ? "pending" : "not_applicable",
          lossAmount,
          saleGroupId,
          origin: "order",
          stockOrigin: resolvedSourceLocation,
          status: "confirmado",
          confirmedAt: Date.now(),
          confirmedBy: user.id,
          adminNotes: hasWarranty
            ? "Reporte con garantia - pendiente reposicion de stock"
            : "Reporte sin garantia - perdida registrada",
        };

        const [createdReport] = session
          ? await DefectiveProduct.create([reportData], { session })
          : await DefectiveProduct.create([reportData]);

        if (!hasWarranty && lossAmount > 0) {
          if (adminMembership) {
            await ProfitHistoryRepository.create({
              business: businessId,
              user: adminMembership.user,
              type: "ajuste",
              amount: -lossAmount,
              product: warranty.productId,
              description: `Pérdida por defectuoso (${quantity}): ${product.name}`,
              date: resolvedSaleDate,
              metadata: {
                quantity,
                salePrice: 0,
                saleId: null,
                eventName: "defective_loss",
                reportId: createdReport?._id,
                saleGroupId,
                unitCost,
              },
            });
          }
        }
      }
    }

    if (paymentMethodCode === "credit") {
      if (!customerId) {
        throw new Error("El cliente es obligatorio para ventas a crédito.");
      }

      const credit = await CreditRepository.create(
        businessId,
        {
          customerId,
          amount: totalTransactionAmount,
          dueDate: creditDueDate,
          description: notes,
          items: creditItems,
          saleId: results[0]?._id || null,
        },
        user.id,
      );

      if (initialPayment && Number(initialPayment) > 0) {
        await CreditRepository.registerPayment(
          credit._id,
          Number(initialPayment),
          "Pago inicial",
          user.id,
        );
      }
    }

    // Adjust Net Profit with Shipping (Once)
    // This return object is what the Frontend receives
    return {
      saleGroupId,
      totalAmount: totalTransactionAmount,
      totalItems: results.length,
      netProfit: netTransactionProfit - (shippingCost || 0) - warrantyLossTotal,
      adminProfit: results.reduce((sum, r) => sum + r.adminProfit, 0),
    };
  }
}
