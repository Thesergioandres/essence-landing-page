import { jest } from "@jest/globals";

const getDistributorCommissionInfoMock = jest.fn();
const resolveDistributorCommissionMock = jest.fn();

const distributorPricingModulePath =
  "../src/infrastructure/services/distributorPricing.service.js";

const commissionPolicyModulePath =
  "../src/domain/services/CommissionPolicyService.js";

const registerSaleUseCaseModulePath =
  "../../../src/application/use-cases/sales/RegisterSaleUseCase.js";

jest.unstable_mockModule(distributorPricingModulePath, () => ({
  getDistributorCommissionInfo: getDistributorCommissionInfoMock,
}));

jest.unstable_mockModule(commissionPolicyModulePath, () => ({
  CommissionPolicyService: {
    resolveDistributorCommission: resolveDistributorCommissionMock,
  },
}));

const { RegisterSaleUseCase } = await import(registerSaleUseCaseModulePath);

describe("RegisterSaleUseCase", () => {
  afterEach(() => {
    jest.clearAllMocks();
    getDistributorCommissionInfoMock.mockReset();
    resolveDistributorCommissionMock.mockReset();
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

  it("prioriza comision fija del distribuidor sobre reglas variables", async () => {
    getDistributorCommissionInfoMock.mockResolvedValue({
      isCommissionFixed: true,
      customCommissionRate: 30,
    });

    resolveDistributorCommissionMock.mockImplementation((payload) => ({
      baseCommissionPercentage:
        payload.customCommissionRate ?? payload.requestedCommissionRate ?? 20,
      distributorCommissionBonus: 0,
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
          distributorId: "distributor-1",
          items: [{ productId: "product-1", quantity: 1, salePrice: 100 }],
        },
        null,
      ),
    ).rejects.toThrow("STOP_AFTER_COMMISSION_ASSERT");

    expect(getDistributorCommissionInfoMock).toHaveBeenCalledWith(
      "distributor-1",
      "business-1",
    );

    expect(resolveDistributorCommissionMock).toHaveBeenNthCalledWith(1, {
      requestedCommissionRate: 20,
    });

    expect(resolveDistributorCommissionMock).toHaveBeenNthCalledWith(2, {
      isCommissionFixed: true,
      customCommissionRate: 30,
    });
  });
});
