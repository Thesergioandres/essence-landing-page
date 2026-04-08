import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import Business from "../models/Business.js";
import DistributorStock from "../models/DistributorStock.js";
import Membership from "../models/Membership.js";
import Product from "../src/infrastructure/database/models/Product.js";
import User from "../src/infrastructure/database/models/User.js";
import app from "../server.js";

const createUser = async ({ email, role }) => {
  const password = await bcrypt.hash("password123", 10);
  return User.create({
    name: email,
    email,
    password,
    role,
    active: true,
    status: "active",
  });
};

const login = async (email) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "password123" })
    .expect(200);
  return res.body.token;
};

describe("Stock transfer between distributors - permissions", () => {
  let mongo;
  let businessId;
  let productId;
  let dist1Token;
  let dist2Id;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();

    await User.deleteMany({});
    await Product.deleteMany({});
    await Business.deleteMany({});
    await Membership.deleteMany({});
    await DistributorStock.deleteMany({});

    const dist1 = await createUser({
      email: "dist1@t.com",
      role: "distribuidor",
    });
    dist1Token = await login("dist1@t.com");
    const dist2 = await createUser({
      email: "dist2@t.com",
      role: "distribuidor",
    });
    dist2Id = dist2._id.toString();

    const business = await Business.create({
      name: "Biz",
      createdBy: dist1._id,
    });
    businessId = business._id.toString();

    // memberships
    await Membership.create({
      user: dist1._id,
      business: businessId,
      role: "distribuidor",
      status: "active",
    });
    await Membership.create({
      user: dist2._id,
      business: businessId,
      role: "distribuidor",
      status: "active",
    });

    // producto
    const product = await Product.create({
      name: "Prod",
      description: "Producto de prueba",
      purchasePrice: 10,
      distributorPrice: 15,
      clientPrice: 20,
      category: new mongoose.Types.ObjectId(),
      totalStock: 50,
      warehouseStock: 50,
      featured: false,
      business: businessId,
    });
    productId = product._id.toString();

    // stock inicial para dist1
    await DistributorStock.create({
      distributor: dist1._id,
      product: productId,
      quantity: 2,
      business: businessId,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("rechaza a distribuidor sin permiso transfers/create", async () => {
    const res = await request(app)
      .post("/api/stock/transfer")
      .set("Authorization", `Bearer ${dist1Token}`)
      .set("x-business-id", businessId)
      .send({ toDistributorId: dist2Id, productId, quantity: 1 })
      .expect(403);

    expect(res.body.message).toContain("Permiso denegado");
  });

  it("distribuidor con permiso transfers/create puede transferir", async () => {
    // Otorgar permiso granular
    await Membership.findOneAndUpdate(
      {
        user: (await User.findOne({ email: "dist1@t.com" }))._id,
        business: businessId,
      },
      { $set: { permissions: { transfers: { create: true } } } }
    );

    const res = await request(app)
      .post("/api/stock/transfer")
      .set("Authorization", `Bearer ${dist1Token}`)
      .set("x-business-id", businessId)
      .send({ toDistributorId: dist2Id, productId, quantity: 1 })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
