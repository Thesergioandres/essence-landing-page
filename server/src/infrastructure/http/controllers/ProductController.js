import mongoose from "mongoose";
import { CreateProductUseCase } from "../../../application/use-cases/CreateProductUseCase.js";
import { UpdateStockUseCase } from "../../../application/use-cases/UpdateStockUseCase.js";
import { ProductRepository } from "../../database/repositories/ProductRepository.js";

const productRepository = new ProductRepository();

/**
 * Get All Products for Business
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const businessId = req.headers["x-business-id"] || req.businessId;
    if (!businessId) {
      return res.status(400).json({ message: "Business ID required" });
    }

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.active !== undefined)
      filter.isActive = req.query.active === "true";

    const products = await productRepository.findAll(businessId, filter);
    res.json({ products });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Product by ID
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productRepository.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
};

/**
 * Create Product (Transactional)
 */
export const createProduct = async (req, res, next) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const useCase = new CreateProductUseCase();
    const productData = {
      ...req.body,
      business: req.headers["x-business-id"], // Ensure business context
      createdBy: req.user.id,
    };

    const product = await useCase.execute(productData, session);

    await session.commitTransaction();
    res.status(201).json(product);
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};

/**
 * Update Stock (Transactional)
 */
export const updateStock = async (req, res, next) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { id } = req.params;
    const { quantityChange } = req.body; // e.g., -5 or +10
    const businessId = req.headers["x-business-id"];

    const useCase = new UpdateStockUseCase();
    const updatedProduct = await useCase.execute(
      {
        productId: id,
        quantityChange,
        businessId,
      },
      session,
    );

    await session.commitTransaction();
    res.json(updatedProduct);
  } catch (error) {
    if (session) await session.abortTransaction();
    next(error);
  } finally {
    if (session) session.endSession();
  }
};
