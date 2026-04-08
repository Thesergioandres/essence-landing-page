import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { businessContext } from "../middleware/business.middleware.js";
import Business from "../models/Business.js";
import Membership from "../models/Membership.js";
import User from "../src/infrastructure/database/models/User.js";

describe("businessContext middleware - owner_inactive", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    await Promise.all([
      Business.deleteMany({}),
      Membership.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  const runMiddleware = async (req) => {
    let statusCode = null;
    let jsonPayload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
        return this;
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await businessContext(req, res, next);
    return { statusCode, jsonPayload, nextCalled };
  };

  it("permite acceso a distribuidor cuando el owner está activo", async () => {
    const owner = await User.create({
      name: "Owner",
      email: "o@x.com",
      password: "123456",
      role: "super_admin",
      status: "active",
    });
    const biz = await Business.create({ name: "Biz", createdBy: owner._id });
    await Membership.create({
      user: owner._id,
      business: biz._id,
      role: "admin",
      status: "active",
    });

    const distributor = await User.create({
      name: "Dist",
      email: "d@x.com",
      password: "123456",
      role: "distribuidor",
      status: "active",
    });
    await Membership.create({
      user: distributor._id,
      business: biz._id,
      role: "distribuidor",
      status: "active",
    });

    const { statusCode, nextCalled } = await runMiddleware({
      headers: { "x-business-id": biz._id.toString() },
      query: {},
      user: { id: distributor._id.toString(), role: "distribuidor" },
    });

    expect(statusCode).toBeNull();
    expect(nextCalled).toBe(true);
  });

  it("bloquea distribuidor cuando el owner está inactivo", async () => {
    const owner = await User.create({
      name: "Owner",
      email: "o2@x.com",
      password: "123456",
      role: "super_admin",
      status: "suspended",
      active: false,
    });
    const biz = await Business.create({ name: "Biz2", createdBy: owner._id });
    await Membership.create({
      user: owner._id,
      business: biz._id,
      role: "admin",
      status: "active",
    });

    const distributor = await User.create({
      name: "Dist",
      email: "d2@x.com",
      password: "123456",
      role: "distribuidor",
      status: "active",
    });
    await Membership.create({
      user: distributor._id,
      business: biz._id,
      role: "distribuidor",
      status: "active",
    });

    const { statusCode, jsonPayload, nextCalled } = await runMiddleware({
      headers: { "x-business-id": biz._id.toString() },
      query: {},
      user: { id: distributor._id.toString(), role: "distribuidor" },
    });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload?.code).toBe("owner_inactive");
  });

  it("super_admin en test sin businessId pasa el middleware", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    const { statusCode, nextCalled } = await runMiddleware({
      headers: {},
      query: {},
      user: { id: "super", role: "super_admin" },
    });

    expect(statusCode).toBeNull();
    expect(nextCalled).toBe(true);

    process.env.NODE_ENV = originalEnv;
  });
});
