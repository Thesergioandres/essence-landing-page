import { v4 as uuidv4 } from "uuid";
import { CommissionPolicyService } from "../../../domain/services/CommissionPolicyService.js";
import { FinanceService } from "../../../domain/services/FinanceService.js";
import { InventoryService } from "../../../domain/services/InventoryService.js";
import SaleWriteRepositoryAdapter from "../../../infrastructure/adapters/repositories/SaleWriteRepositoryAdapter.js";
import Branch from "../../../infrastructure/database/models/Branch.js";
import BranchStock from "../../../infrastructure/database/models/BranchStock.js";
import DefectiveProduct from "../../../infrastructure/database/models/DefectiveProduct.js";
import EmployeeStock from "../../../infrastructure/database/models/EmployeeStock.js";
import GamificationConfig from "../../../infrastructure/database/models/GamificationConfig.js";
import Membership from "../../../infrastructure/database/models/Membership.js";
import PaymentMethod from "../../../infrastructure/database/models/PaymentMethod.js";
import { getEmployeeCommissionInfo } from "../../../infrastructure/services/employeePricing.service.js";
import { applySaleGamification } from "../../../infrastructure/services/gamification.service.js";
import {
  employeeRoleQuery,
  isEmployeeRole,
} from "../../../utils/roleAliases.js";
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
   * âš ï¸ INVENTORY SYMMETRY NOTE:
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
   * @param {Array} input.items - Array of { productId, quantity, salePrice }
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
    const bypassBusinessScope = user?.role === "god";
    const resolveTrustedSalePrice = (product) => {
      const candidates = [
        product?.clientPrice,
        product?.price,
        product?.salePrice,
        product?.suggestedPrice,
      ];

      const trustedPrice = candidates.find(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0,
      );

      if (!Number.isFinite(Number(trustedPrice)) || Number(trustedPrice) <= 0) {
        throw new Error(
          `Precio invalido para el producto ${product?.name || product?._id}.`,
        );
      }

      return Number(trustedPrice);
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

    let commissionPolicy = CommissionPolicyService.resolveEmployeeCommission(
      {
        requestedCommissionRate: employeeProfitPercentage,
      },
    );

    if (employeeId) {
      const commissionInfo = await getEmployeeCommissionInfo(
        employeeId,
        businessId,
      );

      if (commissionInfo?.isCommissionFixed) {
        commissionPolicy = CommissionPolicyService.resolveEmployeeCommission(
          {
            isCommissionFixed: true,
            customCommissionRate:
              commissionInfo.customCommissionRate ??
              commissionInfo.profitPercentage,
          },
        );
      } else {
        const config = await GamificationConfig.findOne().lean();
        commissionPolicy = CommissionPolicyService.resolveEmployeeCommission(
          {
            requestedCommissionRate: employeeProfitPercentage,
            baseCommissionRate: FinanceService.resolveBaseCommissionPercentage(
              config,
              employeeProfitPercentage,
            ),
            bonusCommission: commissionInfo?.bonusCommission || 0,
          },
        );
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
    let totalSubtotal = 0;

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

    const productCache = new Map();
    const trustedItems = [];

    for (const item of items) {
      const productId = item?.productId;
      const quantity = Number(item?.quantity || 0);

      if (!productId) {
        throw new Error("Producto invalido en items de venta.");
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for product ${productId}`);
      }

      const product = await this.productRepository.findByIdForBusiness(
        productId,
        businessId,
        { bypassBusinessScope },
      );

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const salePrice = resolveTrustedSalePrice(product);

      productCache.set(String(productId), product);
      trustedItems.push({
        ...item,
        productId,
        quantity,
        product,
        salePrice,
      });
    }

    totalSubtotal = trustedItems.reduce(
      (sum, item) =>
        sum + Number(item.salePrice || 0) * Number(item.quantity || 0),
      0,
    );

    const requiredByProduct = new Map();
    trustedItems.forEach((item) => {
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

    let warrantyLossTotal = 0;

    for (const warranty of warrantyItems) {
      if (warranty.type !== "total_loss") continue;
      const productKey = String(warranty.productId);
      const product =
        productCache.get(productKey) ||
        (await this.productRepository.findByIdForBusiness(
          warranty.productId,
          businessId,
          { bypassBusinessScope },
        ));

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

    const isEmployeeUser = isEmployeeRole(user?.role);

    if (isEmployeeUser && employeeId) {
      const employeeMembership = await Membership.findOne({
        business: businessId,
        user: employeeId,
        role: employeeRoleQuery,
        status: "active",
      })
        .select("allowedBranches")
        .lean();

      const allowedBranches = Array.isArray(
        employeeMembership?.allowedBranches,
      )
        ? employeeMembership.allowedBranches.map((branch) => String(branch))
        : [];

      if (resolvedSourceLocation === "branch") {
        if (!allowedBranches.includes(String(branchId))) {
          throw new Error(
            "No tienes permiso para vender desde la sede seleccionada.",
          );
        }
      }

      if (resolvedSourceLocation === "warehouse") {
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

      const product = await this.productRepository.findByIdForBusiness(
        productId,
        businessId,
        { bypassBusinessScope },
      );
      return {
        availableStock: product?.warehouseStock ?? 0,
        stockOrigin: "warehouse",
      };
    };

    for (const item of trustedItems) {
      const { productId, quantity, product, salePrice } = item;

      const itemSubtotal = Number(salePrice || 0) * Number(quantity || 0);
      const discountShare =
        totalSubtotal > 0 ? (itemSubtotal / totalSubtotal) * discountTotal : 0;
      const additionalShare =
        totalSubtotal > 0
          ? (itemSubtotal / totalSubtotal) * additionalTotal
          : 0;
      const actualPayment = Math.max(
        0,
        itemSubtotal - discountShare - additionalShare,
      );

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
            `Stock insuficiente en el empleado para ${product.name}. Disponible: ${availableStock}`,
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
        employeePrice = FinanceService.calculateEmployeePrice(
          salePrice,
          effectiveEmployeeProfitPercentage,
        );
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
      const adminNetProfit = adminProfit - additionalShare - discountShare;

      validatedItems.push({
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
        employeeProfitPercentage: effectiveEmployeeProfitPercentage,
        commissionBonus: appliedCommissionBonus,
        commissionBonusAmount: isEmployeeSale
          ? (salePrice * quantity * appliedCommissionBonus) / 100
          : 0,
      });
    }

    const validatedProductIds = new Set(
      validatedItems.map((item) => String(item.productId)),
    );

    for (const warranty of warrantyItems) {
      const productKey = String(warranty.productId);
      if (validatedProductIds.has(productKey)) continue;

      const product =
        productCache.get(productKey) ||
        (await this.productRepository.findByIdForBusiness(
          warranty.productId,
          businessId,
          { bypassBusinessScope },
        ));
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
    let totalTransactionAmount = 0;
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
        actualPayment,
        discount: discountShare,
        additionalCosts: additionalCostsForSale,
        purchasePrice: product.purchasePrice,
        averageCostAtSale: costBasis,
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
        // ðŸ’° FINANCIAL LOGIC FIX:
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
        // Employee Sale â†’ Deduct from EmployeeStock
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

        console.warn("[Essence Debug]", 
          `ðŸ“¦ Deducted ${quantity} from EmployeeStock (employee: ${employeeId})`,
        );
      } else if (useBranchStock) {
        // Admin Sale from Branch â†’ Deduct from BranchStock
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

        console.warn("[Essence Debug]", `ðŸ“¦ Deducted ${quantity} from BranchStock (admin sale)`);
      } else {
        // Admin Sale â†’ Deduct from Warehouse
        await this.productRepository.updateWarehouseStockForBusiness(
          productId,
          businessId,
          -quantity,
          session,
          { bypassBusinessScope },
        );
        console.warn("[Essence Debug]", `ðŸ“¦ Deducted ${quantity} from Warehouse (admin sale)`);
      }

      // Always update global totalStock counter for statistics
      await this.productRepository.updateStockForBusiness(
        productId,
        businessId,
        -quantity,
        session,
        { bypassBusinessScope },
      );

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
            description: `ComisiÃ³n por venta ${createdSale.saleId}`,
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
                ? `Ganancia de venta ${createdSale.saleId} (empleado)`
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

        if (employeeId) {
          await applySaleGamification({
            businessId,
            sale: createdSale,
            product,
          });
        }
      }

      totalTransactionAmount += actualPayment;
      netTransactionProfit += adminNetProfit;
    }

    if (warrantyItems.length > 0) {
      const adminMembership = await resolveAdminMembership();

      for (const warranty of warrantyItems) {
        const productKey = String(warranty.productId);
        const product =
          productCache.get(productKey) ||
          (await this.productRepository.findByIdForBusiness(
            warranty.productId,
            businessId,
            { bypassBusinessScope },
          ));

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
              `Stock insuficiente en el empleado para ${product.name}.`,
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
          await this.productRepository.updateWarehouseStockForBusiness(
            warranty.productId,
            businessId,
            -quantity,
            session,
            { bypassBusinessScope },
          );
        }

        await this.productRepository.updateStockForBusiness(
          warranty.productId,
          businessId,
          -quantity,
          session,
          { bypassBusinessScope },
        );

        const hasWarranty = warranty.type === "supplier_replacement";
        const unitCost = product.averageCost || product.purchasePrice || 0;
        const lossAmount = hasWarranty ? 0 : unitCost * quantity;

        const reportData = {
          employee:
            resolvedSourceLocation === "employee" ? employeeId : null,
          branch: resolvedSourceLocation === "branch" ? branchId : null,
          product: warranty.productId,
          business: businessId,
          quantity,
          reason:
            warranty.reason ||
            `${hasWarranty ? "Reemplazo proveedor" : "PÃ©rdida total"} - Orden ${saleGroupId}`,
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
              description: `PÃ©rdida por defectuoso (${quantity}): ${product.name}`,
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
        throw new Error("El cliente es obligatorio para ventas a crÃ©dito.");
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
        session,
      );

      if (initialPayment && Number(initialPayment) > 0) {
        await CreditRepository.registerPayment(
          {
            creditId: credit._id,
            businessId,
            amount: Number(initialPayment),
            notes: "Pago inicial",
            userId: user.id,
          },
          session,
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

