import mongoose from "mongoose";
import { RegisterPromotionSaleUseCase } from "../../../application/use-cases/sales/RegisterPromotionSaleUseCase.js";
import { RegisterStandardSaleUseCase } from "../../../application/use-cases/sales/RegisterStandardSaleUseCase.js";

/**
 * Register Sale Controller
 * Entry point for the Sales Registration (Hexagonal Adapter)
 */
const buildSaleInput = (req, employeeId) => ({
  user: req.user,
  businessId:
    req.businessId ||
    req.business?._id?.toString?.() ||
    req.headers["x-business-id"],
  employeeId,
  locationType: req.body.locationType || req.body.sourceLocation,
  branchId: req.body.branchId || req.body.branch,
  items: req.body.items,
  paymentMethodId: req.body.paymentMethodId,
  customerId: req.body.customerId,
  creditDueDate: req.body.creditDueDate,
  initialPayment: req.body.initialPayment,
  paymentProof: req.body.paymentProof,
  paymentProofMimeType: req.body.paymentProofMimeType,
  saleDate: req.body.saleDate,
  deliveryMethodId: req.body.deliveryMethodId,
  shippingCost: req.body.shippingCost,
  discount: req.body.discount,
  additionalCosts: req.body.additionalCosts,
  warranties: req.body.warranties,
  notes: req.body.notes,
  employeeProfitPercentage: req.body.employeeProfitPercentage,
});

const resolveEmployeeId = (req) => {
  const userId = req.user?.id || req.user?._id;
  const membershipRole = req.membership?.role;

  if (req.user?.role === "employee" || membershipRole === "employee") {
    return userId;
  }

  if (req.body.employeeId) {
    return req.body.employeeId;
  }

  return null;
};

const runRegisterSale = async (req, res, next, UseCaseClass) => {
  let session = null;
  let useTransactions = false;

  try {
    // 1. Transaction Management (Infrastructure)
    // Check if we can use transactions (only works with replica sets)
    try {
      const client = mongoose.connection.getClient();
      const admin = client.db().admin();
      const result = await admin.command({ isMaster: 1 });
      useTransactions = result.setName !== undefined; // If setName exists, it's a replica set
    } catch (err) {
      // If check fails, assume we can't use transactions
      useTransactions = false;
    }

    if (!useTransactions) {
      return res.status(503).json({
        success: false,
        message:
          "MongoDB transactions are required for sales operations. Configure the database as replica set.",
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // 2. Extract Data (Adapter)
    // Determine employeeId based on user role:
    // - If user is employee: use their ID
    // - If user is admin: only set employeeId if explicitly provided in body
    const employeeId = resolveEmployeeId(req);
    const input = buildSaleInput(req, employeeId);

    // 3. Invoke Application Use Case
    const useCase = new UseCaseClass();
    const result = await useCase.execute(input, session);

    // 4. Commit Transaction
    if (useTransactions && session) {
      await session.commitTransaction();
    }

    // 5. Send Response
    res.status(201).json({
      success: true,
      data: result,
      message: "Sale registered successfully (v2 hex)",
    });
  } catch (error) {
    // 6. Rollback on Error
    if (useTransactions && session) {
      await session.abortTransaction();
    }
    next(error); // Pass to global error handler
  } finally {
    // 7. End Session
    if (session) {
      session.endSession();
    }
  }
};

export const registerSale = async (req, res, next) =>
  runRegisterSale(req, res, next, RegisterStandardSaleUseCase);

export const registerStandardSale = async (req, res, next) =>
  runRegisterSale(req, res, next, RegisterStandardSaleUseCase);

export const registerPromotionSale = async (req, res, next) =>
  runRegisterSale(req, res, next, RegisterPromotionSaleUseCase);
