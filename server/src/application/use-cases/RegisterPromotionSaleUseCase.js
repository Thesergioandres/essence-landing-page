import { v4 as uuidv4 } from "uuid";
import Branch from "../../../models/Branch.js";
import BranchStock from "../../../models/BranchStock.js";
import DistributorStock from "../../../models/DistributorStock.js";
import Membership from "../../../models/Membership.js";
import PaymentMethod from "../../../models/PaymentMethod.js";
import Promotion from "../../../models/Promotion.js";
import { applySaleGamification } from "../../../utils/gamificationEngine.js";
import { FinanceService } from "../../domain/services/FinanceService.js";
import { InventoryService } from "../../domain/services/InventoryService.js";
import CreditRepository from "../../infrastructure/database/repositories/CreditRepository.js";
import { ProductRepository } from "../../infrastructure/database/repositories/ProductRepository.js";
import ProfitHistoryRepository from "../../infrastructure/database/repositories/ProfitHistoryRepository.js";
import { SaleRepository } from "../../infrastructure/database/repositories/SaleRepository.js";
export class RegisterPromotionSaleUseCase {
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
    const distributorCommissionBonus = 0;

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

    const promotionIds = Array.from(
      new Set(
        items
          .map((item) => {
            if (!item.promotionId) return null;
            if (typeof item.promotionId === "object") {
              return item.promotionId._id || null;
            }
            return item.promotionId;
          })
          .filter((id) => Boolean(id)),
      ),
    );
    const promotionMap = new Map();
    if (promotionIds.length > 0) {
      const promotions = await Promotion.find({
        _id: { $in: promotionIds },
      })
        .select("_id distributorPrice")
        .lean();
      promotions.forEach((promo) => {
        promotionMap.set(String(promo._id), promo);
      });
    }
    const promotionTotals = items.reduce((acc, item) => {
      const rawPromotionId = item.promotionId;
      if (!rawPromotionId) return acc;
      const key = String(
        typeof rawPromotionId === "object"
          ? rawPromotionId._id || rawPromotionId
          : rawPromotionId,
      );
      const subtotal = Number(item.salePrice || 0) * Number(item.quantity || 0);
      acc[key] = (acc[key] || 0) + subtotal;
      return acc;
    }, {});

    const sourceLocation = locationType || input.sourceLocation;

    for (const item of items) {
      const { productId, quantity, salePrice, promotionId } = item;
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

      let availableStock = 0;
      const useDistributorStock =
        Boolean(distributorId) && sourceLocation === "distributor";
      const useBranchStock = sourceLocation === "branch" && Boolean(branchId);

      if (useDistributorStock) {
        const distStock = await DistributorStock.findOne({
          business: businessId,
          distributor: distributorId,
          product: productId,
        });

        availableStock = distStock?.quantity || 0;
        if (!InventoryService.hasSufficientStock(availableStock, quantity)) {
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
        if (!InventoryService.hasSufficientStock(availableStock, quantity)) {
          throw new Error(
            `Stock insuficiente en la sede para ${product.name}. Disponible: ${availableStock}`,
          );
        }
      } else {
        availableStock = product.warehouseStock ?? 0;
        if (!InventoryService.hasSufficientStock(availableStock, quantity)) {
          throw new Error(
            `Stock insuficiente en bodega para ${product.name}. Disponible: ${availableStock}`,
          );
        }
      }

      // Calculate financials
      const costBasis = product.averageCost || product.purchasePrice || 0;
      const isDistributorSale = Boolean(distributorId);
      const effectiveDistributorProfitPercentage = 0;
      const promotionKey = promotionId
        ? String(
            typeof promotionId === "object"
              ? promotionId._id || promotionId
              : promotionId,
          )
        : null;
      const promotionData = promotionKey
        ? promotionMap.get(promotionKey)
        : null;
      const promotionTotal = promotionKey
        ? Number(promotionTotals[promotionKey] || 0)
        : 0;
      const promotionDistributorTotal = promotionData
        ? Number(promotionData.distributorPrice || 0)
        : 0;
      const promotionShare =
        promotionTotal > 0 ? itemSubtotal / promotionTotal : 0;
      const promotionDistributorUnitPrice =
        promotionDistributorTotal > 0 && promotionShare > 0
          ? (promotionDistributorTotal * promotionShare) /
            Math.max(1, Number(quantity || 0))
          : 0;
      if (promotionKey && !promotionData) {
        throw new Error("Promocion no encontrada para aplicar precio B2B.");
      }

      if (!promotionKey) {
        throw new Error("Promocion requerida para venta promocional.");
      }

      let distributorPrice = salePrice;
      if (isDistributorSale) {
        if (promotionDistributorUnitPrice <= 0) {
          throw new Error(
            "Promocion sin precio B2B valido para calcular la comision.",
          );
        }
        distributorPrice = promotionDistributorUnitPrice;
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
        discountShare,
        actualPayment,
        additionalShare,
        costBasis,
        distributorPrice,
        distributorProfit,
        adminProfit,
        totalProfit,
        adminNetProfit,
        isPromotion: true,
        promotionId: promotionId || null,
        distributorProfitPercentage: effectiveDistributorProfitPercentage,
        commissionBonus: distributorCommissionBonus,
        commissionBonusAmount: isDistributorSale
          ? (salePrice * quantity * distributorCommissionBonus) / 100
          : 0,
      });
    }

    // 3. PHASE 2: All validations passed, now make the changes
    const results = [];
    const creditItems = [];
    let totalTransactionAmount = 0;
    let netTransactionProfit = 0;

    for (const item of validatedItems) {
      const {
        productId,
        product,
        quantity,
        salePrice,
        discountShare,
        actualPayment,
        additionalShare,
        costBasis,
        distributorPrice,
        distributorProfit,
        adminProfit,
        totalProfit,
        adminNetProfit,
        isPromotion,
        promotionId,
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

      const resolvedSourceLocation =
        sourceLocation === "distributor" && distributorId
          ? "distributor"
          : sourceLocation === "branch" && branchId
            ? "branch"
            : "warehouse";
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
        isPromotion,
        promotion: promotionId || undefined,
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
        shippingCost: 0,
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
        Boolean(distributorId) && sourceLocation === "distributor";
      const useBranchStock = sourceLocation === "branch" && Boolean(branchId);

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
          const adminMembership = await Membership.findOne({
            business: businessId,
            role: "admin",
            status: "active",
          })
            .select("user")
            .lean();

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
      netProfit: netTransactionProfit - (shippingCost || 0),
      adminProfit: results.reduce((sum, r) => sum + r.adminProfit, 0),
    };
  }
}
