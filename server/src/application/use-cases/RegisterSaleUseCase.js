import { v4 as uuidv4 } from "uuid";
import Branch from "../../../models/Branch.js";
import BranchStock from "../../../models/BranchStock.js";
import DefectiveProduct from "../../../models/DefectiveProduct.js";
import DistributorStock from "../../../models/DistributorStock.js";
import GamificationConfig from "../../../models/GamificationConfig.js";
import Membership from "../../../models/Membership.js";
import PaymentMethod from "../../../models/PaymentMethod.js";
import { getDistributorCommissionInfo } from "../../../utils/distributorPricing.js";
import { applySaleGamification } from "../../../utils/gamificationEngine.js";
import { FinanceService } from "../../domain/services/FinanceService.js";
import { InventoryService } from "../../domain/services/InventoryService.js";
import CreditRepository from "../../infrastructure/database/repositories/CreditRepository.js";
import { ProductRepository } from "../../infrastructure/database/repositories/ProductRepository.js";
import ProfitHistoryRepository from "../../infrastructure/database/repositories/ProfitHistoryRepository.js";
import { SaleRepository } from "../../infrastructure/database/repositories/SaleRepository.js";
export class RegisterSaleUseCase {
  constructor() {
    this.saleRepository = new SaleRepository();
    this.productRepository = new ProductRepository();
  }

