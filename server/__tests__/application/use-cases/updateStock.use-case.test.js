import { jest } from "@jest/globals";
import { UpdateStockUseCase } from "../../../src/application/use-cases/UpdateStockUseCase.js";
import { InventoryService } from "../../../src/domain/services/InventoryService.js";

describe("UpdateStockUseCase", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lanza error cuando el producto no existe", async () => {
    const useCase = new UpdateStockUseCase();
    useCase.productRepository = {
      findByIdForBusiness: jest.fn().mockResolvedValue(null),
      updateStockForBusiness: jest.fn(),
    };

    await expect(
      useCase.execute(
        {
          productId: "missing",
          quantityChange: 1,
          businessId: "business-1",
        },
        null,
      ),
    ).rejects.toThrow("Product not found");
  });

  it("valida stock al descontar y persiste con el gateway", async () => {
    const calculateSpy = jest
      .spyOn(InventoryService, "calculateNewStockLevel")
      .mockImplementation(() => 8);

    const findByIdMock = jest.fn().mockResolvedValue({ totalStock: 10 });
    const updateStockMock = jest.fn().mockResolvedValue({
      _id: "product-1",
      totalStock: 8,
    });

    const useCase = new UpdateStockUseCase();
    useCase.productRepository = {
      findByIdForBusiness: findByIdMock,
      updateStockForBusiness: updateStockMock,
    };

    const session = { id: "session-1" };
    const result = await useCase.execute(
      {
        productId: "product-1",
        quantityChange: -2,
        businessId: "business-1",
      },
      session,
    );

    expect(calculateSpy).toHaveBeenCalledWith(10, -2);
    expect(findByIdMock).toHaveBeenCalledWith("product-1", "business-1", {
      bypassBusinessScope: false,
      session,
    });
    expect(updateStockMock).toHaveBeenCalledWith(
      "product-1",
      "business-1",
      -2,
      session,
      { bypassBusinessScope: false },
    );
    expect(result).toEqual({ _id: "product-1", totalStock: 8 });
  });
});
