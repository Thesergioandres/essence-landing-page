import jwt from "jsonwebtoken";
import { deleteImage, isCloudinaryConfigured } from "../config/cloudinary.js";
import { invalidateCache } from "../middleware/cache.middleware.js";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js";
import User from "../models/User.js";
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
    const {
      category,
      featured,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
      minPrice,
      maxPrice,
      inStock,
      search,
      excludePromotions,
    } = req.query;
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    let filter = { business: businessId };

    if (category) filter.category = category;
    if (featured) filter.featured = featured === "true";

    // Filtro de stock
    if (inStock === "true") {
      filter.totalStock = { $gt: 0 };
    } else if (inStock === "false") {
      filter.totalStock = { $lte: 0 };
    }

    // Filtro de precio
    if (minPrice || maxPrice) {
      filter.clientPrice = {};
      if (minPrice) filter.clientPrice.$gte = Number(minPrice);
      if (maxPrice) filter.clientPrice.$lte = Number(maxPrice);
    }

    // Búsqueda por nombre
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Configurar ordenamiento
    const validSortFields = [
      "createdAt",
      "name",
      "clientPrice",
      "purchasePrice",
      "totalStock",
      "warehouseStock",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortConfig = { [sortField]: sortDirection };

    // Obtener promociones activas para el catálogo (solo si estamos en la primera página y no hay búsqueda específica que las excluya)
    // Si el usuario pidió un filtro específico de categoría que no sea "Promociones", quizás no deberíamos mostrarlas,
    // pero por ahora seguimos la instrucción de unificar.
    let promotionFilter = {
      business: businessId,
      status: "active",
      showInCatalog: true,
    };

    // Si estamos filtrando por nombre, aplicar también a promociones
    if (search) {
      promotionFilter.name = { $regex: search, $options: "i" };
    }

    // Seguridad: Ocultar purchasePrice si no es Admin/God
    const token = req.headers.authorization?.split(" ")[1];
    let isAdmin = false;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Verificar rol en BD para mayor seguridad (o confiar en token claims si están actualizados)
        // Por rendimiento, podemos confiar en el token o hacer una consulta ligera si es crítico.
        // Aquí haremos la consulta segura.
        const user = await User.findById(decoded.id || decoded.userId).select(
          "role",
        );
        if (user && ["admin", "super_admin", "god"].includes(user.role)) {
          isAdmin = true;
        }
      } catch (error) {
        // Token inválido o expirado, tratar como público
      }
    }

    let query = Product.find(filter)
      .populate("category", "name slug")
      .sort(sortConfig);

    if (!isAdmin) {
      query = query.select(
        "-purchasePrice -averageCost -supplier -supplierInfo -supplierId",
      );
    }

    // Ejecutar consultas en paralelo
    const [products, total, promotions] = await Promise.all([
      query.skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
      // Solo cargar promociones en la primera página para evitar duplicados en scroll infinito
      // Y si NO se solicitó excluirlas explícitamente y no estamos filtrando por nombre (búsqueda suele incluir promos)
      pageNum === 1 && excludePromotions !== "true"
        ? Promotion.find(promotionFilter)
            .populate(
              "comboItems.product",
              "name image warehouseStock totalStock purchasePrice averageCost",
            )
            .lean()
        : Promise.resolve([]),
    ]);

    // Normalizar promociones para que parezcan productos
    // Calcular stock virtual y costo basado en componentes
    const normalizedPromotions = promotions.map((p) => {
      // Calcular stock virtual: mínimo de (stock componente / cantidad requerida)
      let virtualStock = Infinity;
      let virtualCost = 0;

      if (p.comboItems && p.comboItems.length > 0) {
        for (const item of p.comboItems) {
          const product = item.product;
          if (product && typeof product === "object") {
            // Stock del componente (usar warehouseStock o totalStock)
            const componentStock =
              product.warehouseStock ?? product.totalStock ?? 0;
            const requiredQty = item.quantity || 1;

            // Cuántos combos podemos hacer con este componente
            const possibleCombos = Math.floor(componentStock / requiredQty);
            virtualStock = Math.min(virtualStock, possibleCombos);

            // Costo del componente
            const componentCost =
              product.purchasePrice ?? product.averageCost ?? 0;
            virtualCost += componentCost * requiredQty;
          }
        }
      }

      // Si no hay items o son inválidos, usar 0
      if (virtualStock === Infinity) virtualStock = 0;

      // Si no es admin, ocultar costos en promociones también
      const promoObj = {
        _id: p._id,
        name: p.name,
        clientPrice: p.promotionPrice,
        distributorPrice: p.distributorPrice,
        image: p.image,
        category: { _id: "promo", name: "Promoción" },
        totalStock: virtualStock,
        warehouseStock: virtualStock,
        type: "bundle",
        description: p.description,
        isPromotion: true,
        originalPrice: p.originalPrice,
        comboItems: p.comboItems,
      };

      if (isAdmin) {
        promoObj.purchasePrice = virtualCost;
        promoObj.averageCost = virtualCost;
      }

      return promoObj;
    });

    // Fusión: Promociones primero, luego productos
    const combinedData = [...normalizedPromotions, ...products];

    res.json({
      data: combinedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total + (pageNum === 1 ? promotions.length : 0), // Ajustar total aproximado
        pages: Math.ceil((total + promotions.length) / limitNum),
        hasMore: pageNum < Math.ceil((total + promotions.length) / limitNum),
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

    // Seguridad: Verificar si es Admin para mostrar costos
    const token = req.headers.authorization?.split(" ")[1];
    let isAdmin = false;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id || decoded.userId).select(
          "role",
        );
        if (user && ["admin", "super_admin", "god"].includes(user.role)) {
          isAdmin = true;
        }
      } catch (error) {
        // Token inválido, asumir público
      }
    }

    let query = Product.findOne({
      _id: req.params.id,
      business: businessId,
    }).populate("category", "name slug");

    if (!isAdmin) {
      query = query.select(
        "-purchasePrice -averageCost -supplier -supplierInfo -supplierId",
      );
    }

    const product = await query.lean();

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
      if (isCloudinaryConfigured) {
        productData.image = {
          url: req.file.path,
          publicId: req.file.filename,
        };
      } else {
        // Usar Base64 si Cloudinary no está configurado
        console.log(
          "💾 Guardando imagen como Base64 (Cloudinary deshabilitado)",
        );
        const base64Image = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        productData.image = {
          url: base64Image,
          publicId: `local_${Date.now()}`,
        };
      }
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
      "name slug",
    );

    // -------------------------------------------------------------------------
    // REQ 2: DEFAULT STOCK LOGIC (Fail-Safe)
    // -------------------------------------------------------------------------
    // "Whenever a new Product is created, the system MUST automatically initialize
    // its stock record in the Main Branch (Bodega Principal)"
    try {
      const mainWarehouse = await Branch.findOne({
        business: businessId,
        isWarehouse: true,
      });

      if (mainWarehouse) {
        // Init with 0 or the warehouseStock if provided
        // Note: productData.warehouseStock was set from totalStock above if available
        const initialQty = productData.warehouseStock || 0;

        await BranchStock.create({
          business: businessId,
          branch: mainWarehouse._id,
          product: product._id,
          quantity: initialQty,
          lowStockAlert: product.lowStockAlert || 10,
        });

        console.log(
          `✅ Stock inicializado en Bodega Principal (${mainWarehouse.name}) para ${product.name}: ${initialQty}`,
        );
      } else {
        console.warn(
          "⚠️ No se encontró Bodega Principal para inicializar stock.",
        );
      }
    } catch (stockError) {
      console.error(
        "❌ Error al inicializar stock automático en Bodega:",
        stockError,
      );
      // Non-blocking error, product is created anyway
    }
    // -------------------------------------------------------------------------

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

    // Actualizar datos del producto
    const updateData = { ...req.body };
    updateData.business = businessId;

    // Manejar imagen subida
    if (req.file) {
      // Si hay imagen anterior de Cloudinary, eliminarla
      if (
        product.image?.publicId &&
        isCloudinaryConfigured &&
        !product.image.publicId.startsWith("local_")
      ) {
        await deleteImage(product.image.publicId);
      }

      if (isCloudinaryConfigured) {
        updateData.image = {
          url: req.file.path,
          publicId: req.file.filename,
        };
      } else {
        // Usar Base64 si Cloudinary no está configurado
        console.log(
          "💾 Actualizando imagen como Base64 (Cloudinary deshabilitado)",
        );
        const base64Image = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        updateData.image = {
          url: base64Image,
          publicId: `local_${Date.now()}`,
        };
      }
    }

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
        updateData.distributorCommission,
      );
    if (updateData.totalStock)
      updateData.totalStock = Number(updateData.totalStock);
    if (updateData.warehouseStock)
      updateData.warehouseStock = Number(updateData.warehouseStock);
    if (updateData.lowStockAlert)
      updateData.lowStockAlert = Number(updateData.lowStockAlert);
    if (typeof updateData.featured === "string")
      updateData.featured = updateData.featured === "true";

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: req.params.id, business: businessId },
      updateData,
      {
        new: true,
        runValidators: true,
      },
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

    let product = await Product.findOne({ _id: id, business: businessId });
    let isPromotion = false;

    // FIX: If not found as Product, check if it's a Promotion (Virtual Product)

    // DEBUG: Verify Imports
    if (typeof getDistributorCommissionInfo !== "function") {
      console.error(
        "CRITICAL: getDistributorCommissionInfo is not a function. Check distributorPricing.js imports.",
      );
      throw new Error("Error interno: Función de comisiones no disponible");
    }

    if (!product) {
      // Usar modelo importado si está disponible, o fallback seguro
      const PromotionModel = Promotion || mongoose.model("Promotion");
      const promotion = await PromotionModel.findOne({
        _id: id,
        business: businessId,
      });

      if (promotion) {
        product = {
          _id: promotion._id,
          name: promotion.name,
          purchasePrice: promotion.originalPrice || 0, // Use original price as "cost" basis
          distributorPrice: promotion.distributorPrice,
          clientPrice: promotion.promotionPrice,
        };
        isPromotion = true;
      }
    }

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const commissionInfo = await getDistributorCommissionInfo(
      distributorId,
      businessId,
    );
    let profitPercentage = await getDistributorProfitPercentage(
      distributorId,
      businessId,
    );
    const position = commissionInfo.position;

    // Special handling for Promotions with fixed B2B price
    if (
      isPromotion &&
      product.distributorPrice !== undefined &&
      product.clientPrice > 0
    ) {
      // Calculate implied profit percentage based on fixed prices
      // ProfitPct = 100 * (1 - DistPrice / SalePrice)
      const ratio = product.distributorPrice / product.clientPrice;
      const calcPercentage = 100 * (1 - ratio);

      if (!isNaN(calcPercentage) && isFinite(calcPercentage)) {
        profitPercentage = Number(calcPercentage.toFixed(2));
      } else {
        console.warn(
          `⚠️ Cálculo de profit inválido para producto ${product._id}: DP=${product.distributorPrice}, CP=${product.clientPrice}`,
        );
      }
    }

    res.json({
      productId: product._id,
      productName: product.name,
      purchasePrice: product.purchasePrice || 0,
      distributorPrice: product.distributorPrice || 0, // Precio fijo que paga al admin
      profitPercentage, // 25%, 23%, 21%, o 20% según ranking
      rankingPosition: position || 4,
    });
  } catch (error) {
    console.error("❌ Error CRÍTICO en getDistributorPrice:", error);
    console.error("Stack:", error.stack);
    // Enviar respuesta de error explícita
    res.status(500).json({
      message: "Error interno calculando precio de distribuidor",
      error: error.message,
      // No enviar stack en producción, pero útil aquí
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    [LEGACY] Obtener catálogo de distribuidor
// @route   GET /api/products/my-catalog
// @access  Private/Distributor
export const getDistributorCatalogLegacy = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";
    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // ... Legacy implementation
    // Obtener el ID del distribuidor autenticado
    const distributorId = req.user.userId || req.user.id;

    // Verificar que el usuario sea distribuidor
    if (req.user.role !== "distribuidor") {
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

    // Extraer los productos y agregar la cantidad disponible del distribuidor
    const products = distributorStocks
      .filter((stock) => stock.product) // Solo incluir si el producto existe
      .map((stock) => {
        const product = stock.product.toObject();
        return {
          ...product,
          distributorStock: stock.quantity,
        };
      });

    // Deshabilitar caché para este endpoint
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json(products);
  } catch (error) {
    console.error("❌ Error en getDistributorCatalogLegacy:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Inicializar costo promedio en productos existentes
// @route   POST /api/products/initialize-average-cost
// @access  Private/Admin
// @desc    [LEGACY] Inicializar costo promedio en productos
// @route   POST /api/products/initialize-average-cost
// @access  Private/Admin
export const initializeAverageCostLegacy = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Buscar productos sin averageCost inicializado o con valor 0
    const products = await Product.find({
      business: businessId,
      $or: [
        { averageCost: { $exists: false } },
        { averageCost: null },
        { averageCost: 0 },
      ],
    });

    let updatedCount = 0;
    const updates = [];

    for (const product of products) {
      // Inicializar averageCost con purchasePrice
      const averageCost = product.purchasePrice || 0;
      const totalStock = product.totalStock || 0;
      const totalInventoryValue = totalStock * averageCost;

      product.averageCost = averageCost;
      product.totalInventoryValue = totalInventoryValue;
      product.lastCostUpdate = new Date();
      product.costingMethod = product.costingMethod || "average";

      await product.save();
      updatedCount++;

      updates.push({
        _id: product._id,
        name: product.name,
        averageCost: averageCost,
      });
    }

    res.json({
      message: `Se inicializaron los costos promedio de ${updatedCount} productos`,
      updatedCount,
      updates,
    });
  } catch (error) {
    console.error("❌ Error inicializando costos promedio:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    [OPTIMIZED] Inicializar costo promedio en productos existentes (BulkWrite)
 * @route   POST /api/products/initialize-average-cost-optimized
 * @access  Private/Admin
 */
/**
 * @desc    [OPTIMIZED] Inicializar costo promedio (BulkWrite)
 * @route   POST /api/products/initialize-average-cost
 * @access  Private/Admin
 */
export const initializeAverageCost = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const products = await Product.find({
      business: businessId,
      $or: [
        { averageCost: { $exists: false } },
        { averageCost: null },
        { averageCost: 0 },
      ],
    })
      .select("_id purchasePrice totalStock costingMethod")
      .lean();

    if (products.length === 0) {
      return res.json({
        message: "No hay productos pendientes de inicialización",
        updatedCount: 0,
      });
    }

    const bulkOps = products.map((product) => {
      const averageCost = product.purchasePrice || 0;
      const totalStock = product.totalStock || 0;
      const totalInventoryValue = totalStock * averageCost;

      return {
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              averageCost: averageCost,
              totalInventoryValue: totalInventoryValue,
              lastCostUpdate: new Date(),
              costingMethod: product.costingMethod || "average",
            },
          },
        },
      };
    });

    const result = await Product.bulkWrite(bulkOps);

    res.json({
      message: `Se inicializaron costos de ${result.modifiedCount} productos (Optimizado)`,
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Error en initializeAverageCost:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    [OPTIMIZED] Obtener catálogo (Lean + No Hydration)
 * @route   GET /api/products/distributor-catalog-optimized
 * @access  Private/Distributor
 */
/**
 * @desc    [OPTIMIZED] Obtener catálogo (Lean + No Hydration)
 * @route   GET /api/products/my-catalog
 * @access  Private/Distributor
 */
export const getDistributorCatalog = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    const isTest = process.env.NODE_ENV === "test";

    if (!businessId && !isTest) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const { stockSource = "PERSONAL", branchId } = req.query;
    const distributorId = req.user?.userId || req.user?.id;

    console.log("[DEBUG] Catalog Query params:", {
      stockSource,
      branchId,
      distributorId,
    });

    let query = { quantity: { $gt: 0 }, business: businessId };
    let StockModel;

    if (stockSource === "BRANCH" && branchId) {
      // FIX 1: Explicitly set branch logic and clear distributor
      query.branch = branchId;
      delete query.distributor; // CRITICAL FIX requested by User
      delete query.business; // ☢️ NUCLEAR FIX: Trust Branch ID only, ignore business context

      StockModel = (await import("../models/BranchStock.js")).default;
    } else {
      // Default to Personal Stock
      query.distributor = distributorId;
      StockModel = (await import("../models/DistributorStock.js")).default;
    }

    console.log("[DEBUG] Final Mongoose Query:", query);

    const stocks = await StockModel.find(query)
      .populate({
        path: "product",
        populate: { path: "category" },
      })
      .lean();

    console.log(
      `[DEBUG] Stocks found: ${stocks.length} (Source: ${stockSource})`,
    );

    const availableProducts = stocks
      .filter((stock) => stock.product)
      .map((stock) => ({
        ...stock.product,
        distributorStock: stock.quantity,
      }));

    // MAPA DE STOCK PARA CÁLCULO DE PROMOCIONES
    const stockMap = new Map();
    availableProducts.forEach((p) => {
      if (p._id) {
        stockMap.set(p._id.toString(), p.distributorStock);
      }
    });

    // LÓGICA DE PROMOCIONES (STOCK VIRTUAL)
    const promotions = await Promotion.find({
      business: businessId,
      status: "active",
    })
      .populate("comboItems.product")
      .lean();

    const availablePromotions = [];

    for (const promo of promotions) {
      if (!promo.comboItems || promo.comboItems.length === 0) continue;

      let maxPossibleParams = [];

      for (const item of promo.comboItems) {
        if (!item.product) continue;

        // FIX 2: Safe ID Extraction (User Pattern)
        const rawProduct = item.product;
        const productId = rawProduct._id
          ? rawProduct._id.toString()
          : rawProduct.toString();

        const requiredQty = item.quantity || 1;
        const availableQty = stockMap.get(productId) || 0;

        maxPossibleParams.push(Math.floor(availableQty / requiredQty));
      }

      // El stock de la promoción es el mínimo de los máximos posibles de sus ingredientes
      const virtualStock =
        maxPossibleParams.length > 0 ? Math.min(...maxPossibleParams) : 0;

      if (virtualStock > 0) {
        availablePromotions.push({
          _id: promo._id,
          name: `📦 ${promo.name}`,
          clientPrice: promo.promotionPrice,
          distributorPrice: promo.distributorPrice,
          image: promo.image,
          category: { _id: "promo", name: "Promoción" },
          business: promo.business,
          type: "bundle",
          description: promo.description,
          distributorStock: virtualStock, // Stock virtual calculado
          isPromotion: true,
          originalPrice: promo.originalPrice,
          comboItems: promo.comboItems,
        });
      }
    }

    // Unificar productos y promociones
    const catalog = [...availablePromotions, ...availableProducts];

    // Limpieza de campos sensibles (Security)
    const sanitizedCatalog = catalog.map((item) => {
      // eslint-disable-next-line no-unused-vars
      const {
        purchasePrice,
        averageCost,
        supplier,
        supplierInfo,
        supplierId,
        ...rest
      } = item;
      return rest;
    });

    res.json(sanitizedCatalog);
  } catch (error) {
    console.error("❌ Error en getDistributorCatalog:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener inventario global (God Mode)
// @route   GET /api/products/global-inventory
// @access  Private/Admin/God
export const getGlobalInventory = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    // 1. Fetch ALL Products
    const products = await Product.find({ business: businessId })
      .select("name totalStock warehouseStock image category")
      .populate("category", "name")
      .lean();

    // 2. Fetch ALL Branch Stocks
    const branchStocks = await BranchStock.find({ business: businessId })
      .populate("branch", "name type isWarehouse")
      .lean();

    // 3. Fetch ALL Distributor Stocks
    const distributorStocks = await DistributorStock.find({
      business: businessId,
      quantity: { $gt: 0 },
    })
      .populate("distributor", "name email")
      .lean();

    // 4. Aggregation Map
    const inventoryMap = {};

    // Initialize with Products
    products.forEach((p) => {
      inventoryMap[p._id] = {
        _id: p._id,
        name: p.name,
        category: p.category?.name || "Sin Categoría",
        image: p.image?.url,
        totalSystemStock: 0,
        warehouseStock: p.warehouseStock || 0,
        branches: [],
        distributors: [],
      };
    });

    // Process Branch Stocks
    branchStocks.forEach((bs) => {
      if (inventoryMap[bs.product]) {
        inventoryMap[bs.product].branches.push({
          branchId: bs.branch._id,
          branchName: bs.branch.name,
          quantity: bs.quantity,
          isWarehouse: bs.branch.isWarehouse,
        });
      }
    });

    // Process Distributor Stocks
    distributorStocks.forEach((ds) => {
      if (inventoryMap[ds.product]) {
        inventoryMap[ds.product].distributors.push({
          distributorId: ds.distributor._id,
          distributorName: ds.distributor.name,
          quantity: ds.quantity,
        });
      }
    });

    // Calculate Totals per Product
    const globalInventory = Object.values(inventoryMap).map((item) => {
      const branchTotal = item.branches.reduce((acc, b) => acc + b.quantity, 0);
      const distributorTotal = item.distributors.reduce(
        (acc, d) => acc + d.quantity,
        0,
      );

      const warehouseEntry = item.branches.find((b) => b.isWarehouse);
      let warehouseQty = warehouseEntry ? warehouseEntry.quantity : 0;

      if (!warehouseEntry && item.warehouseStock > 0) {
        warehouseQty = item.warehouseStock;
      }

      const totalSystemStock = branchTotal + distributorTotal;

      return {
        ...item,
        warehouseStock: warehouseQty,
        totalSystemStock,
        branches: item.branches.filter((b) => !b.isWarehouse),
      };
    });

    res.json(globalInventory);
  } catch (error) {
    console.error("❌ Error en getGlobalInventory:", error);
    res.status(500).json({ message: error.message });
  }
};
