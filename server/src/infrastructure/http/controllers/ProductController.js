import mongoose from "mongoose";
import { isCloudinaryConfigured } from "../../../../config/cloudinary.js";
import { resolveFinancialPrivacyContext } from "../../../../utils/financialPrivacy.js";
import { CreateProductUseCase } from "../../../application/use-cases/CreateProductUseCase.js";
import { UpdateStockUseCase } from "../../../application/use-cases/UpdateStockUseCase.js";
import { ProductPersistenceUseCase } from "../../../application/use-cases/repository-gateways/ProductPersistenceUseCase.js";
import Business from "../../database/models/Business.js";
import EmployeeStock from "../../database/models/EmployeeStock.js";
import InventoryEntry from "../../database/models/InventoryEntry.js";
import {
  applyDynamicEmployeePricingToProduct,
  applyDynamicEmployeePricingToProducts,
  getBusinessBaseCommissionPercentage,
} from "../../services/productPricing.service.js";

const productRepository = new ProductPersistenceUseCase();

const sanitizeProductForFinancialPrivacy = (product = {}) => {
  const {
    purchasePrice,
    averageCost,
    supplierId,
    supplierPrice,
    totalInventoryValue,
    profit,
    ...safeProduct
  } = product;
  return safeProduct;
};

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
    const baseCommissionPercentage =
      await getBusinessBaseCommissionPercentage(businessId);
    let products = await productRepository.findAll(businessId, filter);
    products = applyDynamicEmployeePricingToProducts(
      products,
      baseCommissionPercentage,
    );
    console.log("✅ Found products:", products.length);

    const financialPrivacy = resolveFinancialPrivacyContext(req);
    if (financialPrivacy.hideFinancialData) {
      products = products.map((product) =>
        sanitizeProductForFinancialPrivacy(product),
      );
      console.log("🛡️ Sensitive cost fields excluded for employee");
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

    const [products, business] = await Promise.all([
      productRepository.findAll(businessId, filter),
      Business.findById(businessId).select("name logoUrl").lean(),
    ]);

    const safeProducts = products.map((product) => {
      const {
        purchasePrice,
        averageCost,
        supplierId,
        supplierPrice,
        totalInventoryValue,
        profit,
        employeePrice,
        employeeCommission,
        ...safeProduct
      } = product;
      return safeProduct;
    });

    res.json({
      success: true,
      data: safeProducts,
      business: business
        ? {
            _id: business._id,
            name: business.name,
            logoUrl: business.logoUrl || null,
          }
        : null,
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
 * Get Employee Catalog (only products with stock > 0)
 */
export const getMyCatalog = async (req, res) => {
  try {
    if (req.user?.role !== "employee") {
      return res.status(403).json({
        message: "Solo los employees pueden acceder a su catálogo",
      });
    }

    const businessHeader = Array.isArray(req.headers["x-business-id"])
      ? req.headers["x-business-id"][0]
      : req.headers["x-business-id"];

    const filter = {
      employee: req.user.id,
      quantity: { $gt: 0 },
    };

    if (req.businessId || businessHeader) {
      filter.business = req.businessId || businessHeader;
    }

    const stockEntries = await EmployeeStock.find(filter)
      .populate({
        path: "product",
        select:
          "name description employeePrice employeePriceManual employeePriceManualValue purchasePrice averageCost clientPrice image category",
        populate: { path: "category", select: "name slug" },
      })
      .lean();

    const baseCommissionPercentage = await getBusinessBaseCommissionPercentage(
      req.businessId || businessHeader,
    );

    const products = stockEntries
      .filter((entry) => entry.product)
      .map((entry) => ({
        ...sanitizeProductForFinancialPrivacy(
          applyDynamicEmployeePricingToProduct(
            entry.product || {},
            baseCommissionPercentage,
          ),
        ),
        employeeStock: entry.quantity,
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

    const businessId =
      req.businessId || req.headers["x-business-id"] || product.business;
    const baseCommissionPercentage =
      await getBusinessBaseCommissionPercentage(businessId);

    product = applyDynamicEmployeePricingToProduct(
      product,
      baseCommissionPercentage,
    );

    const financialPrivacy = resolveFinancialPrivacyContext(req);
    if (financialPrivacy.hideFinancialData) {
      product = sanitizeProductForFinancialPrivacy(product);
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
    const businessId = req.headers["x-business-id"] || req.businessId;
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    const productData = {
      ...req.body,
      business: businessId,
      createdBy: req.user.id,
    };

    // Parse numbers
    if (
      productData.purchasePrice !== undefined &&
      productData.purchasePrice !== ""
    )
      productData.purchasePrice = Number(productData.purchasePrice);
    if (
      productData.suggestedPrice !== undefined &&
      productData.suggestedPrice !== ""
    )
      productData.suggestedPrice = Number(productData.suggestedPrice);
    if (
      productData.employeePrice !== undefined &&
      productData.employeePrice !== ""
    )
      productData.employeePrice = Number(productData.employeePrice);
    if (productData.clientPrice !== undefined && productData.clientPrice !== "")
      productData.clientPrice = Number(productData.clientPrice);
    if (productData.totalStock !== undefined && productData.totalStock !== "")
      productData.totalStock = Number(productData.totalStock);
    if (
      productData.lowStockAlert !== undefined &&
      productData.lowStockAlert !== ""
    )
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
    if (productData.employeePriceManual === "true")
      productData.employeePriceManual = true;
    if (productData.employeePriceManual === "false")
      productData.employeePriceManual = false;

    const isEmployeePriceManual = Boolean(productData.employeePriceManual);
    if (isEmployeePriceManual) {
      if (
        !Number.isFinite(productData.employeePrice) ||
        productData.employeePrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Debes enviar un precio de empleado válido cuando el modo manual está activo",
        });
      }

      productData.employeePriceManualValue = productData.employeePrice;
    } else {
      productData.employeePrice = null;
      productData.employeePriceManualValue = null;
    }

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
    const baseCommissionPercentage = await getBusinessBaseCommissionPercentage(
      productData.business,
    );
    const productWithPricing = applyDynamicEmployeePricingToProduct(
      product,
      baseCommissionPercentage,
    );
    console.log("✅ Product created:", product._id);

    res.status(201).json({
      success: true,
      data: productWithPricing,
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
    const businessId = req.headers["x-business-id"] || req.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    // Process FormData - parse JSON arrays if they come as strings
    const updateData = { ...req.body };

    // Parse numbers
    if (updateData.purchasePrice !== undefined)
      updateData.purchasePrice = Number(updateData.purchasePrice);
    if (updateData.suggestedPrice !== undefined)
      updateData.suggestedPrice = Number(updateData.suggestedPrice);
    if (
      updateData.employeePrice !== undefined &&
      updateData.employeePrice !== ""
    )
      updateData.employeePrice = Number(updateData.employeePrice);
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
    if (updateData.employeePriceManual === "true")
      updateData.employeePriceManual = true;
    if (updateData.employeePriceManual === "false")
      updateData.employeePriceManual = false;

    const employeePriceProvided =
      updateData.employeePrice !== undefined &&
      updateData.employeePrice !== null &&
      String(updateData.employeePrice).trim() !== "";

    if (
      employeePriceProvided &&
      (!Number.isFinite(updateData.employeePrice) ||
        updateData.employeePrice < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "employeePrice debe ser un número válido mayor o igual a 0",
      });
    }

    if (updateData.employeePriceManual !== undefined) {
      if (updateData.employeePriceManual === true) {
        if (!employeePriceProvided) {
          return res.status(400).json({
            success: false,
            message:
              "Debes enviar employeePrice cuando el modo manual está activo",
          });
        }

        updateData.employeePriceManualValue = updateData.employeePrice;
      } else {
        updateData.employeePrice = null;
        updateData.employeePriceManualValue = null;
      }
    } else if (employeePriceProvided) {
      updateData.employeePriceManual = true;
      updateData.employeePriceManualValue = updateData.employeePrice;
    } else if (updateData.employeePrice === "") {
      delete updateData.employeePrice;
    }

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

    const repository = new ProductPersistenceUseCase();
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

    const baseCommissionPercentage =
      await getBusinessBaseCommissionPercentage(businessId);
    const productWithPricing = applyDynamicEmployeePricingToProduct(
      updatedProduct,
      baseCommissionPercentage,
    );

    console.log("✅ Product updated:", updatedProduct._id);

    res.json({
      success: true,
      data: productWithPricing,
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
 * Update Product Prices (Public + Wholesale)
 */
export const updateProductPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.headers["x-business-id"] || req.businessId;
    const { price, wholesalePrice } = req.body || {};

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: "Business ID required",
      });
    }

    const hasPrice = price !== undefined && price !== null;
    const hasWholesale =
      wholesalePrice !== undefined && wholesalePrice !== null;

    if (!hasPrice && !hasWholesale) {
      return res.status(400).json({
        success: false,
        message: "Debes enviar al menos price o wholesalePrice",
      });
    }

    const parsedPrice = hasPrice ? Number(price) : undefined;
    const parsedWholesale = hasWholesale ? Number(wholesalePrice) : undefined;

    if (hasPrice && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      return res.status(400).json({
        success: false,
        message: "price debe ser un número válido mayor o igual a 0",
      });
    }

    if (
      hasWholesale &&
      (!Number.isFinite(parsedWholesale) || parsedWholesale < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "wholesalePrice debe ser un número válido mayor o igual a 0",
      });
    }

    const updatedProduct = await productRepository.updatePrices(
      id,
      businessId,
      {
        clientPrice: parsedPrice,
        employeePrice: parsedWholesale,
      },
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Producto no encontrado",
      });
    }

    const baseCommissionPercentage =
      await getBusinessBaseCommissionPercentage(businessId);
    const productWithPricing = applyDynamicEmployeePricingToProduct(
      updatedProduct,
      baseCommissionPercentage,
    );

    return res.json({
      success: true,
      message: "Precios actualizados correctamente",
      data: productWithPricing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error al actualizar precios",
    });
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
