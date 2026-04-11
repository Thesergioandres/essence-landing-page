import { jest } from "@jest/globals";

const executeStandardMock = jest.fn();
const executePromotionMock = jest.fn();
const startSessionMock = jest.fn();

const registerStandardUseCaseModulePath =
  "../src/application/use-cases/sales/RegisterStandardSaleUseCase.js";

const registerPromotionUseCaseModulePath =
  "../src/application/use-cases/sales/RegisterPromotionSaleUseCase.js";

const registerSaleControllerModulePath =
  "../../../src/infrastructure/http/controllers/RegisterSaleController.js";

jest.unstable_mockModule("mongoose", () => ({
  default: {
    connection: {
      getClient: jest.fn(() => ({
        db: () => ({
          admin: () => ({
            command: jest.fn().mockResolvedValue({}),
          }),
        }),
      })),
    },
    startSession: startSessionMock,
  },
}));

jest.unstable_mockModule(registerStandardUseCaseModulePath, () => ({
  RegisterStandardSaleUseCase: class {
    async execute(input, session) {
      return executeStandardMock(input, session);
    }
  },
}));

jest.unstable_mockModule(registerPromotionUseCaseModulePath, () => ({
  RegisterPromotionSaleUseCase: class {
    async execute(input, session) {
      return executePromotionMock(input, session);
    }
  },
}));

const { registerSale, registerPromotionSale } = await import(
  registerSaleControllerModulePath
);

const buildRes = () => {
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };

  return res;
};

describe("RegisterSaleController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    executeStandardMock.mockReset();
    executePromotionMock.mockReset();
  });

  it("registra venta estandar y responde 201", async () => {
    executeStandardMock.mockResolvedValue({ saleId: "sale-1" });

    const req = {
      user: { _id: "distributor-1", role: "distribuidor" },
      businessId: "business-1",
      body: {
        items: [{ productId: "product-1", quantity: 1, salePrice: 100 }],
        paymentMethodId: "cash",
      },
      headers: { "x-business-id": "business-1" },
    };
    const res = buildRes();
    const next = jest.fn();

    await registerSale(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.payload?.success).toBe(true);
    expect(executeStandardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "business-1",
        distributorId: "distributor-1",
      }),
      null,
    );
  });

  it("registra venta de promocion usando su caso de uso", async () => {
    executePromotionMock.mockResolvedValue({ saleGroupId: "group-1" });

    const req = {
      user: { id: "admin-1", role: "admin" },
      businessId: "business-1",
      body: {
        distributorId: "distributor-2",
        items: [{ productId: "product-2", quantity: 2, salePrice: 50 }],
      },
      headers: { "x-business-id": "business-1" },
    };
    const res = buildRes();
    const next = jest.fn();

    await registerPromotionSale(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.payload?.data).toEqual({ saleGroupId: "group-1" });
    expect(executePromotionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distributorId: "distributor-2",
      }),
      null,
    );
  });

  it("envia errores al middleware next", async () => {
    executeStandardMock.mockRejectedValue(new Error("boom"));

    const req = {
      user: { id: "admin-1", role: "admin" },
      businessId: "business-1",
      body: {
        items: [{ productId: "product-1", quantity: 1, salePrice: 10 }],
      },
      headers: { "x-business-id": "business-1" },
    };
    const res = buildRes();
    const next = jest.fn();

    await registerSale(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("boom");
  });
});
