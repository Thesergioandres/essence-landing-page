import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import BranchTransfer from "../models/BranchTransfer.js";
import Business from "../models/Business.js";
import Product from "../src/infrastructure/database/models/Product.js";
import User from "../src/infrastructure/database/models/User.js";

// Tests de integración para el módulo de transferencias entre sedes
// Usa MongoMemoryServer para aislar la base de datos.
describe("Branch transfers", () => {
  let app;
  let mongoServer;
  let adminToken;
  let adminId;
  let businessId;
  let originBranchId;
  let targetBranchId;
  let productId;
  let foreignProductId;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    const mod = await import("../server.js");
    app = mod.default;

    await User.deleteMany({});
    await Product.deleteMany({});
    await Branch.deleteMany({});
    await BranchStock.deleteMany({});
    await BranchTransfer.deleteMany({});
    await Business.deleteMany({});

    const adminHashed = await bcrypt.hash("password123", 10);
    const admin = await User.create({
      name: "Admin Branch",
      email: "admin.branch@test.com",
      password: adminHashed,
      role: "admin",
      active: true,
    });
    adminId = admin._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.branch@test.com", password: "password123" })
      .expect(200);
    adminToken = login.body.token;

    const business = await Business.create({
      name: "Negocio Prueba Sedes",
      createdBy: adminId,
    });
    businessId = business._id.toString();

    const origin = await Branch.create({
      business: businessId,
      name: "Sede Origen",
    });
    originBranchId = origin._id.toString();

    const target = await Branch.create({
      business: businessId,
      name: "Sede Destino",
    });
    targetBranchId = target._id.toString();

    const product = await Product.create({
      name: "Producto Sede",
      description: "Para transferencias",
      purchasePrice: 10,
      distributorPrice: 15,
      clientPrice: 20,
      category: new mongoose.Types.ObjectId(),
      totalStock: 100,
      warehouseStock: 50,
      featured: false,
      business: businessId,
    });
    productId = product._id.toString();

    const otherBiz = await Business.create({
      name: "Negocio Externo",
      createdBy: adminId,
    });
    const foreignProduct = await Product.create({
      name: "Producto Externo",
      description: "Fuera del negocio",
      purchasePrice: 5,
      distributorPrice: 8,
      clientPrice: 12,
      category: new mongoose.Types.ObjectId(),
      totalStock: 30,
      warehouseStock: 30,
      featured: false,
      business: otherBiz._id,
    });
    foreignProductId = foreignProduct._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Branch.deleteMany({});
    await BranchStock.deleteMany({});
    await BranchTransfer.deleteMany({});
    await Business.deleteMany({});

    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await BranchStock.deleteMany({});
    await BranchTransfer.deleteMany({});

    await BranchStock.create({
      business: businessId,
      branch: originBranchId,
      product: productId,
      quantity: 20,
    });
  });

  it("crea una transferencia y ajusta stocks", async () => {
    const payload = {
      originBranchId,
      targetBranchId,
      items: [
        {
          product: productId,
          quantity: 5,
        },
      ],
      notes: "Reabastecer góndola",
    };

    const res = await request(app)
      .post("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send(payload)
      .expect(201);

    expect(res.body.transfer).toBeTruthy();
    expect(res.body.transfer.status).toBe("completed");
    expect(res.body.transfer.approvedBy.toString()).toBe(adminId.toString());

    const originStock = await BranchStock.findOne({
      business: businessId,
      branch: originBranchId,
      product: productId,
    });
    const targetStock = await BranchStock.findOne({
      business: businessId,
      branch: targetBranchId,
      product: productId,
    });

    expect(originStock.quantity).toBe(15);
    expect(targetStock.quantity).toBe(5);
  });

  it("falla sin header x-business-id", async () => {
    const res = await request(app)
      .post("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    expect(res.body.message).toContain("Falta x-business-id");
  });

  it("rechaza si no hay stock suficiente en la sede origen", async () => {
    await BranchStock.updateOne(
      { business: businessId, branch: originBranchId, product: productId },
      { $set: { quantity: 2 } }
    );

    const res = await request(app)
      .post("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        originBranchId,
        targetBranchId,
        items: [{ product: productId, quantity: 5 }],
      })
      .expect(400);

    expect(res.body.message).toContain("Stock insuficiente");

    const originStock = await BranchStock.findOne({
      business: businessId,
      branch: originBranchId,
      product: productId,
    });
    expect(originStock.quantity).toBe(2);
  });

  it("devuelve error si la sede no pertenece al negocio", async () => {
    const otherBusiness = await Business.create({
      name: "Otro negocio",
      createdBy: adminId,
    });
    const foreignBranch = await Branch.create({
      business: otherBusiness._id,
      name: "Sede externa",
    });

    const res = await request(app)
      .post("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        originBranchId,
        targetBranchId: foreignBranch._id.toString(),
        items: [{ product: productId, quantity: 1 }],
      })
      .expect(404);

    expect(res.body.message).toContain("Sede inválida");
  });

  it("rechaza transferencia con producto de otro negocio", async () => {
    const res = await request(app)
      .post("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        originBranchId,
        targetBranchId,
        items: [{ product: foreignProductId, quantity: 1 }],
      })
      .expect(404);

    expect(res.body.message).toContain("Producto no encontrado");
  });

  it("lista las transferencias creadas", async () => {
    await request(app)
      .post("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        originBranchId,
        targetBranchId,
        items: [{ product: productId, quantity: 3 }],
      })
      .expect(201);

    const res = await request(app)
      .get("/api/branch-transfers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty("originBranch");
    expect(res.body.data[0]).toHaveProperty("targetBranch");
    expect(res.body.data[0]).toHaveProperty("items");
  });
});
