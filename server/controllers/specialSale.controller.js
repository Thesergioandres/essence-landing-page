import SpecialSale from "../models/SpecialSale.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

// @desc    Crear una venta especial
// @route   POST /api/special-sales
// @access  Private/Admin
export const createSpecialSale = async (req, res) => {
  try {
    const {
      product,
      quantity,
      specialPrice,
      cost,
      distribution,
      observations,
      eventName,
      saleDate,
    } = req.body;

    // Validaciones básicas
    if (!product || !product.name) {
      return res.status(400).json({
        success: false,
        message: "El nombre del producto es requerido",
      });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "La cantidad debe ser al menos 1",
      });
    }

    if (specialPrice === undefined || specialPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "El precio especial es requerido y debe ser positivo",
      });
    }

    if (cost === undefined || cost < 0) {
      return res.status(400).json({
        success: false,
        message: "El costo es requerido y debe ser positivo",
      });
    }

    if (!distribution || distribution.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debe incluir al menos un distribuidor en la distribución",
      });
    }

    // Validar que cada distribuidor tenga nombre y monto
    for (const dist of distribution) {
      if (!dist.name || dist.name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Todos los distribuidores deben tener un nombre",
        });
      }
      if (dist.amount === undefined || dist.amount < 0) {
        return res.status(400).json({
          success: false,
          message: "Todos los distribuidores deben tener un monto válido",
        });
      }
    }

    // Calcular ganancia total
    const totalProfit = specialPrice * quantity - cost * quantity;

    // Validar que la suma de distribuciones no exceda la ganancia total
    const distributionSum = distribution.reduce(
      (sum, dist) => sum + dist.amount,
      0
    );

    const tolerance = 0.01;
    if (distributionSum > totalProfit + tolerance) {
      return res.status(400).json({
        success: false,
        message: `La suma de distribuciones ($${distributionSum.toFixed(2)}) excede la ganancia total ($${totalProfit.toFixed(2)})`,
        distributionSum,
        totalProfit,
      });
    }

    // Si hay ganancia restante, asignarla al Admin (usuario que crea la venta)
    const remainingProfit = totalProfit - distributionSum;
    let finalDistribution = [...distribution];

    if (Math.abs(remainingProfit) > tolerance) {
      // Buscar si ya existe "Admin" en la distribución
      const adminIndex = finalDistribution.findIndex(
        (d) => d.name.toLowerCase() === "admin"
      );

      if (adminIndex !== -1) {
        // Si ya existe Admin, sumar al monto existente
        finalDistribution[adminIndex].amount += remainingProfit;
        finalDistribution[adminIndex].notes = finalDistribution[adminIndex].notes 
          ? `${finalDistribution[adminIndex].notes} (incluye restante: $${remainingProfit.toFixed(2)})`
          : `Incluye restante: $${remainingProfit.toFixed(2)}`;
      } else {
        // Si no existe, agregar nuevo distribuidor Admin
        finalDistribution.push({
          name: "Admin",
          amount: parseFloat(remainingProfit.toFixed(2)),
          notes: "Ganancia restante asignada automáticamente",
        });
      }
    }

    // Si product.productId existe, verificar que el producto exista
    if (product.productId) {
      const productExists = await Product.findById(product.productId);
      if (!productExists) {
        return res.status(404).json({
          success: false,
          message: "El producto especificado no existe",
        });
      }
    }

    // Crear la venta especial
    const specialSale = await SpecialSale.create({
      product,
      quantity,
      specialPrice,
      cost,
      totalProfit,
      distribution: finalDistribution,
      observations,
      eventName,
      saleDate: saleDate || Date.now(),
      createdBy: req.user._id,
    });

    // Poblar información del creador
    await specialSale.populate("createdBy", "name email");
    if (specialSale.product.productId) {
      await specialSale.populate("product.productId", "name image");
    }

    res.status(201).json({
      success: true,
      message: "Venta especial creada exitosamente",
      data: specialSale,
    });
  } catch (error) {
    console.error("Error al crear venta especial:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al crear la venta especial",
    });
  }
};

