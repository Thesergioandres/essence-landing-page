import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import Branch from "../models/Branch.js";
import BranchStock from "../models/BranchStock.js";
import Business from "../models/Business.js";
import InventoryEntry from "../models/InventoryEntry.js";
import Product from "../src/infrastructure/database/models/Product.js";
import User from "../src/infrastructure/database/models/User.js";

let app;

const createProduct = async (businessId) => {
  return Product.create({
    name: "Prod",
    description: "Desc",
    purchasePrice: 10,
    distributorPrice: 12,
    clientPrice: 15,
    category: new mongoose.Types.ObjectId(),
    business: businessId,
    totalStock: 0,
    warehouseStock: 0,
  });
};

describe("Inventory receipts", () => {
  let mongo;
  let token;
  let businessId;
  let productId;
  let branchId;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    const mod = await import("../server.js");
    app = mod.default;

    const hashed = await bcrypt.hash("password123", 10);
    const admin = await User.create({
      name: "Admin Inv",
      email: "admin.inv@test.com",
      password: hashed,
      role: "admin",
      status: "active",
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.inv@test.com", password: "password123" })
      .expect(200);
    token = login.body.token;

    const business = await Business.create({
      name: "Biz Inv",
      createdBy: admin._id,
      config: { features: { inventory: true } },
    });
    businessId = business._id.toString();

    const branch = await Branch.create({
      business: businessId,
      name: "Sede A",
    });
    branchId = branch._id.toString();

    const product = await createProduct(businessId);
    productId = product._id.toString();
  });

  afterAll(async () => {
    await InventoryEntry.deleteMany({});
    await BranchStock.deleteMany({});
    await Branch.deleteMany({});
    await Product.deleteMany({});
    await Business.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("registra entrada a sede y ajusta stock", async () => {
    const res = await request(app)
      .post("/api/inventory/receipts")
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .send({
        product: productId,
        quantity: 5,
        branch: branchId,
        notes: "Ingreso",
      })
      .expect(201);

    expect(res.body.entry.destination).toBe("branch");

    const updatedProduct = await Product.findById(productId);
    expect(updatedProduct.totalStock).toBe(5);

    const stock = await BranchStock.findOne({
      business: businessId,
      branch: branchId,
      product: productId,
    });
    expect(stock.quantity).toBe(5);
  });

  it("registra entrada a bodega si no hay sede", async () => {
    const res = await request(app)
      .post("/api/inventory/receipts")
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .send({ product: productId, quantity: 3 })
      .expect(201);

    expect(res.body.entry.destination).toBe("warehouse");

    const updatedProduct = await Product.findById(productId);
    expect(updatedProduct.warehouseStock).toBe(3);
    expect(updatedProduct.totalStock).toBe(8);
  });

  it("lista las entradas filtradas por producto", async () => {
    const res = await request(app)
      .get(`/api/inventory/receipts?productId=${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .expect(200);

    expect(res.body.entries.length).toBeGreaterThan(0);
    expect(res.body.entries[0]).toHaveProperty("product");
  });
});
