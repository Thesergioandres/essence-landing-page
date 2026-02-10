import mongoose from "mongoose";
import { isCloudinaryConfigured } from "../../../../config/cloudinary.js";
import DistributorStock from "../../../../models/DistributorStock.js";
import InventoryEntry from "../../../../models/InventoryEntry.js";
import { CreateProductUseCase } from "../../../application/use-cases/CreateProductUseCase.js";
import { UpdateStockUseCase } from "../../../application/use-cases/UpdateStockUseCase.js";
import { ProductRepository } from "../../database/repositories/ProductRepository.js";

const productRepository = new ProductRepository();

/**
 * Get All Products for Business
 */
export const getAllProducts = async (req, res, next) => {
  try {
    console.log("📦 GET /products - Headers:", req.headers["x-business-id"]);
    console.log("📦 GET /products - businessId:", req.businessId);
    console.log("📦 GET /products - user:", req.user?.id);

    const businessId = req.headers["x-business-id"] || req.businessId;
    if (!businessId) {
      console.log("❌ Business ID missing");
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.active !== undefined)
      filter.isActive = req.query.active === "true";

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    console.log("📦 Fetching products for business:", businessId);
    let products = await productRepository.findAll(businessId, filter);
    console.log("✅ Found products:", products.length);

    // 🛡️ FIX TASK 3: DATA PRIVACY - Hide cost fields from distributors
    // Check if user is distributor (not admin)
    const isDistributor = req.user?.role === "distribuidor";
    if (isDistributor) {
      // Remove sensitive cost fields from response
      products = products.map((product) => {
        const {
          purchasePrice,
          averageCost,
          supplierPrice,
          totalInventoryValue,
          ...safeProduct
        } = product;
        return safeProduct;
      });
      console.log("🛡️ Sensitive cost fields excluded for distributor");
    }

    const total = products.length;

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error("❌ Error in getAllProducts:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "Error al obtener productos",
    });
  }
};

/**
 * Get Public Catalog (no auth)
 */
export const getPublicCatalog = async (req, res) => {
  try {
    const businessId = req.query.businessId || req.headers["x-business-id"];
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.active !== undefined)
      filter.isActive = req.query.active === "true";

    const products = await productRepository.findAll(businessId, filter);
    const safeProducts = products.map((product) => {
      const {
        purchasePrice,
        averageCost,
        supplierPrice,
        totalInventoryValue,
        distributorPrice,
        distributorCommission,
        ...safeProduct
      } = product;
      return safeProduct;
    });

    res.json({
      success: true,
      data: safeProducts,
    });
  } catch (error) {
    console.error("Error in getPublicCatalog:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al obtener productos",
    });
  }
};

/**
 * Get Distributor Catalog (only products with stock > 0)
 */
export const getMyCatalog = async (req, res) => {
  try {
    if (req.user?.role !== "distribuidor") {
      return res.status(403).json({
        message: "Solo los distribuidores pueden acceder a su catálogo",
      });
    }

    const filter = {
      distributor: req.user.id,
      quantity: { $gt: 0 },
    };

    if (req.businessId) {
      filter.business = req.businessId;
    }

    const stockEntries = await DistributorStock.find(filter)
      .populate({
        path: "product",
        select:
          "name description purchasePrice distributorPrice clientPrice image category",
        populate: { path: "category", select: "name slug" },
      })
      .lean();

    const products = stockEntries
      .filter((entry) => entry.product)
      .map((entry) => ({
        ...entry.product,
        distributorStock: entry.quantity,
      }));

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Error al obtener el catálogo",
    });
  }
};

/**
 * Get Product by ID
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let product = await productRepository.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // 🛡️ FIX TASK 3: DATA PRIVACY - Hide cost fields from distributors
    const isDistributor = req.user?.role === "distribuidor";
    if (isDistributor) {
      const {
        purchasePrice,
        averageCost,
        supplierPrice,
        totalInventoryValue,
        ...safeProduct
      } = product;
      product = safeProduct;
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Product Inventory History
 */
export const getProductHistory = async (req, res) => {
  try {
    const businessId = req.headers["x-business-id"] || req.businessId;
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    const { id } = req.params;
    const entries = await InventoryEntry.find({
      business: businessId,
      product: id,
      deleted: { $ne: true },
    })
      .select(
        "createdAt provider type quantity unitCost totalCost averageCostAfter notes purchaseGroupId requestId",
      )
      .populate({ path: "provider", select: "name" })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error("❌ Error in getProductHistory:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al obtener el historial del producto",
    });
  }
};

/**
 * Create Product (Transactional)
 */
