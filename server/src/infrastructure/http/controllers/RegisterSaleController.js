import mongoose from "mongoose";
import { RegisterSaleUseCase } from "../../../application/use-cases/RegisterSaleUseCase.js";

/**
 * Register Sale Controller
 * Entry point for the Sales Registration (Hexagonal Adapter)
 */
export const registerSale = async (req, res, next) => {
  let session = null;
  try {
    // 1. Transaction Management (Infrastructure)
    session = await mongoose.startSession();
    session.startTransaction();

    // 2. Extract Data (Adapter)
    const input = {
      user: req.user,
      businessId: req.headers["x-business-id"], // Assumed from middleware
      distributorId: req.user.id, // Assuming auth middleware sets this
      items: req.body.items, // Bulk Items Array
      ...req.body, // Fallback for header fields
    };

    // 3. Invoke Application Use Case
    const useCase = new RegisterSaleUseCase();
    const result = await useCase.execute(input, session);

    // 4. Commit Transaction
    await session.commitTransaction();

    // 5. Send Response
    res.status(201).json({
      success: true,
      data: result,
      message: "Sale registered successfully (v2 hex)",
    });
  } catch (error) {
    // 6. Rollback on Error
    if (session) {
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
