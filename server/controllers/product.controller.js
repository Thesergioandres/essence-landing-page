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
    
    // Manejar imagen de Cloudinary si se subió
    if (req.file) {
      productData.image = {
        url: req.file.path,
        publicId: req.file.filename
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
    const populatedProduct = await Product.findById(product._id).populate("category", "name slug");
    
    // Invalidar caché de productos
    await invalidateCache('cache:products:*');
    
    res.status(201).json(populatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