// @desc    Obtener todas las ventas especiales
// @route   GET /api/special-sales
// @access  Private/Admin
export const getAllSpecialSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status = "active",
      productName,
      eventName,
      sortBy = "-saleDate",
    } = req.query;

    const query = {};

    // Filtro por estado
    if (status) {
      query.status = status;
    }

    // Filtro por rango de fechas
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }

    // Filtro por nombre de producto
    if (productName) {
      query["product.name"] = { $regex: productName, $options: "i" };
    }

    // Filtro por nombre de evento
    if (eventName) {
      query.eventName = { $regex: eventName, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [specialSales, total] = await Promise.all([
      SpecialSale.find(query)
        .populate("createdBy", "name email")
        .populate("product.productId", "name image")
        .sort(sortBy)
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      SpecialSale.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: specialSales.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: specialSales,
    });
  } catch (error) {
    console.error("Error al obtener ventas especiales:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener las ventas especiales",
    });
  }
};

// @desc    Obtener una venta especial por ID
// @route   GET /api/special-sales/:id
// @access  Private/Admin
export const getSpecialSaleById = async (req, res) => {
  try {
    const specialSale = await SpecialSale.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("product.productId", "name image clientPrice cost");

    if (!specialSale) {
      return res.status(404).json({
        success: false,
        message: "Venta especial no encontrada",
      });
    }

    res.status(200).json({
      success: true,
      data: specialSale,
    });
  } catch (error) {
    console.error("Error al obtener venta especial:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la venta especial",
    });
  }
};

// @desc    Actualizar una venta especial
// @route   PUT /api/special-sales/:id
// @access  Private/Admin
export const updateSpecialSale = async (req, res) => {
  try {
    const {
      product,
      quantity,
      specialPrice,
      cost,
      distribution,
      observations,
      eventName,
      saleDate,
      status,
    } = req.body;

    const specialSale = await SpecialSale.findById(req.params.id);

    if (!specialSale) {
      return res.status(404).json({
        success: false,
        message: "Venta especial no encontrada",
      });
    }

    // Actualizar campos si se proporcionan
    if (product) specialSale.product = product;
    if (quantity) specialSale.quantity = quantity;
    if (specialPrice !== undefined) specialSale.specialPrice = specialPrice;
    if (cost !== undefined) specialSale.cost = cost;
    
    // Si se actualiza la distribución, aplicar la misma lógica de ganancias restantes
    if (distribution) {
      const newTotalProfit = 
        (specialPrice !== undefined ? specialPrice : specialSale.specialPrice) * 
        (quantity !== undefined ? quantity : specialSale.quantity) - 
        (cost !== undefined ? cost : specialSale.cost) * 
        (quantity !== undefined ? quantity : specialSale.quantity);

      const distributionSum = distribution.reduce(
        (sum, dist) => sum + dist.amount,
        0
      );

      const tolerance = 0.01;
      if (distributionSum > newTotalProfit + tolerance) {
        return res.status(400).json({
          success: false,
          message: `La suma de distribuciones ($${distributionSum.toFixed(2)}) excede la ganancia total ($${newTotalProfit.toFixed(2)})`,
        });
      }

      // Si hay ganancia restante, asignarla al Admin
      const remainingProfit = newTotalProfit - distributionSum;
      let finalDistribution = [...distribution];

      if (Math.abs(remainingProfit) > tolerance) {
        const adminIndex = finalDistribution.findIndex(
          (d) => d.name.toLowerCase() === "admin"
        );

        if (adminIndex !== -1) {
          finalDistribution[adminIndex].amount += remainingProfit;
          finalDistribution[adminIndex].notes = finalDistribution[adminIndex].notes 
            ? `${finalDistribution[adminIndex].notes} (incluye restante: $${remainingProfit.toFixed(2)})`
            : `Incluye restante: $${remainingProfit.toFixed(2)}`;
        } else {
          finalDistribution.push({
            name: "Admin",
            amount: parseFloat(remainingProfit.toFixed(2)),
            notes: "Ganancia restante asignada automáticamente",
          });
        }
      }

      specialSale.distribution = finalDistribution;
    }
    
    if (observations !== undefined) specialSale.observations = observations;
    if (eventName !== undefined) specialSale.eventName = eventName;
    if (saleDate) specialSale.saleDate = saleDate;
    if (status) specialSale.status = status;

    // El pre-save hook validará automáticamente la distribución
    await specialSale.save();

    await specialSale.populate("createdBy", "name email");
    if (specialSale.product.productId) {
      await specialSale.populate("product.productId", "name image");
    }

    res.status(200).json({
      success: true,
      message: "Venta especial actualizada exitosamente",
      data: specialSale,
    });
  } catch (error) {
    console.error("Error al actualizar venta especial:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al actualizar la venta especial",
    });
  }
};

