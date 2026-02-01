import { RegisterSaleUseCase } from "./src/application/use-cases/RegisterSaleUseCase.js";
import { SaleRepository } from "./src/infrastructure/database/repositories/SaleRepository.js";

// --- MOCK REPOSITORY ---
// Monkey-patch create to avoid DB connection
SaleRepository.prototype.create = async function (saleData, session) {
  console.log("📝 [MOCK] SaleRepository.create called.");
  console.log("   Data to save:", {
    distributorPrice: saleData.distributorPrice,
    distributorProfit: saleData.distributorProfit,
    adminProfit: saleData.adminProfit,
    netProfit: saleData.netProfit,
    totalProfit: saleData.totalProfit,
  });
  // Return the data as if it were the saved document
  return { _id: "mock-sale-id", ...saleData };
};

// --- MOCK DATA ---
const input = {
  user: { id: "user-123", name: "TestUser" },
  businessId: "biz-123",
  // Product with cost basis
  product: {
    _id: "prod-1",
    name: "Test Product",
    purchasePrice: 60, // Costo base
    averageCost: 60,
  },
  quantity: 2,
  salePrice: 100, // Precio venta al público
  distributorProfitPercentage: 20, // 20% Comisión
  shippingCost: 5000,
  notes: "Test Sale Hexagonal",
};

const mockSession = {
  // Mock mongo session object
  inTransaction: () => true,
};

// --- EXECUTE ---
async function runTest() {
  console.log("🚀 Starting Hexagonal Logic Test...");
  console.log("-----------------------------------");
  console.log("INPUT:", JSON.stringify(input, null, 2));

  try {
    const useCase = new RegisterSaleUseCase();
    const result = await useCase.execute(input, mockSession);

    console.log("-----------------------------------");
    console.log("✅ RESULT (JSON):");
    console.log(JSON.stringify(result, null, 2));

    // --- ASSERTIONS (Visual) ---
    console.log("-----------------------------------");
    console.log("🔍 MANUAL VERIFICATION:");

    // 1. Distributor Price (What dist pays)
    // Rule: Price * (1 - 0.20) = 100 * 0.8 = 80
    console.log(`Distributor Price (Expected: 80): ${result.distributorPrice}`);

    // 2. Distributor Profit
    // Rule: (Price - DistPrice) * Qty = (100 - 80) * 2 = 20 * 2 = 40
    console.log(
      `Distributor Profit (Expected: 40): ${result.distributorProfit}`,
    );

    // 3. Admin Profit
    // Rule: (Revenue - Cost - DistProfit)
    // Revenue = 100 * 2 = 200
    // Cost = 60 * 2 = 120
    // DistProfit = 40
    // AdminProfit = 200 - 120 - 40 = 40
    console.log(`Admin Profit (Expected: 40): ${result.adminProfit}`);

    // 4. Net Profit
    // Rule: TotalProfit - Shipping
    // TotalProfit = DistProfit(40) + AdminProfit(40) = 80
    // NetProfit = 80 - 5000 = -4920 (Loss due to high shipping mock)
    console.log(`Net Profit (Expected: -4920): ${result.netProfit}`);
  } catch (error) {
    console.error("❌ ERROR:", error);
  }
}

runTest();
