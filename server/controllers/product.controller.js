import { deleteImage, isCloudinaryConfigured } from "../config/cloudinary.js";
import { invalidateCache } from "../middleware/cache.middleware.js";
import Product from "../models/Product.js";
import AuditService from "../services/audit.service.js";
import {
  getDistributorCommissionInfo,
  getDistributorProfitPercentage,
} from "../utils/distributorPricing.js";

const resolveBusinessId = (req) =>
  req.businessId ||
  req.headers["x-business-id"] ||
  req.query.businessId ||
  req.body.businessId;

// @desc    Obtener todos los productos
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const { category, featured, page = 1, limit = 20 } = req.query;
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    let filter = { business: businessId };

    if (category) filter.category = category;
    if (featured) filter.featured = featured === "true";

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener un producto por ID
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      business: businessId,
    })
      .populate("category", "name slug")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Crear nuevo producto
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const productData = { ...req.body, business: businessId };

    // Parsear arrays que vienen como JSON strings desde FormData
    if (typeof productData.ingredients === "string") {
      try {
        productData.ingredients = JSON.parse(productData.ingredients);
      } catch (e) {
        productData.ingredients = productData.ingredients
          .split(",")
          .map((i) => i.trim());
      }
    }
    if (typeof productData.benefits === "string") {
      try {
        productData.benefits = JSON.parse(productData.benefits);
      } catch (e) {
        productData.benefits = productData.benefits
          .split(",")
          .map((b) => b.trim());
      }
    }

    // Convertir valores numéricos y booleanos
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
    if (typeof productData.featured === "string")
      productData.featured = productData.featured === "true";

    // Manejar imagen de Cloudinary si se subió
    if (req.file) {
      if (!isCloudinaryConfigured) {
        console.warn("⚠️  Cloudinary no configurado, imagen no será subida");
        return res.status(503).json({
          message:
            "No se pudo subir la imagen porque Cloudinary no está configurado.",
          hint: "Define ENABLE_CLOUDINARY=true y CLOUDINARY_* en el backend.",
        });
      }

      productData.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    // Calcular precio sugerido si no se proporciona
    if (!productData.suggestedPrice && productData.purchasePrice) {
      productData.suggestedPrice = productData.purchasePrice * 1.3;
    }

    // Inicializar stocks
    if (productData.totalStock) {
      productData.warehouseStock = productData.totalStock;
    }

    const product = await Product.create(productData);
    const populatedProduct = await Product.findById(product._id).populate(
      "category",
      "name slug"
    );

    // Invalidar caché de productos
    await invalidateCache("cache:products:*");
    await invalidateCache("cache:businessAssistant:*");

    await AuditService.log({
      user: req.user,
      action: "product_created",
      module: "products",
      description: `Producto "${product.name}" creado`,
      entityType: "Product",
      entityId: product._id,
      entityName: product.name,
      newValues: product,
      business: businessId,
      req,
    });

    res.status(201).json(populatedProduct);
  } catch (error) {
    console.error("❌ Error al crear producto:", error);

    // Si es error de validación de Mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: "Error de validación",
        errors,
      });
    }

    // Error genérico
    res.status(500).json({
      message: error.message || "Error al crear producto",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

// @desc    Actualizar producto
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Rechazar subida si Cloudinary no está configurado
    if (req.file && !isCloudinaryConfigured) {
      return res.status(503).json({
        message:
          "No se pudo subir la imagen porque Cloudinary no está configurado.",
        hint: "Define ENABLE_CLOUDINARY=true y CLOUDINARY_* en el backend.",
      });
    }

    // Si hay nueva imagen, eliminar la anterior de Cloudinary
    if (req.file && product.image?.publicId) {
      await deleteImage(product.image.publicId);
    }

    // Actualizar datos del producto
    const updateData = { ...req.body };
    updateData.business = businessId;

    // Parsear arrays que vienen como JSON strings desde FormData
    if (typeof updateData.ingredients === "string") {
      try {
        updateData.ingredients = JSON.parse(updateData.ingredients);
      } catch (e) {
        updateData.ingredients = updateData.ingredients
          .split(",")
          .map((i) => i.trim());
      }
    }
    if (typeof updateData.benefits === "string") {
      try {
        updateData.benefits = JSON.parse(updateData.benefits);
      } catch (e) {
        updateData.benefits = updateData.benefits
          .split(",")
          .map((b) => b.trim());
      }
    }

    // Convertir valores numéricos y booleanos
    if (updateData.purchasePrice)
      updateData.purchasePrice = Number(updateData.purchasePrice);
    if (updateData.suggestedPrice)
      updateData.suggestedPrice = Number(updateData.suggestedPrice);
    if (updateData.distributorPrice)
      updateData.distributorPrice = Number(updateData.distributorPrice);
    if (updateData.clientPrice)
      updateData.clientPrice = Number(updateData.clientPrice);
    if (updateData.distributorCommission)
      updateData.distributorCommission = Number(
        updateData.distributorCommission
      );
    if (updateData.totalStock)
      updateData.totalStock = Number(updateData.totalStock);
    if (updateData.warehouseStock)
      updateData.warehouseStock = Number(updateData.warehouseStock);
    if (updateData.lowStockAlert)
      updateData.lowStockAlert = Number(updateData.lowStockAlert);
    if (typeof updateData.featured === "string")
      updateData.featured = updateData.featured === "true";

    // Manejar nueva imagen de Cloudinary si se subió
    if (req.file) {
      updateData.image = {
        url: req.file.path,
        publicId: req.file.filename,
      };
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: req.params.id, business: businessId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name slug");

    // Invalidar caché de productos
    await invalidateCache("cache:products:*");
    await invalidateCache("cache:product:*");
    await invalidateCache("cache:businessAssistant:*");

    await AuditService.log({
      user: req.user,
      action: "product_updated",
      module: "products",
      description: `Producto "${product.name}" actualizado`,
      entityType: "Product",
      entityId: product._id,
      entityName: product.name,
      newValues: updatedProduct,
      oldValues: product,
      business: businessId,
      req,
    });

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Eliminar producto
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      business: businessId,
    });

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Eliminar imagen de Cloudinary si existe
    if (product.image?.publicId) {
      await deleteImage(product.image.publicId);
    }

    await product.deleteOne();

    // Invalidar caché de productos
    await invalidateCache("cache:products:*");
    await invalidateCache("cache:product:*");
    await invalidateCache("cache:businessAssistant:*");

    await AuditService.log({
      user: req.user,
      action: "product_deleted",
      module: "products",
      description: `Producto "${product.name}" eliminado`,
      entityType: "Product",
      entityId: product._id,
      entityName: product.name,
      oldValues: product,
      business: businessId,
      req,
    });

    res.json({ message: "Producto eliminado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener precio de distribuidor ajustado por ranking
// @route   GET /api/products/:id/distributor-price/:distributorId
// @access  Private
export const getDistributorPrice = async (req, res) => {
  try {
    const { id, distributorId } = req.params;
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const product = await Product.findOne({ _id: id, business: businessId });
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const commissionInfo = await getDistributorCommissionInfo(
      distributorId,
      businessId
    );
    const profitPercentage = await getDistributorProfitPercentage(
      distributorId,
      businessId
    );
    const position = commissionInfo.position;

    res.json({
      productId: product._id,
      productName: product.name,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice, // Precio fijo que paga al admin
      profitPercentage, // 25%, 23%, 21%, o 20% según ranking
      rankingPosition: position || 4,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDistributorCatalog = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    console.log("📦 getDistributorCatalog llamado");
    console.log("Usuario autenticado:", req.user);

    // Obtener el ID del distribuidor autenticado
    const distributorId = req.user.userId || req.user.id;
    console.log("Distribuidor ID:", distributorId);

    // Verificar que el usuario sea distribuidor
    if (req.user.role !== "distribuidor") {
      console.log("❌ Acceso denegado: rol", req.user.role);
      return res.status(403).json({
        message: "Solo los distribuidores pueden acceder a su catálogo",
      });
    }

    // Buscar productos que tiene en stock el distribuidor
    const DistributorStock = (await import("../models/DistributorStock.js"))
      .default;
    const distributorStocks = await DistributorStock.find({
      distributor: distributorId,
      business: businessId,
      quantity: { $gt: 0 }, // Solo productos con stock disponible
    }).populate({
      path: "product",
      populate: { path: "category" },
    });

    console.log(
      `✅ Encontrados ${distributorStocks.length} productos en stock`
    );

    // Extraer los productos y agregar la cantidad disponible del distribuidor
    // Filtrar productos nulos (por si fueron eliminados)
    const products = distributorStocks
      .filter((stock) => stock.product) // Solo incluir si el producto existe
      .map((stock) => {
        const product = stock.product.toObject();
        return {
          ...product,
          distributorStock: stock.quantity,
        };
      });

    console.log(`📤 Enviando ${products.length} productos al frontend`);

    // Deshabilitar caché para este endpoint
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json(products);
  } catch (error) {
    console.error("❌ Error en getDistributorCatalog:", error);
    res.status(500).json({ message: error.message });
  }
};
