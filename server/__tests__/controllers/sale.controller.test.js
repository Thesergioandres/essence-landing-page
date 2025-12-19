import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { deleteSale } from "../../controllers/sale.controller.js";
import Category from "../../models/Category.js";
import DistributorStock from "../../models/DistributorStock.js";
import GamificationConfig from "../../models/GamificationConfig.js";
import Product from "../../models/Product.js";
import Sale from "../../models/Sale.js";
import User from "../../models/User.js";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Simular getCommissionBonus del controlador
const getCommissionBonus = async (distributorId) => {
  try {
    const config = await GamificationConfig.findOne();
    if (!config) return 0;

    const now = new Date();
    let startDate = config.currentPeriodStart || now;
    let endDate = new Date(startDate);

    if (config.evaluationPeriod === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const rankings = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
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

    const position =
      rankings.findIndex((r) => r._id.toString() === distributorId.toString()) +
      1;

    if (position === 1) return config.top1CommissionBonus || 0;
    if (position === 2) return config.top2CommissionBonus || 0;
    if (position === 3) return config.top3CommissionBonus || 0;

    return 0;
  } catch (error) {
    return 0;
  }
};

describe("Sale Controller - registerSale Logic", () => {
  let product, distributor, category;

  beforeEach(async () => {
    category = await Category.create({
      name: "Categoría Test",
      description: "Test",
    });

    product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: category._id,
    });

    distributor = await User.create({
      name: "Distribuidor Test",
      email: "distributor@test.com",
      password: "password123",
      role: "distribuidor",
    });
  });

  test("Debe crear venta y calcular distributorProfitPercentage correctamente", async () => {
    // Simular creación de venta
    const commissionBonus = 0;
    const distributorProfitPercentage = 20 + commissionBonus;

    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 5,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice,
      salePrice: 200,
      commissionBonus,
      distributorProfitPercentage,
    });

    expect(sale.distributorProfitPercentage).toBe(20);
    expect(sale.commissionBonus).toBe(0);
  });

  test("Debe calcular bonus para distribuidor en 1er lugar", async () => {
    // Configurar gamificación
    await GamificationConfig.create({
      top1CommissionBonus: 5,
      top2CommissionBonus: 3,
      top3CommissionBonus: 1,
      evaluationPeriod: "monthly",
      currentPeriodStart: new Date(),
    });

    // Crear venta confirmada para el distribuidor
    await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 100,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "confirmado",
    });

    const bonus = await getCommissionBonus(distributor._id);
    expect(bonus).toBe(5);
  });

  test("Debe retornar bonus 0 para distribuidor sin ventas", async () => {
    await GamificationConfig.create({
      top1CommissionBonus: 5,
      top2CommissionBonus: 3,
      top3CommissionBonus: 1,
      evaluationPeriod: "monthly",
      currentPeriodStart: new Date(),
    });

    const bonus = await getCommissionBonus(distributor._id);
    expect(bonus).toBe(0);
  });

  test("Venta de admin debe tener distributorProfitPercentage = 0", async () => {
    const sale = await Sale.create({
      distributor: null,
      product: product._id,
      quantity: 5,
      purchasePrice: product.purchasePrice,
      distributorPrice: product.distributorPrice,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 0,
      paymentStatus: "confirmado",
    });

    expect(sale.distributorProfitPercentage).toBe(0);
    expect(sale.distributor).toBeNull();
    expect(sale.distributorProfit).toBe(0);
  });
});

describe("Sale Controller - deleteSale restores inventory", () => {
  test("Debe restaurar stock del producto y del distribuidor al eliminar una venta", async () => {
    const category = await Category.create({
      name: "Categoría Test",
      description: "Test",
    });

    const product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 9, // stock ya descontado por la venta
      category: category._id,
    });

    const distributor = await User.create({
      name: "Distribuidor Test",
      email: "distributor2@test.com",
      password: "password123",
      role: "distribuidor",
    });

    await DistributorStock.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 1, // stock ya descontado por la venta
      lowStockAlert: 5,
    });

    const sale = await Sale.create({
      saleId: "VTA-2025-0001",
      distributor: distributor._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "pendiente",
    });

    const req = { params: { id: sale._id.toString() } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await deleteSale(req, res);

    const updatedProduct = await Product.findById(product._id);
    const updatedDistributorStock = await DistributorStock.findOne({
      distributor: distributor._id,
      product: product._id,
    });
    const deletedSale = await Sale.findById(sale._id);

    expect(updatedProduct.totalStock).toBe(10);
    expect(updatedDistributorStock.quantity).toBe(2);
    expect(deletedSale).toBeNull();
    expect(res.json).toHaveBeenCalledWith({
      message: "Venta eliminada y stock restaurado",
    });
  });
});

