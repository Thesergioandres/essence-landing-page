import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const loginExecuteMock = jest.fn();
const registerExecuteMock = jest.fn();
const userFindByIdMock = jest.fn();

const loginUseCaseModulePath = "../src/application/use-cases/LoginUseCase.js";

const registerUserUseCaseModulePath =
  "../src/application/use-cases/RegisterUserUseCase.js";

const userPersistenceGatewayModulePath =
  "../src/application/use-cases/repository-gateways/UserPersistenceUseCase.js";

const jwtServiceModulePath =
  "../src/infrastructure/services/jwtToken.service.js";

const planLimitsModulePath =
  "../src/infrastructure/services/planLimits.service.js";

const membershipModelModulePath =
  "../src/infrastructure/database/models/Membership.js";

const userModelModulePath = "../src/infrastructure/database/models/User.js";

const authRoutesModulePath =
  "../../../src/infrastructure/http/routes/auth.routes.v2.js";

const jwtTokenServiceMock = {
  verifyRefreshToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  getTokenExpirationIso: jest.fn(),
  verifyAccessToken: jest.fn(),
};

jest.unstable_mockModule(loginUseCaseModulePath, () => ({
  LoginUseCase: class {
    async execute(email, password) {
      return loginExecuteMock(email, password);
    }
  },
}));

jest.unstable_mockModule(registerUserUseCaseModulePath, () => ({
  RegisterUserUseCase: class {
    async execute(payload) {
      return registerExecuteMock(payload);
    }
  },
}));

jest.unstable_mockModule(userPersistenceGatewayModulePath, () => ({
  UserPersistenceUseCase: class {
    constructor() {
      return {
        findById: userFindByIdMock,
      };
    }
  },
}));

jest.unstable_mockModule(jwtServiceModulePath, () => ({
  jwtTokenService: jwtTokenServiceMock,
}));

jest.unstable_mockModule(planLimitsModulePath, () => ({
  VALID_BUSINESS_PLANS: ["starter", "pro", "enterprise"],
  getBusinessUsage: jest.fn().mockResolvedValue({ branches: 0, employees: 0 }),
  resolveBusinessLimits: jest.fn().mockResolvedValue({
    plan: "starter",
    limits: { branches: 1, employees: 2 },
    source: "plan",
  }),
}));

jest.unstable_mockModule(membershipModelModulePath, () => ({
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
  },
}));

jest.unstable_mockModule(userModelModulePath, () => ({
  default: {
    findById: jest.fn(),
  },
}));

const { default: authRoutesV2 } = await import(authRoutesModulePath);

const app = express();
app.use(express.json());
app.use("/api/v2/auth", authRoutesV2);
app.use((error, _req, res, _next) => {
  res.status(500).json({ message: error.message });
});

describe("Auth routes v2", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    loginExecuteMock.mockResolvedValue({
      token: "access-token",
      refreshToken: "refresh-token",
      user: { _id: "user-1", email: "user@test.com", role: "admin" },
    });

    registerExecuteMock.mockResolvedValue({
      token: "access-token",
      user: { _id: "user-2", email: "new@test.com", role: "admin" },
    });

    userFindByIdMock.mockResolvedValue({
      _id: "user-1",
      role: "admin",
      memberships: [{ business: "business-1" }],
    });

    jwtTokenServiceMock.verifyRefreshToken.mockReturnValue({
      id: "user-1",
      businessId: "business-1",
    });
    jwtTokenServiceMock.generateAccessToken.mockReturnValue("new-access-token");
    jwtTokenServiceMock.generateRefreshToken.mockReturnValue(
      "new-refresh-token",
    );
    jwtTokenServiceMock.getTokenExpirationIso.mockReturnValue(
      "2026-12-31T00:00:00.000Z",
    );
  });

  it("POST /api/v2/auth/login usa LoginUseCase", async () => {
    const response = await request(app)
      .post("/api/v2/auth/login")
      .send({ email: "user@test.com", password: "secret" });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token", "access-token");
    expect(loginExecuteMock).toHaveBeenCalledWith("user@test.com", "secret");
  });

  it("POST /api/v2/auth/register usa RegisterUserUseCase", async () => {
    const response = await request(app)
      .post("/api/v2/auth/register")
      .set("x-business-id", "business-1")
      .send({
        name: "Nuevo",
        email: "new@test.com",
        password: "secret",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("token", "access-token");
    expect(registerExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "business-1",
        email: "new@test.com",
      }),
    );
  });

  it("POST /api/v2/auth/refresh valida ausencia de refresh token", async () => {
    const response = await request(app).post("/api/v2/auth/refresh").send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/refresh token requerido/i);
  });

  it("POST /api/v2/auth/refresh emite nuevos tokens con jwtToken.service mockeado", async () => {
    const response = await request(app)
      .post("/api/v2/auth/refresh")
      .send({ refreshToken: "refresh-token" });

    expect(response.status).toBe(200);
    expect(jwtTokenServiceMock.verifyRefreshToken).toHaveBeenCalledWith(
      "refresh-token",
    );
    expect(jwtTokenServiceMock.generateAccessToken).toHaveBeenCalledWith(
      "user-1",
      "admin",
      "business-1",
    );
    expect(response.body).toHaveProperty("token", "new-access-token");
    expect(response.body).toHaveProperty("refreshToken", "new-refresh-token");
    expect(response.body).toHaveProperty(
      "refreshExpiresAt",
      "2026-12-31T00:00:00.000Z",
    );
  });

  it("POST /api/v2/auth/refresh rechaza refresh invalido", async () => {
    jwtTokenServiceMock.verifyRefreshToken.mockImplementation(() => {
      throw new Error("invalid");
    });

    const response = await request(app)
      .post("/api/v2/auth/refresh")
      .send({ refreshToken: "bad-token" });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(
      /inválido|invalido|invÃ¡lido|invÃƒÂ¡lido/i,
    );
  });

  it("POST /api/v2/auth/logout responde cierre de sesion", async () => {
    const response = await request(app).post("/api/v2/auth/logout").send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ success: true }));
  });
});
