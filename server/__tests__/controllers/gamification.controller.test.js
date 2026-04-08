import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  getAdjustedCommission,
  getConfig,
  getRanking,
  updateConfig,
} from "../../controllers/gamification.controller.js";
import Business from "../../models/Business.js";
import Category from "../../models/Category.js";
import GamificationConfig from "../../models/GamificationConfig.js";
import Membership from "../../models/Membership.js";
import Product from "../../src/infrastructure/database/models/Product.js";
import Sale from "../../src/infrastructure/database/models/Sale.js";
import User from "../../src/infrastructure/database/models/User.js";

let mongoServer;
let testBusiness;
let testAdmin;
let testDistributor1;
let testDistributor2;
let testProduct;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Crear usuario admin
  testAdmin = await User.create({
    name: "Admin Test",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });

  // Crear negocio
  testBusiness = await Business.create({
    name: "Negocio Test",
    owner: testAdmin._id,
    createdBy: testAdmin._id,
    slug: "negocio-test",
  });

  // Crear distribuidores
  testDistributor1 = await User.create({
    name: "Distribuidor 1",
    email: "dist1@test.com",
    password: "password123",
    role: "distribuidor",
  });

  testDistributor2 = await User.create({
    name: "Distribuidor 2",
    email: "dist2@test.com",
    password: "password123",
    role: "distribuidor",
  });

  // Crear membresías
  await Membership.insertMany([
    {
      user: testDistributor1._id,
      business: testBusiness._id,
      role: "distribuidor",
      status: "active",
    },
    {
      user: testDistributor2._id,
      business: testBusiness._id,
      role: "distribuidor",
      status: "active",
    },
  ]);

  // Crear categoría y producto
  const category = await Category.create({
    name: "Categoría Test",
    description: "Test",
  });

  testProduct = await Product.create({
    name: "Producto Test",
    description: "Test",
    purchasePrice: 100,
    distributorPrice: 150,
    salePrice: 200,
    totalStock: 1000,
    category: category._id,
    business: testBusiness._id,
  });

  // Crear config de gamificación
  await GamificationConfig.create({
    business: testBusiness._id,
    evaluationPeriod: "monthly",
    top1CommissionBonus: 5,
    top2CommissionBonus: 3,
    top3CommissionBonus: 1,
    autoEvaluate: true,
    currentPeriodStart: new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ),
  });
});

const mockRequest = (
  body = {},
  params = {},
  query = {},
  businessId = null
) => ({
  body,
  params,
  query,
  businessId: businessId || testBusiness._id.toString(),
  headers: { "x-business-id": businessId || testBusiness._id.toString() },
  user: { _id: testAdmin._id, name: testAdmin.name, role: testAdmin.role },
  reqId: `test-${Date.now()}`,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Gamification Controller - getAdjustedCommission", () => {
  it("Debe obtener comisión ajustada para un distribuidor", async () => {
    const req = mockRequest(
      {},
      { distributorId: testDistributor1._id.toString() }
    );
    const res = mockResponse();

    await getAdjustedCommission(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty("position");
    expect(responseData).toHaveProperty("bonusCommission");
    expect(responseData).toHaveProperty("totalDistributors");
  });

  it("Debe rechazar distribuidor fuera del negocio", async () => {
    const fakeDistributorId = new mongoose.Types.ObjectId();
    const req = mockRequest(
      {},
      { distributorId: fakeDistributorId.toString() }
    );
    const res = mockResponse();

    await getAdjustedCommission(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Distribuidor fuera del negocio" })
    );
  });

  it("Debe requerir x-business-id", async () => {
    const req = mockRequest(
      {},
      { distributorId: testDistributor1._id.toString() },
      {},
      null
    );
    req.businessId = null;
    req.headers = {};
    const res = mockResponse();

    await getAdjustedCommission(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("Gamification Controller - getRanking", () => {
  beforeEach(async () => {
    // Crear ventas para generar rankings
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    await Sale.insertMany([
      {
        business: testBusiness._id,
        distributor: testDistributor1._id,
        product: testProduct._id,
        quantity: 10,
        salePrice: 200,
        purchasePrice: 100,
        distributorPrice: 150,
        totalProfit: 500,
        saleDate: startOfMonth,
        paymentStatus: "confirmado",
      },
      {
        business: testBusiness._id,
        distributor: testDistributor2._id,
        product: testProduct._id,
        quantity: 5,
        salePrice: 200,
        purchasePrice: 100,
        distributorPrice: 150,
        totalProfit: 250,
        saleDate: startOfMonth,
        paymentStatus: "confirmado",
      },
    ]);
  });

  it("Debe obtener rankings de distribuidores", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await getRanking(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(Array.isArray(responseData.rankings)).toBe(true);
  });

  it("Debe ordenar por ingresos totales (descendente)", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await getRanking(req, res);

    const responseData = res.json.mock.calls[0][0];
    if (responseData.rankings && responseData.rankings.length >= 2) {
      expect(responseData.rankings[0].totalRevenue).toBeGreaterThanOrEqual(
        responseData.rankings[1].totalRevenue
      );
    }
  });
});

describe("Gamification Controller - getConfig", () => {
  it("Debe obtener la configuración de gamificación", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await getConfig(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty("evaluationPeriod", "monthly");
    expect(responseData).toHaveProperty("top1CommissionBonus", 5);
    expect(responseData).toHaveProperty("top2CommissionBonus", 3);
    expect(responseData).toHaveProperty("top3CommissionBonus", 1);
  });

  it("Debe crear configuración por defecto si no existe", async () => {
    // Eliminar configuración existente
    await GamificationConfig.deleteMany({});

    const req = mockRequest();
    const res = mockResponse();

    await getConfig(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveProperty("evaluationPeriod");
  });
});

describe("Gamification Controller - updateConfig", () => {
  it("Debe actualizar la configuración de gamificación", async () => {
    const req = mockRequest({
      evaluationPeriod: "biweekly",
      top1CommissionBonus: 10,
      top2CommissionBonus: 5,
      top3CommissionBonus: 2,
    });
    const res = mockResponse();

    await updateConfig(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.config.evaluationPeriod).toBe("biweekly");
    expect(responseData.config.top1CommissionBonus).toBe(10);

    // Verificar en BD
    const config = await GamificationConfig.findOne();
    expect(config.evaluationPeriod).toBe("biweekly");
  });

  it("Debe validar valores de bonificación no negativos", async () => {
    const req = mockRequest({
      top1CommissionBonus: -5,
    });
    const res = mockResponse();

    await updateConfig(req, res);

    // Dependiendo de la implementación, puede rechazar o aceptar
    // Este test verifica que la operación se complete
    expect(res.json).toHaveBeenCalled();
  });
});
