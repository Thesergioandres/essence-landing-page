import mongoose from "mongoose";
import { requirePermission } from "../../middleware/business.middleware.js";

const run = async (middleware, reqOverrides = {}) => {
  const req = {
    params: {},
    body: {},
    query: {},
    ...reqOverrides,
  };

  let statusCode = null;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  const next = () => {
    nextCalled = true;
  };

  await middleware(req, res, next);
  return { statusCode, payload, nextCalled };
};

const branchId = () => new mongoose.Types.ObjectId().toString();

describe("requirePermission middleware", () => {
  it("permite a super_admin sin membership", async () => {
    const { nextCalled, statusCode } = await run(
      requirePermission({ module: "products", action: "create" }),
      { user: { role: "super_admin" } }
    );
    expect(statusCode).toBeNull();
    expect(nextCalled).toBe(true);
  });

  it("bloquea create de products a empleado sin override", async () => {
    const { statusCode, payload, nextCalled } = await run(
      requirePermission({ module: "products", action: "create" }),
      {
        user: { role: "empleado" },
        membership: { role: "empleado", permissions: {} },
      }
    );
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(payload?.module).toBe("products");
  });

  it("permite create de products cuando hay override", async () => {
    const { nextCalled, statusCode } = await run(
      requirePermission({ module: "products", action: "create" }),
      {
        user: { role: "empleado" },
        membership: {
          role: "empleado",
          permissions: { products: { create: true } },
        },
      }
    );
    expect(statusCode).toBeNull();
    expect(nextCalled).toBe(true);
  });

  it("respeta allowedBranches cuando se envía branch fuera de alcance", async () => {
    const allowed = branchId();
    const denied = branchId();

    const mw = requirePermission({
      module: "sales",
      action: "create",
      branchResolver: (req) => req.body.branchId,
    });

    const deniedResult = await run(mw, {
      body: { branchId: denied },
      user: { role: "empleado" },
      membership: {
        role: "empleado",
        permissions: { sales: { create: true } },
        allowedBranches: [allowed],
      },
    });
    expect(deniedResult.statusCode).toBe(403);
    expect(deniedResult.payload?.message).toMatch(/sede/i);

    const allowedResult = await run(mw, {
      body: { branchId: allowed },
      user: { role: "empleado" },
      membership: {
        role: "empleado",
        permissions: { sales: { create: true } },
        allowedBranches: [allowed],
      },
    });
    expect(allowedResult.statusCode).toBeNull();
    expect(allowedResult.nextCalled).toBe(true);
  });
});
