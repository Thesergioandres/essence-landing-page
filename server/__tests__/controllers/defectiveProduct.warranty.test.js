/**
 * Tests del sistema de garantías de productos defectuosos
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/defectiveProduct.warranty.test.js
 */

import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";

// Mock de Redis
jest.mock("../../config/redis.js", () => ({
  initRedis: jest.fn(),
  getRedisClient: jest.fn(() => null),
}));

const { default: app } = await import("../../server.js");
const { default: User } = await import("../../models/User.js");
const { default: Business } = await import("../../models/Business.js");
const { default: Product } = await import("../../models/Product.js");
const { default: Category } = await import("../../models/Category.js");
const { default: Membership } = await import("../../models/Membership.js");
const { default: DefectiveProduct } =
  await import("../../models/DefectiveProduct.js");
const { default: Sale } = await import("../../models/Sale.js");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Defective Product Warranty System", () => {
  let adminUser;
  let adminToken;
  let testBusiness;
  let testCategory;
  let testProduct;
  let testReport;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear usuario admin de prueba
    adminUser = await User.findOneAndUpdate(
      { email: "warranty-test-admin@example.com" },
      {
        email: "warranty-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Warranty Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true },
    );

    // Crear negocio de prueba
    testBusiness = await Business.findOneAndUpdate(
      { name: "Warranty Test Business" },
      {
        name: "Warranty Test Business",
        createdBy: adminUser._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true },
    );

    // Crear membership
    await Membership.findOneAndUpdate(
      { user: adminUser._id, business: testBusiness._id },
      {
        user: adminUser._id,
        business: testBusiness._id,
        role: "admin",
        status: "active",
      },
      { upsert: true },
    );

    // Crear categoría de prueba
    testCategory = await Category.findOneAndUpdate(
      { name: "Test Category Warranty", business: testBusiness._id },
      {
        name: "Test Category Warranty",
        business: testBusiness._id,
        slug: "test-category-warranty",
      },
      { upsert: true, new: true },
    );

    // Crear producto de prueba
    // Primero eliminamos si existe
    await Product.deleteOne({
      name: "Test Product Warranty",
      business: testBusiness._id,
    });

    // Luego creamos uno nuevo
    testProduct = await Product.create({
      name: "Test Product Warranty",
      description: "Producto de prueba para tests de garantía",
      business: testBusiness._id,
      category: testCategory._id,
      warehouseStock: 100,
      totalStock: 100,
      purchasePrice: 1000,
      distributorPrice: 1200,
    });

    adminToken = jwt.sign(
      { userId: adminUser._id, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    if (testBusiness?._id) {
      await DefectiveProduct.deleteMany({ business: testBusiness._id });
      await Product.deleteMany({ business: testBusiness._id });
      await Category.deleteMany({ business: testBusiness._id });
      await Membership.deleteMany({ business: testBusiness._id });
      await Business.findByIdAndDelete(testBusiness._id);
      await Sale.deleteMany({ business: testBusiness._id });
    }

    if (adminUser?._id) {
      await User.findByIdAndDelete(adminUser._id);
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Crear un reporte de prueba antes de cada test
    testReport = await DefectiveProduct.create({
      business: testBusiness._id,
      product: testProduct._id,
      distributor: adminUser._id,
      quantity: 10,
      reason: "Test defective report",
      status: "confirmado",
      hasWarranty: true,
      warrantyStatus: "pending",
      lossAmount: 0,
      stockRestored: false,
      confirmedBy: adminUser._id,
      confirmedAt: new Date(),
    });

    // Resetear stock del producto
    await Product.findByIdAndUpdate(testProduct._id, {
      warehouseStock: 100,
      totalStock: 100,
    });
  });

  afterEach(async () => {
    // Limpiar reportes después de cada test
    await DefectiveProduct.deleteMany({ business: testBusiness._id });
    await Sale.deleteMany({ business: testBusiness._id });
  });

  describe("POST /api/v2/defective-products/:id/approve-warranty", () => {
    test("debe aprobar garantía y reponer stock a bodega", async () => {
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes: "Proveedor confirmó reposición" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Garantía aprobada");
      expect(response.body.report.warrantyStatus).toBe("approved");
      expect(response.body.report.stockRestored).toBe(true);
      expect(response.body.report.lossAmount).toBe(0);
      expect(response.body.newStock.warehouseStock).toBe(110); // 100 + 10

      // Verificar que el producto tenga el stock actualizado
      const updatedProduct = await Product.findById(testProduct._id);
      expect(updatedProduct.warehouseStock).toBe(110);
      expect(updatedProduct.totalStock).toBe(110);
    });

    test("debe fallar si el reporte no existe", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/v2/defective-products/${fakeId}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Reporte no encontrado");
    });

    test("debe fallar si el reporte no tiene garantía", async () => {
      // Crear reporte sin garantía
      const noWarrantyReport = await DefectiveProduct.create({
        business: testBusiness._id,
        product: testProduct._id,
        distributor: adminUser._id,
        quantity: 5,
        reason: "No warranty test",
        status: "confirmado",
        hasWarranty: false,
        confirmedBy: adminUser._id,
        confirmedAt: new Date(),
      });

      const response = await request(app)
        .put(
          `/api/v2/defective-products/${noWarrantyReport._id}/approve-warranty`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("no tiene garantía");
    });

    test("debe fallar si la garantía ya fue aprobada", async () => {
      // Aprobar la garantía primero
      await DefectiveProduct.findByIdAndUpdate(testReport._id, {
        warrantyStatus: "approved",
        stockRestored: true,
        stockRestoredAt: new Date(),
      });

      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("ya fue aprobada");
    });

    test("debe guardar las notas del admin", async () => {
      const adminNotes = "Proveedor envió reposición por correo";
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes });

      expect(response.status).toBe(200);
      expect(response.body.report.adminNotes).toBe(adminNotes);
    });
  });

  describe("POST /api/v2/defective-products/:id/reject-warranty", () => {
    test("debe reflejar en gastos una garantía de cliente marcada como pérdida total", async () => {
      const originalSale = await Sale.create({
        business: testBusiness._id,
        createdBy: adminUser._id,
        product: testProduct._id,
        quantity: 1,
        purchasePrice: 1000,
        distributorPrice: 1200,
        salePrice: 1500,
        paymentStatus: "confirmado",
      });

      const replacementProduct = await Product.create({
        name: "Warranty Expense Replacement",
        description: "Reemplazo para validar gastos",
        business: testBusiness._id,
        category: testCategory._id,
        warehouseStock: 50,
        totalStock: 50,
        purchasePrice: 900,
        distributorPrice: 1200,
        clientPrice: 1500,
      });

      const warrantyResponse = await request(app)
        .post("/api/v2/defective-products/warranty")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          saleItemId: originalSale._id,
          quantity: 1,
          reason: "Garantía pérdida total para gasto",
          replacementProductId: replacementProduct._id,
          replacementPrice: 1500,
          replacementSource: "warehouse",
        });

      expect(warrantyResponse.status).toBe(201);

      const reportId = warrantyResponse.body?.data?.report?._id;
      expect(reportId).toBeTruthy();

      const rejectResponse = await request(app)
        .put(`/api/v2/defective-products/${reportId}/reject-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes: "Proveedor rechazó garantía" });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body?.report?.warrantyStatus).toBe("rejected");
      expect(Number(rejectResponse.body?.lossAmount || 0)).toBeGreaterThan(0);

      const expensesResponse = await request(app)
        .get("/api/v2/expenses")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(expensesResponse.status).toBe(200);

      const expenses =
        expensesResponse.body?.data?.expenses ||
        expensesResponse.body?.expenses ||
        [];

      const defectiveExpense = expenses.find(
        (expense) =>
          expense?._id === `defective-${reportId}` &&
          expense?.type === "Pérdida - Defectuoso",
      );

      expect(defectiveExpense).toBeTruthy();
      expect(Number(defectiveExpense.amount || 0)).toBeGreaterThan(0);
    });

    test("debe rechazar garantía y calcular pérdida", async () => {
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/reject-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes: "Proveedor no acepta garantía" });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Garantía rechazada");
      expect(response.body.report.warrantyStatus).toBe("rejected");

      // Pérdida = purchasePrice (1000) * quantity (10) = 10000
      expect(response.body.report.lossAmount).toBe(10000);
      expect(response.body.lossAmount).toBe(10000);

      // Verificar que el stock NO se repuso
      const product = await Product.findById(testProduct._id);
      expect(product.warehouseStock).toBe(100); // No cambió
    });

    test("debe fallar si el reporte no existe", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/v2/defective-products/${fakeId}/reject-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Reporte no encontrado");
    });

    test("debe fallar si el reporte no tiene garantía", async () => {
      const noWarrantyReport = await DefectiveProduct.create({
        business: testBusiness._id,
        product: testProduct._id,
        distributor: adminUser._id,
        quantity: 5,
        reason: "No warranty reject test",
        status: "confirmado",
        hasWarranty: false,
        confirmedBy: adminUser._id,
        confirmedAt: new Date(),
      });

      const response = await request(app)
        .put(
          `/api/v2/defective-products/${noWarrantyReport._id}/reject-warranty`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("no tiene garantía");
    });

    test("debe fallar si la garantía ya fue rechazada", async () => {
      // Rechazar la garantía primero
      await DefectiveProduct.findByIdAndUpdate(testReport._id, {
        warrantyStatus: "rejected",
        lossAmount: 10000,
      });

      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/reject-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("ya fue rechazada");
    });

    test("debe calcular pérdida correctamente con diferentes precios", async () => {
      // Crear producto con precio diferente
      const expensiveProduct = await Product.create({
        name: "Expensive Product",
        description: "Producto caro para test",
        business: testBusiness._id,
        category: testCategory._id,
        warehouseStock: 50,
        totalStock: 50,
        purchasePrice: 5000,
        distributorPrice: 6000,
      });

      const expensiveReport = await DefectiveProduct.create({
        business: testBusiness._id,
        product: expensiveProduct._id,
        distributor: adminUser._id,
        quantity: 3,
        reason: "Expensive defective",
        status: "confirmado",
        hasWarranty: true,
        warrantyStatus: "pending",
        confirmedBy: adminUser._id,
        confirmedAt: new Date(),
      });

      const response = await request(app)
        .put(
          `/api/v2/defective-products/${expensiveReport._id}/reject-warranty`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(200);
      // Pérdida = 5000 * 3 = 15000
      expect(response.body.lossAmount).toBe(15000);
    });

    test("debe guardar las notas del admin al rechazar", async () => {
      const adminNotes = "Proveedor rechazó garantía por mal uso";
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/reject-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes });

      expect(response.status).toBe(200);
      expect(response.body.report.adminNotes).toBe(adminNotes);
    });
  });

  describe("POST /api/v2/defective-products/warranty - escenarios financieros", () => {
    test("same price: no debe crear upsellSale", async () => {
      const originalSale = await Sale.create({
        business: testBusiness._id,
        createdBy: adminUser._id,
        product: testProduct._id,
        quantity: 1,
        purchasePrice: 1000,
        distributorPrice: 1200,
        salePrice: 1500,
        paymentStatus: "confirmado",
      });

      const samePriceReplacement = await Product.create({
        name: "Replacement Same Price",
        description: "Reemplazo mismo precio",
        business: testBusiness._id,
        category: testCategory._id,
        warehouseStock: 50,
        totalStock: 50,
        purchasePrice: 900,
        distributorPrice: 1200,
        clientPrice: 1500,
      });

      const response = await request(app)
        .post("/api/v2/defective-products/warranty")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          saleItemId: originalSale._id,
          quantity: 1,
          reason: "Garantía same price",
          replacementProductId: samePriceReplacement._id,
          replacementPrice: 1500,
          replacementSource: "warehouse",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.report.priceDifference).toBe(0);
      expect(response.body.data.upsellSale).toBeNull();
    });

    test("upsell: debe crear upsellSale válido y no nulo", async () => {
      const originalSale = await Sale.create({
        business: testBusiness._id,
        createdBy: adminUser._id,
        product: testProduct._id,
        quantity: 1,
        purchasePrice: 1000,
        distributorPrice: 1200,
        salePrice: 1500,
        paymentStatus: "confirmado",
      });

      const upsellReplacement = await Product.create({
        name: "Replacement Upsell",
        description: "Reemplazo más caro",
        business: testBusiness._id,
        category: testCategory._id,
        warehouseStock: 50,
        totalStock: 50,
        purchasePrice: 1200,
        distributorPrice: 1600,
        clientPrice: 2000,
      });

      const response = await request(app)
        .post("/api/v2/defective-products/warranty")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          saleItemId: originalSale._id,
          quantity: 1,
          reason: "Garantía upsell",
          replacementProductId: upsellReplacement._id,
          replacementPrice: 2000,
          replacementSource: "warehouse",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.report.priceDifference).toBe(500);
      expect(response.body.data.upsellSale).toBeTruthy();
      expect(response.body.data.upsellSale._id).toBeTruthy();

      const createdUpsell = await Sale.findById(
        response.body.data.upsellSale._id,
      );
      expect(createdUpsell).toBeTruthy();
      expect(createdUpsell.isComplementarySale).toBe(true);
      expect(createdUpsell.warrantyTicketId).toBeTruthy();
      expect(createdUpsell.salePrice).toBe(500);
    });

    test("downgrade/refund: no debe crear upsellSale y debe calcular cashRefund", async () => {
      const originalSale = await Sale.create({
        business: testBusiness._id,
        createdBy: adminUser._id,
        product: testProduct._id,
        quantity: 1,
        purchasePrice: 1000,
        distributorPrice: 1200,
        salePrice: 1500,
        paymentStatus: "confirmado",
      });

      const downgradeReplacement = await Product.create({
        name: "Replacement Downgrade",
        description: "Reemplazo más barato",
        business: testBusiness._id,
        category: testCategory._id,
        warehouseStock: 50,
        totalStock: 50,
        purchasePrice: 700,
        distributorPrice: 900,
        clientPrice: 1200,
      });

      const response = await request(app)
        .post("/api/v2/defective-products/warranty")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          saleItemId: originalSale._id,
          quantity: 1,
          reason: "Garantía downgrade",
          replacementProductId: downgradeReplacement._id,
          replacementPrice: 1200,
          replacementSource: "warehouse",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.report.priceDifference).toBe(0);
      expect(response.body.data.report.cashRefund).toBe(300);
      expect(response.body.data.upsellSale).toBeNull();
    });
  });

  describe("Workflow completo de garantía", () => {
    test("debe permitir aprobar una garantía pendiente", async () => {
      // Estado inicial: pending
      expect(testReport.warrantyStatus).toBe("pending");
      expect(testReport.stockRestored).toBe(false);

      // Aprobar garantía
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes: "OK" });

      expect(response.status).toBe(200);
      expect(response.body.report.warrantyStatus).toBe("approved");
      expect(response.body.report.stockRestored).toBe(true);
      expect(response.body.report.lossAmount).toBe(0);
    });

    test("no debe permitir rechazar una garantía ya aprobada", async () => {
      // Aprobar primero
      await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      // Intentar rechazar
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/reject-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      // Debe fallar o mantener el estado aprobado
      const report = await DefectiveProduct.findById(testReport._id);
      expect(report.warrantyStatus).toBe("approved");
    });

    test("debe mantener los campos de garantía en el reporte", async () => {
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ adminNotes: "Test notes" });

      expect(response.status).toBe(200);
      expect(response.body.report).toHaveProperty("hasWarranty");
      expect(response.body.report).toHaveProperty("warrantyStatus");
      expect(response.body.report).toHaveProperty("lossAmount");
      expect(response.body.report).toHaveProperty("stockRestored");
      expect(response.body.report).toHaveProperty("stockRestoredAt");
      expect(response.body.report.stockRestoredAt).toBeTruthy();
    });
  });

  describe("Validaciones de seguridad", () => {
    test("debe requerir autenticación", async () => {
      const response = await request(app)
        .put(`/api/v2/defective-products/${testReport._id}/approve-warranty`)
        .send({});

      expect(response.status).toBe(401);
    });

    test("debe validar que el reporte pertenezca al negocio del usuario", async () => {
      // Crear otro negocio y usuario
      const otherBusiness = await Business.findOneAndUpdate(
        {
          name: `Other Business ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        },
        {
          createdBy: adminUser._id,
          status: "active",
          isActive: true,
        },
        { upsert: true, new: true },
      );

      const otherReport = await DefectiveProduct.create({
        business: otherBusiness._id,
        product: testProduct._id,
        distributor: adminUser._id,
        quantity: 5,
        reason: "Other business report",
        status: "confirmado",
        hasWarranty: true,
        warrantyStatus: "pending",
        confirmedBy: adminUser._id,
        confirmedAt: new Date(),
      });

      const response = await request(app)
        .put(`/api/v2/defective-products/${otherReport._id}/approve-warranty`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("Reporte no encontrado");

      // Limpiar
      await DefectiveProduct.findByIdAndDelete(otherReport._id);
      await Business.findByIdAndDelete(otherBusiness._id);
    });
  });
});
