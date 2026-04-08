import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { protect } from "../middleware/auth.middleware.js";
import User from "../src/infrastructure/database/models/User.js";

const buildRes = () => {
  const res = {};
  res.statusCode = null;
  res.payload = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

const runProtect = async (userDoc, tokenPayload = {}) => {
  const res = buildRes();
  const next = jest.fn();
  const token = jwt.sign(
    { id: userDoc._id, ...tokenPayload },
    process.env.JWT_SECRET || "test_secret",
    {
      expiresIn: "1h",
    }
  );

  jest.spyOn(User, "findById").mockReturnValue({
    select: jest.fn().mockResolvedValue(userDoc),
  });

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };

  await protect(req, res, next);
  return { req, res, next };
};

describe("protect middleware - estados de cuenta", () => {
  const SECRET = "test_secret";
  const now = Date.now();
  const makeUser = (overrides = {}) => ({
    _id: "u1",
    role: "admin",
    status: "active",
    active: true,
    subscriptionExpiresAt: new Date(now + 60_000),
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  });

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  let originalEnv;
  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  it("permite acceso cuando el usuario está activo", async () => {
    const user = makeUser();
    const { next, res } = await runProtect(user);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("bloquea cuando la suscripción expiró y marca expired", async () => {
    const user = makeUser({ subscriptionExpiresAt: new Date(now - 10_000) });
    const { next, res } = await runProtect(user);
    expect(next).not.toHaveBeenCalled();
    expect(user.status).toBe("expired");
    expect(user.save).toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.payload?.code).toBe("expired");
  });

  it("bloquea estados paused/suspended/pending", async () => {
    const blockedStates = ["paused", "suspended", "pending"];
    for (const state of blockedStates) {
      const user = makeUser({ status: state, active: false });
      const { next, res } = await runProtect(user);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.payload?.code).toBe(state);
    }
  });

  it("permite a god aunque el estado no sea active", async () => {
    const user = makeUser({ role: "god", status: "suspended", active: false });
    const { next, res } = await runProtect(user);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });
});