export const createProduct = async (req, res, next) => {
  try {
    console.log("🆕 POST /products - Creating product");
    console.log("📦 Business ID:", req.headers["x-business-id"]);
    console.log("👤 User ID:", req.user?.id);
    console.log("📋 Body:", JSON.stringify(req.body, null, 2));
    console.log("📁 File:", req.file ? "present" : "missing");

    // Process FormData - parse JSON arrays if they come as strings
    const productData = {
      ...req.body,
      business: req.headers["x-business-id"],
      createdBy: req.user.id,
    };

    // Parse numbers
    if (productData.purchasePrice)
      productData.purchasePrice = Number(productData.purchasePrice);
    if (productData.suggestedPrice)
      productData.suggestedPrice = Number(productData.suggestedPrice);
    if (productData.distributorPrice)
      productData.distributorPrice = Number(productData.distributorPrice);
    if (productData.clientPrice)
      productData.clientPrice = Number(productData.clientPrice);
    if (productData.totalStock)
      productData.totalStock = Number(productData.totalStock);
    if (productData.lowStockAlert)
      productData.lowStockAlert = Number(productData.lowStockAlert);

    // 📦 STOCK INICIAL: Asignar el stock inicial directamente a bodega central
    if (productData.totalStock) {
      productData.warehouseStock = productData.totalStock;
      console.log(
        `📦 Stock inicial asignado a bodega central: ${productData.warehouseStock} unidades`,
      );
    }

    // Parse booleans
    if (productData.featured === "true") productData.featured = true;
    if (productData.featured === "false") productData.featured = false;

    // Parse arrays
    if (typeof productData.ingredients === "string") {
      try {
        productData.ingredients = JSON.parse(productData.ingredients);
      } catch (e) {
        productData.ingredients = productData.ingredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (typeof productData.benefits === "string") {
      try {
        productData.benefits = JSON.parse(productData.benefits);
      } catch (e) {
        productData.benefits = productData.benefits
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // Handle image upload
    if (req.file) {
      if (isCloudinaryConfigured) {
        // Cloudinary ya procesó la imagen mediante CloudinaryStorage
        productData.image = {
          url: req.file.path, // Cloudinary URL
          publicId: req.file.filename, // Cloudinary public ID
        };
        console.log("☁️ Image uploaded to Cloudinary:", req.file.path);
      } else {
        // Fallback a Base64 si Cloudinary no está configurado
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        productData.image = {
          url: base64Image,
          publicId: `product_${Date.now()}`,
        };
        console.log("💾 Image stored as Base64 (Cloudinary disabled)");
      }
    }

    console.log("📤 Executing CreateProductUseCase...");
    console.log("📦 Processed data:", JSON.stringify(productData, null, 2));

    const useCase = new CreateProductUseCase();
    // Para desarrollo local sin replica set, ejecutar sin sesión/transacción
    const product = await useCase.execute(productData, null);
    console.log("✅ Product created:", product._id);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("❌ Error in createProduct:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "Error al crear producto",
    });
  }
};

/**
 * Update Product
 */
export const updateProduct = async (req, res, next) => {
  try {
    console.log("🔄 PUT /products/:id - Updating product");
    console.log("📦 Product ID:", req.params.id);
    console.log("📦 Business ID:", req.headers["x-business-id"]);
    console.log("📋 Body:", JSON.stringify(req.body, null, 2));
    console.log("📁 File:", req.file ? "present" : "missing");

    const { id } = req.params;
    const businessId = req.headers["x-business-id"];

    // Process FormData - parse JSON arrays if they come as strings
    const updateData = { ...req.body };

    // Parse numbers
    if (updateData.purchasePrice !== undefined)
      updateData.purchasePrice = Number(updateData.purchasePrice);
    if (updateData.suggestedPrice !== undefined)
      updateData.suggestedPrice = Number(updateData.suggestedPrice);
    if (updateData.distributorPrice !== undefined)
      updateData.distributorPrice = Number(updateData.distributorPrice);
    if (updateData.clientPrice !== undefined)
      updateData.clientPrice = Number(updateData.clientPrice);
    if (updateData.totalStock !== undefined)
      updateData.totalStock = Number(updateData.totalStock);
    if (updateData.warehouseStock !== undefined)
      updateData.warehouseStock = Number(updateData.warehouseStock);
    if (updateData.lowStockAlert !== undefined)
      updateData.lowStockAlert = Number(updateData.lowStockAlert);

    // Parse booleans
    if (updateData.featured === "true") updateData.featured = true;
    if (updateData.featured === "false") updateData.featured = false;

    // Parse arrays
    if (typeof updateData.ingredients === "string") {
      try {
        updateData.ingredients = JSON.parse(updateData.ingredients);
      } catch (e) {
        updateData.ingredients = updateData.ingredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (typeof updateData.benefits === "string") {
      try {
        updateData.benefits = JSON.parse(updateData.benefits);
      } catch (e) {
        updateData.benefits = updateData.benefits
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // Handle image upload
    if (req.file) {
      const isCloudinaryConfigured =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET;

      if (isCloudinaryConfigured) {
        updateData.image = {
          url: req.file.path,
          publicId: req.file.filename,
        };
        console.log("☁️ Image uploaded to Cloudinary:", req.file.path);
      } else {
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        updateData.image = {
          url: base64Image,
          publicId: `product_${Date.now()}`,
        };
        console.log("💾 Image stored as Base64 (Cloudinary disabled)");
      }
    }

    console.log("📤 Updating product in database...");

    const repository = new ProductRepository();
    const updatedProduct = await repository.updateWithManualStock(
      id,
      businessId,
      updateData,
      req.user?.id,
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      });
    }

    console.log("✅ Product updated:", updatedProduct._id);

    res.json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    console.error("❌ Error in updateProduct:", error);
    console.error("Stack:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "Error al actualizar producto",
    });
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

/**
 * Delete Product
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const businessId = req.headers["x-business-id"];

    console.log("🗑️ DELETE /products/:id - Deleting product");
    console.log("📦 Product ID:", id);
    console.log("📦 Business ID:", businessId);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    const deletedProduct = await productRepository.delete(id, businessId);
    console.log("✅ Product deleted:", deletedProduct.name);

    res.json({
      success: true,
      message: "Producto eliminado correctamente",
      data: deletedProduct,
    });
  } catch (error) {
    console.error("❌ Error in deleteProduct:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al eliminar producto",
    });
  }
};
