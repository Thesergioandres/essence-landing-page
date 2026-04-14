import { jest } from "@jest/globals";

const getEmployeeCommissionInfoMock = jest.fn();
const resolveEmployeeCommissionMock = jest.fn();

const employeePricingModulePath =
  "../src/infrastructure/services/employeePricing.service.js";

const commissionPolicyModulePath =
  "../src/domain/services/CommissionPolicyService.js";

const registerSaleUseCaseModulePath =
  "../../../src/application/use-cases/sales/RegisterSaleUseCase.js";

jest.unstable_mockModule(employeePricingModulePath, () => ({
  getEmployeeCommissionInfo: getEmployeeCommissionInfoMock,
}));

jest.unstable_mockModule(commissionPolicyModulePath, () => ({
  CommissionPolicyService: {
    resolveEmployeeCommission: resolveEmployeeCommissionMock,
  },
}));

const { RegisterSaleUseCase } = await import(registerSaleUseCaseModulePath);

describe("RegisterSaleUseCase", () => {
  afterEach(() => {
    jest.clearAllMocks();
    getEmployeeCommissionInfoMock.mockReset();
    resolveEmployeeCommissionMock.mockReset();
  });

  it("rechaza cuando no se envian items", async () => {
    const useCase = new RegisterSaleUseCase({
      productRepository: { findById: jest.fn() },
      saleWriteRepository: {},
    });

    await expect(
      useCase.execute(
        {
          user: { id: "user-1", role: "admin" },
          businessId: "business-1",
          items: [],
        },
        null,
      ),
    ).rejects.toThrow("No items provided for sale.");
  });

  it("prioriza comision fija del employee sobre reglas variables", async () => {
    getEmployeeCommissionInfoMock.mockResolvedValue({
      isCommissionFixed: true,
      customCommissionRate: 30,
    });

    resolveEmployeeCommissionMock.mockImplementation((payload) => ({
      baseCommissionPercentage:
        payload.customCommissionRate ?? payload.requestedCommissionRate ?? 20,
      employeeCommissionBonus: 0,
    }));

    const useCase = new RegisterSaleUseCase({
      productRepository: {
        findById: jest
          .fn()
          .mockRejectedValue(new Error("STOP_AFTER_COMMISSION_ASSERT")),
      },
      saleWriteRepository: {},
    });

    await expect(
      useCase.execute(
        {
          user: { id: "admin-1", role: "admin" },
          businessId: "business-1",
          employeeId: "employee-1",
          items: [{ productId: "product-1", quantity: 1, salePrice: 100 }],
        },
        null,
      ),
    ).rejects.toThrow("STOP_AFTER_COMMISSION_ASSERT");

    expect(getEmployeeCommissionInfoMock).toHaveBeenCalledWith(
      "employee-1",
      "business-1",
    );

    expect(resolveEmployeeCommissionMock).toHaveBeenNthCalledWith(1, {
      requestedCommissionRate: 20,
    });

    expect(resolveEmployeeCommissionMock).toHaveBeenNthCalledWith(2, {
      isCommissionFixed: true,
      customCommissionRate: 30,
    });
  });
});