// @desc    Eliminar una venta especial
// @route   DELETE /api/special-sales/:id
// @access  Private/Admin
export const deleteSpecialSale = async (req, res) => {
  try {
    const specialSale = await SpecialSale.findById(req.params.id);

    if (!specialSale) {
      return res.status(404).json({
        success: false,
        message: "Venta especial no encontrada",
      });
    }

    await specialSale.deleteOne();

    res.status(200).json({
      success: true,
      message: "Venta especial eliminada exitosamente",
    });
  } catch (error) {
    console.error("Error al eliminar venta especial:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar la venta especial",
    });
  }
};

// @desc    Cancelar una venta especial
// @route   PUT /api/special-sales/:id/cancel
// @access  Private/Admin
export const cancelSpecialSale = async (req, res) => {
  try {
    const specialSale = await SpecialSale.findById(req.params.id);

    if (!specialSale) {
      return res.status(404).json({
        success: false,
        message: "Venta especial no encontrada",
      });
    }

    if (specialSale.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "La venta especial ya está cancelada",
      });
    }

    specialSale.status = "cancelled";
    await specialSale.save();

    res.status(200).json({
      success: true,
      message: "Venta especial cancelada exitosamente",
      data: specialSale,
    });
  } catch (error) {
    console.error("Error al cancelar venta especial:", error);
    res.status(500).json({
      success: false,
      message: "Error al cancelar la venta especial",
    });
  }
};

// @desc    Obtener estadísticas de ventas especiales
// @route   GET /api/special-sales/stats/overview
// @access  Private/Admin
export const getSpecialSalesStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const statistics = await SpecialSale.getStatistics(startDate, endDate);

    res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener las estadísticas",
    });
  }
};

// @desc    Obtener distribución por persona
// @route   GET /api/special-sales/stats/distribution
// @access  Private/Admin
export const getDistributionByPerson = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const distribution = await SpecialSale.getDistributionByPerson(
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    console.error("Error al obtener distribución:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener la distribución",
    });
  }
};

// @desc    Obtener productos más vendidos en ventas especiales
// @route   GET /api/special-sales/stats/top-products
// @access  Private/Admin
export const getTopProducts = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const match = {
      status: "active",
    };

    if (startDate || endDate) {
      match.saleDate = {};
      if (startDate) match.saleDate.$gte = new Date(startDate);
      if (endDate) match.saleDate.$lte = new Date(endDate);
    }

    const topProducts = await SpecialSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$product.name",
          totalQuantity: { $sum: "$quantity" },
          totalSales: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
          totalProfit: { $sum: "$totalProfit" },
          salesCount: { $sum: 1 },
          averagePrice: { $avg: "$specialPrice" },
        },
      },
      { $sort: { totalProfit: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.status(200).json({
      success: true,
      data: topProducts,
    });
  } catch (error) {
    console.error("Error al obtener productos top:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener los productos más vendidos",
    });
  }
};
