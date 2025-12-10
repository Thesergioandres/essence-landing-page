import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import { calculateDistributorPrice, getDistributorProfitPercentage } from "../utils/distributorPricing.js";
import { invalidateCache } from "../middleware/cache.middleware.js";
import { deleteImage } from "../config/cloudinary.js";

// @desc    Obtener todos los productos
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const { category, featured, page = 1, limit = 20 } = req.query;
    let filter = {};

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
      Product.countDocuments(filter)
    ]);

    res.json({
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum)
      }
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
    const product = await Product.findById(req.params.id)
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
    const productData = { ...req.body };
    
    // Parsear arrays que vienen como JSON strings desde FormData
    if (typeof productData.ingredients === 'string') {
      try {
        productData.ingredients = JSON.parse(productData.ingredients);
      } catch (e) {
        productData.ingredients = productData.ingredients.split(',').map(i => i.trim());
      }
    }
    if (typeof productData.benefits === 'string') {
      try {
        productData.benefits = JSON.parse(productData.benefits);
      } catch (e) {
        productData.benefits = productData.benefits.split(',').map(b => b.trim());
      }
    }
    
    // Convertir valores numéricos y booleanos
    if (productData.purchasePrice) productData.purchasePrice = Number(productData.purchasePrice);
    if (productData.suggestedPrice) productData.suggestedPrice = Number(productData.suggestedPrice);
    if (productData.distributorPrice) productData.distributorPrice = Number(productData.distributorPrice);
    if (productData.clientPrice) productData.clientPrice = Number(productData.clientPrice);
    if (productData.totalStock) productData.totalStock = Number(productData.totalStock);
    if (productData.lowStockAlert) productData.lowStockAlert = Number(productData.lowStockAlert);
    if (typeof productData.featured === 'string') productData.featured = productData.featured === 'true';
    
    // Manejar imagen de Cloudinary si se subió
    if (req.file) {
      // Verificar que Cloudinary esté configurado
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.warn('⚠️  Cloudinary no configurado, imagen no será subida');
      } else {
        productData.image = {
          url: req.file.path,
          publicId: req.file.filename
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
    const populatedProduct = await Product.findById(product._id).populate("category", "name slug");
    
    // Invalidar caché de productos
    await invalidateCache('cache:products:*');
    
    res.status(201).json(populatedProduct);
  } catch (error) {
    console.error('❌ Error al crear producto:', error);
    
    // Si es error de validación de Mongoose
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Error de validación',
        errors 
      });
    }
    
    // Error genérico
    res.status(500).json({ 
      message: error.message || 'Error al crear producto',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// @desc    Actualizar producto
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    // Si hay nueva imagen, eliminar la anterior de Cloudinary
    if (req.file && product.image?.publicId) {
      await deleteImage(product.image.publicId);
    }
    
    // Actualizar datos del producto
    const updateData = { ...req.body };
    
    // Parsear arrays que vienen como JSON strings desde FormData
    if (typeof updateData.ingredients === 'string') {
      try {
        updateData.ingredients = JSON.parse(updateData.ingredients);
      } catch (e) {
        updateData.ingredients = updateData.ingredients.split(',').map(i => i.trim());
      }
    }
    if (typeof updateData.benefits === 'string') {
      try {
        updateData.benefits = JSON.parse(updateData.benefits);
      } catch (e) {
        updateData.benefits = updateData.benefits.split(',').map(b => b.trim());
      }
    }
    
    // Convertir valores numéricos y booleanos
    if (updateData.purchasePrice) updateData.purchasePrice = Number(updateData.purchasePrice);
    if (updateData.suggestedPrice) updateData.suggestedPrice = Number(updateData.suggestedPrice);
    if (updateData.distributorPrice) updateData.distributorPrice = Number(updateData.distributorPrice);
    if (updateData.clientPrice) updateData.clientPrice = Number(updateData.clientPrice);
    if (updateData.distributorCommission) updateData.distributorCommission = Number(updateData.distributorCommission);
    if (updateData.totalStock) updateData.totalStock = Number(updateData.totalStock);
    if (updateData.warehouseStock) updateData.warehouseStock = Number(updateData.warehouseStock);
    if (updateData.lowStockAlert) updateData.lowStockAlert = Number(updateData.lowStockAlert);
    if (typeof updateData.featured === 'string') updateData.featured = updateData.featured === 'true';
    
    // Manejar nueva imagen de Cloudinary si se subió
    if (req.file) {
      updateData.image = {
        url: req.file.path,
        publicId: req.file.filename
      };
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name slug");

    // Invalidar caché de productos
    await invalidateCache('cache:products:*');
    await invalidateCache('cache:product:*');

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
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    // Eliminar imagen de Cloudinary si existe
    if (product.image?.publicId) {
      await deleteImage(product.image.publicId);
    }
    
    await product.deleteOne();

    // Invalidar caché de productos
    await invalidateCache('cache:products:*');
    await invalidateCache('cache:product:*');

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
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const profitPercentage = await getDistributorProfitPercentage(distributorId);
    const ranking = await Sale.aggregate([
      {
        $match: {
          distributor: { $exists: true, $ne: null },
          paymentStatus: "confirmado",
        },
      },
      {
        $group: {
          _id: "$distributor",
          totalRevenue: { $sum: { $multiply: ["$salePrice", "$quantity"] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);
    
    const position = ranking.findIndex(
      (r) => r._id.toString() === distributorId.toString()
    ) + 1;

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
    // Obtener el ID del distribuidor autenticado
    const distributorId = req.user.userId;

    // Verificar que el usuario sea distribuidor
    if (req.user.role !== "distribuidor") {
      return res.status(403).json({ message: "Solo los distribuidores pueden acceder a su catálogo" });
    }

    // Buscar productos que tiene en stock el distribuidor
    const DistributorStock = (await import("../models/DistributorStock.js")).default;
    const distributorStocks = await DistributorStock.find({ 
      distributor: distributorId,
      quantity: { $gt: 0 } // Solo productos con stock disponible
    }).populate({
      path: "product",
      populate: { path: "category" }
    });

    // Extraer los productos y agregar la cantidad disponible del distribuidor
    const products = distributorStocks.map(stock => {
      const product = stock.product.toObject();
      return {
        ...product,
        distributorStock: stock.quantity
      };
    });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
