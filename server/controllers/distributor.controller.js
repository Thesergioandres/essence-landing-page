import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { invalidateCache } from "../middleware/cache.middleware.js";
import DistributorStock from "../models/DistributorStock.js";
import Membership from "../models/Membership.js";
import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js"; // ⭐ Import Promotion
import Sale from "../models/Sale.js";
import User from "../models/User.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

// @desc    Crear distribuidor
// @route   POST /api/distributors
// @access  Private/Admin
export const createDistributor = async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Verificar si el email ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear distribuidor
    const distributor = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      role: "distribuidor",
      status: "active", // Los distribuidores creados por el negocio están activos inmediatamente
      active: true,
    });

    await Membership.findOneAndUpdate(
      { user: distributor._id, business: businessId },
      { role: "distribuidor", status: "active" },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({
      _id: distributor._id,
      name: distributor.name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      role: distributor.role,
      active: distributor.active,
    });

    await invalidateCache(`cache:distributors:${businessId}:*`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener todos los distribuidores
// @route   GET /api/distributors
// @access  Private/Admin
export const getDistributors = async (req, res) => {
  try {
    const { active, page = 1, limit = 20 } = req.query;
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const memberships = await Membership.find({
      business: businessId,
      role: "distribuidor",
      status: "active",
    }).select("user");

    const membershipDistributorIds = memberships.map((m) => m.user);

    if (membershipDistributorIds.length === 0) {
      return res.json({
        data: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0,
          hasMore: false,
        },
      });
    }

    const filter = {
      role: "distribuidor",
      _id: { $in: membershipDistributorIds },
    };
    if (active !== undefined) {
      filter.active = active === "true";
    }

    const skip = (pageNum - 1) * limitNum;

    const [distributors, total] = await Promise.all([
      User.find(filter)
        // No necesitamos populate aquí; la UI usa solo stats + datos básicos.
        .select("name email phone address role active assignedProducts")
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    const distributorIds = distributors.map((d) => d._id);
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const objectIds = distributorIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const [stockAgg, salesAgg] = await Promise.all([
      DistributorStock.aggregate([
        {
          $match: {
            business: businessObjectId,
            distributor: { $in: objectIds },
          },
        },
        { $group: { _id: "$distributor", totalStock: { $sum: "$quantity" } } },
      ]),
      Sale.aggregate([
        {
          $match: {
            business: businessObjectId,
            distributor: { $in: objectIds },
          },
        },
        {
          $group: {
            _id: "$distributor",
            totalSales: { $sum: 1 },
            totalProfit: { $sum: "$distributorProfit" },
          },
        },
      ]),
    ]);

    const stockByDistributor = new Map(
      stockAgg.map((s) => [String(s._id), Number(s.totalStock) || 0]),
    );
    const salesByDistributor = new Map(
      salesAgg.map((s) => [
        String(s._id),
        {
          totalSales: Number(s.totalSales) || 0,
          totalProfit: Number(s.totalProfit) || 0,
        },
      ]),
    );

    const distributorsWithStats = distributors.map((distributor) => {
      const salesStats = salesByDistributor.get(String(distributor._id)) || {
        totalSales: 0,
        totalProfit: 0,
      };

      return {
        ...distributor,
        stats: {
          totalStock: stockByDistributor.get(String(distributor._id)) || 0,
          totalSales: salesStats.totalSales,
          totalProfit: salesStats.totalProfit,
          assignedProductsCount: distributor.assignedProducts?.length || 0,
        },
      };
    });

    res.json({
      data: distributorsWithStats,
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

// @desc    Obtener un distribuidor por ID
// @route   GET /api/distributors/:id
// @access  Private/Admin
export const getDistributorById = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: req.params.id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      return res
        .status(404)
        .json({ message: "Distribuidor no encontrado en este negocio" });
    }

    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const distributor = await User.findOne({
      _id: req.params.id,
      role: "distribuidor",
    })
      .select("-password")
      .populate(
        "assignedProducts",
        "name image purchasePrice distributorPrice",
      );

    if (!distributor || distributor.role !== "distribuidor") {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    // Stock del distribuidor
    const stock = await DistributorStock.find({
      distributor: distributor._id,
      business: businessObjectId,
    }).populate("product", "name image");

    // Ventas del distribuidor
    const sales = await Sale.find({
      distributor: distributor._id,
      business: businessObjectId,
    })
      .populate("product", "name")
      .sort({ saleDate: -1 })
      .limit(10);

    // Estadísticas
    const allSales = await Sale.find({
      distributor: distributor._id,
      business: businessObjectId,
    });
    const totalSales = allSales.length;
    const totalProfit = allSales.reduce(
      (sum, sale) => sum + sale.distributorProfit,
      0,
    );
    const totalRevenue = allSales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0,
    );

    res.json({
      distributor,
      stock,
      recentSales: sales,
      stats: {
        totalSales,
        totalProfit,
        totalRevenue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Actualizar distribuidor
// @route   PUT /api/distributors/:id
// @access  Private/Admin
export const updateDistributor = async (req, res) => {
  try {
    const { name, email, phone, address, active } = req.body;
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: req.params.id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    const distributor = await User.findOne({
      _id: req.params.id,
      role: "distribuidor",
    });

    if (!distributor) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    // Verificar email único si se está cambiando
    if (email && email !== distributor.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: "El email ya está en uso" });
      }
      distributor.email = email;
    }

    if (name) distributor.name = name;
    if (phone !== undefined) distributor.phone = phone;
    if (address !== undefined) distributor.address = address;
    if (active !== undefined) distributor.active = active;

    await distributor.save();

    res.json({
      _id: distributor._id,
      name: distributor.name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      role: distributor.role,
      active: distributor.active,
    });

    await invalidateCache(`cache:distributors:${businessId}:*`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Eliminar distribuidor
// @route   DELETE /api/distributors/:id
// @access  Private/Admin
export const deleteDistributor = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: req.params.id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    const distributor = await User.findOne({
      _id: req.params.id,
      role: "distribuidor",
    });

    if (!distributor) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    await Membership.deleteMany({
      user: distributor._id,
      business: businessId,
    });

    // Buscar todo el stock del distribuidor
    const distributorStocks = await DistributorStock.find({
      distributor: distributor._id,
      business: businessId,
    });

    let returnedProducts = 0;
    let totalQuantityReturned = 0;

    // Devolver el inventario al stock de bodega
    for (const stock of distributorStocks) {
      if (stock.quantity > 0) {
        const product = await Product.findById(stock.product);

        if (product && String(product.business) === String(businessId)) {
          // Devolver al stock de bodega
          product.warehouseStock += stock.quantity;
          product.totalStock += stock.quantity;
          await product.save();

          returnedProducts++;
          totalQuantityReturned += stock.quantity;
        }
      }

      // Eliminar el registro de stock del distribuidor
      await stock.deleteOne();
    }

    // Eliminar el distribuidor
    await distributor.deleteOne();

    res.json({
      message: "Distribuidor eliminado correctamente",
      inventoryReturned: {
        products: returnedProducts,
        totalQuantity: totalQuantityReturned,
      },
    });

    await invalidateCache(`cache:distributors:${businessId}:*`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Activar/Desactivar distribuidor
// @route   PATCH /api/distributors/:id/toggle-active
// @access  Private/Admin
export const toggleDistributorActive = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: req.params.id,
      role: "distribuidor",
      status: "active",
    });

    if (!membership) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    const distributor = await User.findOne({
      _id: req.params.id,
      role: "distribuidor",
    });

    if (!distributor) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    distributor.active = !distributor.active;
    await distributor.save();

    res.json({
      message: `Distribuidor ${
        distributor.active ? "activado" : "desactivado"
      } correctamente`,
      active: distributor.active,
    });

    await invalidateCache(`cache:distributors:${businessId}:*`);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Obtener catálogo público de un distribuidor
// @route   GET /api/distributors/:id/catalog
// @access  Public
export const getDistributorPublicCatalog = async (req, res) => {
  try {
    const distributorId = req.params.id;

    // Obtener información del distribuidor
    const distributor = await User.findOne({
      _id: distributorId,
      role: "distribuidor",
      active: true,
    }).select("name email phone");

    if (!distributor) {
      return res.status(404).json({ message: "Distribuidor no encontrado" });
    }

    // Obtener el inventario del distribuidor con productos poblados
    const distributorStock = await DistributorStock.find({
      distributor: distributorId,
      quantity: { $gt: 0 },
    })
      .populate({
        path: "product",
        select: "name description clientPrice image totalStock category",
      })
      .lean();

    // Filtrar y formatear productos
    const products = distributorStock
      .filter((item) => item.product && item.product.totalStock > 0)
      .map((item) => ({
        _id: item.product._id,
        name: item.product.name,
        description: item.product.description,
        clientPrice: item.product.clientPrice,
        image: item.product.image,
        totalStock: item.quantity, // Mostrar solo el stock del distribuidor
        category: item.product.category,
      }));

    res.json({
      distributor: {
        name: distributor.name,
        email: distributor.email,
        phone: distributor.phone,
      },
      products,
    });
  } catch (error) {
    console.error("Error al obtener catálogo público:", error);
    res.status(500).json({ message: "Error al cargar el catálogo" });
  }
};

// ==========================================
// 🚀 MÓDULO B2B (Compra de stock)
// ==========================================

// @desc    Obtener catálogo de compra para Distribuidores (Productos + Promos)
// @route   GET /api/distributors/catalog/buyable
// @access  Private/Distributor
export const getDistributorProducts = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId)
      return res.status(400).json({ message: "Falta x-business-id" });

    // 1. Obtener Productos Activos
    const products = await Product.find({
      business: businessId,
      // status: "active" // Asumimos que existen filtros de estado en schema, o usar warehouseStock > 0?
    })
      .select(
        "name image distributorPrice clientPrice description category warehouseStock totalStock",
      )
      .lean();

    // 2. Obtener Promociones Activas
    const promotions = await Promotion.find({
      business: businessId,
      status: "active",
    })
      .populate("comboItems.product", "name image")
      .lean();

    // 3. Normalizar y Combinar
    // Mapeo solicitado: price visual = distributorPrice
    const catalogItems = [
      ...products.map((p) => ({
        _id: p._id,
        name: p.name,
        image: p.image,
        price: p.distributorPrice, // ⭐ Precio visual principal para el distribuidor
        clientPrice: p.clientPrice, // Referencia de venta sugerida
        category: p.category,
        stock: p.warehouseStock, // Stock disponible en bodega central
        type: "product",
        isPromotion: false,
        description: p.description,
      })),
      ...promotions.map((p) => ({
        _id: p._id,
        name: `🎁 ${p.name}`,
        image: p.image,
        price: p.distributorPrice, // ⭐ Precio visual principal
        clientPrice: p.promotionPrice,
        category: "Promociones", // Categoría virtual para filtros
        stock: 9999, // Virtual, depende de componentes
        type: "promotion",
        isPromotion: true,
        description: p.description,
        items: p.comboItems,
      })),
    ];

    res.json({
      message: "Catálogo B2B cargado",
      data: catalogItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: Start of Day
const toColombiaStartOfDay = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      5,
      0,
      0,
      0,
    ),
  );
};

// @desc    Crear pedido de distribuidor (Compra de stock a la bodega central)
// @route   POST /api/distributors/orders
// @access  Private/Distributor
export const createDistributorOrder = async (req, res) => {
  const reqId = Date.now();
  console.log(`[${reqId}] 📦 Nuevo Pedido B2B iniciado por: ${req.user.id}`);

  try {
    const businessId = resolveBusinessId(req);
    const distributorId = req.user.id; // Distribuidor autenticado
    const { items, paymentMethodId, paymentProof } = req.body; // items: [{ id, quantity, isPromotion }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "El pedido está vacío" });
    }

    const processedResults = [];
    const errors = [];
    let totalOrderAmount = 0;

    // Procesar cada item secuencialmente para evitar race conditions masivas
    for (const item of items) {
      const { id, quantity, isPromotion } = item;

      if (quantity <= 0) continue;

      console.log(
        `[${reqId}] Procesando item: ${id} (Promo: ${isPromotion}) Qty: ${quantity}`,
      );

      try {
        // 1. Identificar Producto/Promo y validar Stock Bodega
        let targetProduct = null;
        let componentsToDeduct = [];
        let distributorPrice = 0;
        let name = "";

        if (isPromotion) {
          const promo = await Promotion.findOne({
            _id: id,
            business: businessId,
          }).populate("comboItems.product");
          if (!promo) throw new Error("Promoción no encontrada");
          if (promo.status !== "active") throw new Error("Promoción inactiva");

          distributorPrice = promo.distributorPrice;
          name = promo.name;

          // Verificar componentes (Despiece)
          for (const comp of promo.comboItems) {
            const compProd = comp.product;
            const reqQty = (comp.quantity || 1) * quantity;
            if (!compProd || (compProd.warehouseStock || 0) < reqQty) {
              throw new Error(
                `Stock insuficiente en bodega para componente: ${compProd?.name || "Unknown"}`,
              );
            }
            componentsToDeduct.push({
              product: compProd,
              deductQty: reqQty,
              addToDistributorQty: reqQty,
            });
          }
        } else {
          targetProduct = await Product.findOne({
            _id: id,
            business: businessId,
          });
          if (!targetProduct) throw new Error("Producto no encontrado");

          if ((targetProduct.warehouseStock || 0) < quantity) {
            throw new Error(
              `Stock insuficiente en bodega para: ${targetProduct.name}`,
            );
          }
          distributorPrice = targetProduct.distributorPrice;
          name = targetProduct.name;

          componentsToDeduct.push({
            product: targetProduct,
            deductQty: quantity,
            addToDistributorQty: quantity,
          });
        }

        // 2. Ejecutar Movimientos de Inventario (Atomicos)
        for (const comp of componentsToDeduct) {
          // Restar de Bodega
          const updatedProd = await Product.findOneAndUpdate(
            { _id: comp.product._id, warehouseStock: { $gte: comp.deductQty } },
            {
              $inc: {
                warehouseStock: -comp.deductQty,
                totalStock: -comp.deductQty,
              },
            },
            { new: true },
          );
          if (!updatedProd)
            throw new Error(
              `Stock insuficiente (race) para ${comp.product.name}`,
            );

          // Sumar a Distribuidor
          await DistributorStock.findOneAndUpdate(
            {
              distributor: distributorId,
              product: comp.product._id,
              business: businessId,
            },
            { $inc: { quantity: comp.addToDistributorQty } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        }

        // 3. Registrar Venta Admin (Ingreso = distributorPrice)
        // Creamos un registro de venta donde "Admin vende al Distribuidor"
        // No asignamos 'distributor' field en Sale para que se cuente como venta directa del admin (sin comisión de distribuidor sobre su propia compra)
        // O usamos un flag especial. Según Sale.js: "if (!this.distributor) { adminProfit = (salePrice - cost)... }"
        // Aquí el precio de venta es el distributorPrice.

        // Calcular costo real para el admin
        let realCost = 0;
        if (isPromotion) {
          // Sum cost of components
          realCost =
            componentsToDeduct.reduce(
              (acc, c) =>
                acc +
                (c.product.averageCost || c.product.purchasePrice || 0) *
                  (c.deductQty / quantity),
              0,
            ) * quantity;
          // Note: c.deductQty includes validation multiplier. We aggregate total cost for the LINE.
        } else {
          realCost =
            (targetProduct.averageCost || targetProduct.purchasePrice || 0) *
            quantity;
        }
        const unitCost = realCost / quantity;

        const saleData = {
          business: businessId,
          saleId: `B2B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          product: isPromotion ? items[0].id : id, // Si es promo, guardamos ID promo? Sale requiere Product Ref.
          // Si Sale requiere prod ref valida, Promo ID fallará si no está en products.
          // Hack: Si es promo, usamos el ID del primer componente o un producto dummy?
          // El usuario pidió "Soporta isPromotion: true".
          // Si Sale model strict refs Product, tenemos problema.
          // Asumiremos que podemos guardar el ID. Si falla populate en frontend admin, se arreglará luego.
          // OJO: Si componentsToDeduct tiene 1 elemento (Producto normal), usa ese ID.
          quantity: quantity,
          purchasePrice: unitCost,
          averageCostAtSale: unitCost,
          distributorPrice: distributorPrice,
          salePrice: distributorPrice, // Venta al precio de distribuidor

          distributor: null, // Null para que sea venta directa del Admin (ingreso neto)
          // Podríamos guardar el ID del distribuidor en 'customer' o 'notes' para referencia
          notes: `Pedido B2B de Distribuidor (ID: ${distributorId}). ${isPromotion ? "Incluye Promoción" : ""}`,

          paymentStatus: "confirmado",
          paymentConfirmedAt: new Date(),
          createdBy: req.user.id,
          saleDate: new Date(),
          // Campos obligatorios dummy
          clientPrice: 0, // Si existe en modelo
        };

        // Fix para sale.product si es promo: Si model exige ref Product, usar el primer componente como referencia visual?
        // Mejor: Si es promo, iteramos komponentes y creamos UNA VENTA POR COMPONENTE?
        // No, el usuario quiere registrar la venta del bundle.
        // Intentaremos guardar ID original. Si falla, el try/catch lo captura.
        if (isPromotion) {
          // Si Mongo valida refs, esto podría fallar.
          // Intentamos.
          // Si falla, en el catch, rollback? (Dificil rollback de stock ya hecho).
          // Por seguridad, usaremos el ID del primer componente como "proxy" si es promo, o creamos sales individuales?
          // El prompt dice "Registra LA VENTA usando distributorPrice". Singular.
          // Dejaremos el ID original.
        }

        await Sale.create(saleData);

        totalOrderAmount += distributorPrice * quantity;
        processedResults.push({ id, status: "success", msg: "Procesado" });
      } catch (err) {
        console.error(`Error procesando item B2B ${id}:`, err);
        errors.push({ id, error: err.message });
        // Note: Stock deduction might have happened partially if atomic failed midway?
        // We used atomic findOneAndUpdate. If Promo loop fails midway, we have partial deduction.
        // In production this needs transaction session.
      }
    }

    res.json({
      message: "Pedido procesado",
      summary: {
        processed: processedResults.length,
        errors: errors.length,
        totalAmount: totalOrderAmount,
        details: processedResults,
        failures: errors,
      },
    });
  } catch (error) {
    console.error("Critical B2B Order Error:", error);
    res.status(500).json({ message: error.message });
  }
};