  /**
   * Orchestrates the BULK sale registration process.
   *
   * ⚠️ INVENTORY SYMMETRY NOTE:
   * This V2 implementation deducts stock from Product.totalStock (global warehouse).
   * If you need to support sales from Branches or Distributor Stock, you must:
   * 1. Add branchId parameter to identify source
   * 2. Call BranchStock.findOneAndUpdate() or DistributorStock.findOneAndUpdate()
   * 3. Ensure DeleteSaleController mirrors this logic when restoring stock
   *
   * Currently, DeleteSaleController checks sale.branch/sale.distributor fields,
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
      distributorId,
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
      distributorProfitPercentage = 20,
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
    let distributorCommissionBonus = 0;
    let baseCommissionPercentage = distributorProfitPercentage;
    if (distributorId) {
      const commissionInfo = await getDistributorCommissionInfo(
        distributorId,
        businessId,
      );

      if (commissionInfo?.isCommissionFixed) {
        const fixedRate = Number(
          commissionInfo.customCommissionRate ??
            commissionInfo.profitPercentage,
        );
        baseCommissionPercentage = Number.isFinite(fixedRate)
          ? Math.max(0, Math.min(95, fixedRate))
          : Math.max(
              0,
              Math.min(95, Number(distributorProfitPercentage) || 20),
            );
        distributorCommissionBonus = 0;
      } else {
        const config = await GamificationConfig.findOne().lean();
        baseCommissionPercentage =
          FinanceService.resolveBaseCommissionPercentage(
            config,
            distributorProfitPercentage,
          );
        distributorCommissionBonus = Number(
          commissionInfo?.bonusCommission || 0,
        );
      }
    }

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
    const totalSubtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.salePrice || 0) * Number(item.quantity || 0),
      0,
    );

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
      sourceLocation === "distributor" && distributorId
        ? "distributor"
        : sourceLocation === "branch" && branchId
          ? "branch"
          : "warehouse";

    const isDistributorUser = user?.role === "distribuidor";

    if (isDistributorUser && distributorId) {
      const distributorMembership = await Membership.findOne({
        business: businessId,
        user: distributorId,
        role: "distribuidor",
        status: "active",
      })
        .select("allowedBranches")
        .lean();

      const allowedBranches = Array.isArray(
        distributorMembership?.allowedBranches,
      )
        ? distributorMembership.allowedBranches.map((branch) => String(branch))
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
      const useDistributorStock =
        Boolean(distributorId) && resolvedSourceLocation === "distributor";
      const useBranchStock =
        resolvedSourceLocation === "branch" && Boolean(branchId);

      if (useDistributorStock) {
        const distStock = await DistributorStock.findOne({
          business: businessId,
          distributor: distributorId,
          product: productId,
        });
        return {
          availableStock: distStock?.quantity || 0,
          stockOrigin: "distributor",
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
      const { productId, quantity, salePrice } = item;
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

      if (quantity <= 0)
        throw new Error(`Invalid quantity for product ${productId}`);

      const product = await this.productRepository.findById(productId);
      if (!product) throw new Error(`Product not found: ${productId}`);

      productCache.set(String(productId), product);

      const requiredQuantity =
        requiredByProduct.get(String(productId)) || quantity;

      let availableStock = 0;
      const useDistributorStock =
        Boolean(distributorId) && resolvedSourceLocation === "distributor";
      const useBranchStock =
        resolvedSourceLocation === "branch" && Boolean(branchId);

      if (useDistributorStock) {
        const distStock = await DistributorStock.findOne({
          business: businessId,
          distributor: distributorId,
          product: productId,
        });

        availableStock = distStock?.quantity || 0;
        if (
          !InventoryService.hasSufficientStock(availableStock, requiredQuantity)
        ) {
          throw new Error(
            `Stock insuficiente en el distribuidor para ${product.name}. Disponible: ${availableStock}`,
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
      const isDistributorSale = Boolean(distributorId);
      const rawEffectiveDistributorProfitPercentage =
        baseCommissionPercentage + distributorCommissionBonus;
      const effectiveDistributorProfitPercentage = isDistributorSale
        ? Math.max(0, Math.min(95, rawEffectiveDistributorProfitPercentage))
        : 0;
      const appliedCommissionBonus = isDistributorSale
        ? Math.max(
            0,
            effectiveDistributorProfitPercentage - baseCommissionPercentage,
          )
        : 0;
      let distributorPrice = salePrice;
      if (isDistributorSale) {
        distributorPrice = FinanceService.calculateDistributorPrice(
          salePrice,
          effectiveDistributorProfitPercentage,
        );
      }
      const distributorProfit = isDistributorSale
        ? FinanceService.calculateDistributorProfit(
            salePrice,
            distributorPrice,
            quantity,
          )
        : 0;
      const adminProfit = FinanceService.calculateAdminProfit(
        salePrice,
        costBasis,
        distributorProfit,
        quantity,
      );
      const totalProfit = distributorProfit + adminProfit;
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
        distributorPrice,
        distributorProfit,
        adminProfit,
        totalProfit,
        adminNetProfit,
        distributorProfitPercentage: effectiveDistributorProfitPercentage,
        commissionBonus: appliedCommissionBonus,
        commissionBonusAmount: isDistributorSale
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
        distributorPrice,
        distributorProfit,
        adminProfit,
        totalProfit,
        adminNetProfit,
        distributorProfitPercentage,
        commissionBonus,
        commissionBonusAmount,
      } = item;

      // E. Create Sale Record FIRST (Infra)
      const requiresAdminConfirmation = Boolean(distributorId);
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
        distributorPrice,
        distributorProfit,
        adminProfit,
        totalProfit,
        netProfit: adminNetProfit,
        distributorProfitPercentage,
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

      // Track distributor and branch attribution independently
      if (distributorId) {
        saleData.distributor = distributorId;
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

      const useDistributorStock =
        Boolean(distributorId) && resolvedSourceLocation === "distributor";
      const useBranchStock =
        resolvedSourceLocation === "branch" && Boolean(branchId);

      // F. Deduct Stock ONLY AFTER sale is confirmed (Infra) - LOCATION-AWARE
      // This ensures stock is only deducted if the sale was successfully created
      if (useDistributorStock) {
        // Distributor Sale → Deduct from DistributorStock
        const distStock = await DistributorStock.findOneAndUpdate(
          {
            business: businessId,
            distributor: distributorId,
            product: productId,
          },
          { $inc: { quantity: -quantity } },
          session ? { session, new: true } : { new: true },
        );

        if (!distStock) {
          throw new Error(
            `Distributor stock not found for product ${productId}. Ensure stock is assigned first.`,
          );
        }

        console.log(
          `📦 Deducted ${quantity} from DistributorStock (distributor: ${distributorId})`,
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

        // If distributor sale, create entry for distributor's profit
        if (distributorId && distributorProfit > 0) {
          await ProfitHistoryRepository.create({
            business: businessId,
            user: distributorId,
            type: "venta_normal",
            amount: distributorProfit,
            sale: createdSale._id,
            product: productId,
            description: `Comisión por venta ${createdSale.saleId}`,
            date: saleDate,
            metadata: {
              quantity,
              salePrice,
              saleId: createdSale.saleId,
              commission: distributorProfitPercentage,
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
              description: distributorId
                ? `Ganancia de venta ${createdSale.saleId} (distribuidor)`
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

        if (distributorId) {
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
          (await this.productRepository.findById(warranty.productId));

        if (!product) {
          throw new Error(`Product not found: ${warranty.productId}`);
        }

        const quantity = Number(warranty.quantity || 0);
        if (quantity <= 0) continue;

        if (resolvedSourceLocation === "distributor" && distributorId) {
          const distStock = await DistributorStock.findOneAndUpdate(
            {
              business: businessId,
              distributor: distributorId,
              product: warranty.productId,
              quantity: { $gte: quantity },
            },
            { $inc: { quantity: -quantity } },
            session ? { session, new: true } : { new: true },
          );

          if (!distStock) {
            throw new Error(
              `Stock insuficiente en el distribuidor para ${product.name}.`,
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
          distributor:
            resolvedSourceLocation === "distributor" ? distributorId : null,
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