describe("Sale Controller - Ranking System", () => {
  let product, dist1, dist2, dist3, dist4, category;

  beforeEach(async () => {
    category = await Category.create({
      name: "Categoría Test",
      description: "Test",
    });

    product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 10000,
      category: category._id,
    });

    dist1 = await User.create({
      name: "Distribuidor 1",
      email: "dist1@test.com",
      password: "password123",
      role: "distribuidor",
    });

    dist2 = await User.create({
      name: "Distribuidor 2",
      email: "dist2@test.com",
      password: "password123",
      role: "distribuidor",
    });

    dist3 = await User.create({
      name: "Distribuidor 3",
      email: "dist3@test.com",
      password: "password123",
      role: "distribuidor",
    });

    dist4 = await User.create({
      name: "Distribuidor 4",
      email: "dist4@test.com",
      password: "password123",
      role: "distribuidor",
    });

    await GamificationConfig.create({
      top1CommissionBonus: 5,
      top2CommissionBonus: 3,
      top3CommissionBonus: 1,
      evaluationPeriod: "monthly",
      currentPeriodStart: new Date(),
    });
  });

  test("Debe calcular rankings correctamente según ventas totales", async () => {
    // Crear ventas confirmadas
    await Sale.create({
      distributor: dist1._id,
      product: product._id,
      quantity: 100,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "confirmado",
    });

    await Sale.create({
      distributor: dist2._id,
      product: product._id,
      quantity: 50,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "confirmado",
    });

    await Sale.create({
      distributor: dist3._id,
      product: product._id,
      quantity: 25,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "confirmado",
    });

    await Sale.create({
      distributor: dist4._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "confirmado",
    });

    const bonus1 = await getCommissionBonus(dist1._id);
    const bonus2 = await getCommissionBonus(dist2._id);
    const bonus3 = await getCommissionBonus(dist3._id);
    const bonus4 = await getCommissionBonus(dist4._id);

    expect(bonus1).toBe(5); // 1º lugar
    expect(bonus2).toBe(3); // 2º lugar
    expect(bonus3).toBe(1); // 3º lugar
    expect(bonus4).toBe(0); // Sin bonus
  });

  test("Solo ventas confirmadas deben contar para ranking", async () => {
    // Venta pendiente
    await Sale.create({
      distributor: dist1._id,
      product: product._id,
      quantity: 1000,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "pendiente",
    });

    // Venta confirmada menor
    await Sale.create({
      distributor: dist2._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
      paymentStatus: "confirmado",
    });

    const bonus1 = await getCommissionBonus(dist1._id);
    const bonus2 = await getCommissionBonus(dist2._id);

    expect(bonus1).toBe(0); // No cuenta venta pendiente
    expect(bonus2).toBe(5); // 1º lugar con venta confirmada
  });
});

describe("Sale Controller - Payment Status", () => {
  let product, distributor, category, admin;

  beforeEach(async () => {
    category = await Category.create({
      name: "Categoría Test",
      description: "Test",
    });

    product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: category._id,
    });

    distributor = await User.create({
      name: "Distribuidor Test",
      email: "distributor@test.com",
      password: "password123",
      role: "distribuidor",
    });

    admin = await User.create({
      name: "Admin Test",
      email: "admin@test.com",
      password: "password123",
      role: "admin",
    });
  });

  test('Venta de distribuidor debe iniciar con status "pendiente"', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 5,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    expect(sale.paymentStatus).toBe("pendiente");
  });

  test('Venta de admin debe tener status "confirmado" automáticamente', async () => {
    const sale = await Sale.create({
      distributor: null,
      product: product._id,
      quantity: 5,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 0,
      paymentStatus: "confirmado",
      paymentConfirmedAt: new Date(),
      paymentConfirmedBy: admin._id,
    });

    expect(sale.paymentStatus).toBe("confirmado");
    expect(sale.paymentConfirmedAt).toBeDefined();
    expect(sale.paymentConfirmedBy).toBeDefined();
  });

  test("Debe poder cambiar status de pendiente a confirmado", async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 5,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    sale.paymentStatus = "confirmado";
    sale.paymentConfirmedAt = new Date();
    sale.paymentConfirmedBy = admin._id;
    await sale.save();

    const updated = await Sale.findById(sale._id);
    expect(updated.paymentStatus).toBe("confirmado");
    expect(updated.paymentConfirmedAt).toBeDefined();
  });
});
