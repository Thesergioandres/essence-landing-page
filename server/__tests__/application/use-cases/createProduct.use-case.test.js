import { jest } from "@jest/globals";
import { CreateProductUseCase } from "../../../src/application/use-cases/CreateProductUseCase.js";

describe("CreateProductUseCase", () => {
  it("rechaza cuando falta el nombre del producto", async () => {
    const useCase = new CreateProductUseCase();

    await expect(
      useCase.execute({ purchasePrice: 1200 }, null),
    ).rejects.toThrow("Product name is required");
  });

  it("rechaza cuando el costo es negativo", async () => {
    const useCase = new CreateProductUseCase();

    await expect(
      useCase.execute({ name: "Vape X", purchasePrice: -1 }, null),
    ).rejects.toThrow("Purchase price cannot be negative");
  });

  it("persiste el producto usando el gateway de persistencia", async () => {
    const createMock = jest.fn().mockResolvedValue({
      _id: "product-1",
      name: "Vape X",
      purchasePrice: 100,
    });

    const useCase = new CreateProductUseCase();
    useCase.productRepository = { create: createMock };

    const session = { id: "session-1" };
    const payload = { name: "Vape X", purchasePrice: 100 };

    const result = await useCase.execute(payload, session);

    expect(createMock).toHaveBeenCalledWith(payload, session);
    expect(result).toEqual({
      _id: "product-1",
      name: "Vape X",
      purchasePrice: 100,
    });
  });
});
