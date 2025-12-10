import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import request from "supertest";
import app from "../server.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import DistributorStock from "../models/DistributorStock.js";
import Category from "../models/Category.js";

describe("Distributor Catalog Endpoint Tests", () => {
  let distributorToken;
  let distributorId;
  let adminToken;
  let categoryId;
  let product1Id;
  let product2Id;
  let product3Id;

  beforeAll(async () => {
    // Limpiar base de datos
    await User.deleteMany({});
    await Product.deleteMany({});
    await DistributorStock.deleteMany({});
    await Category.deleteMany({});

    // Crear categoría de prueba
    const category = await Category.create({
      name: "Categoría Test",
      slug: "categoria-test"
    });
    categoryId = category._id;

    // Crear admin
    const admin = await User.create({
      name: "Admin Test",
      email: "admin.catalog@test.com",
      password: "password123",
      role: "admin",
    });

    // Login admin
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.catalog@test.com", password: "password123" });
    adminToken = adminLogin.body.token;

    // Crear distribuidor
    const distributor = await User.create({
      name: "Distribuidor Test Catalog",
      email: "dist.catalog@test.com",
      password: "password123",
      role: "distribuidor",
      active: true,
      assignedProducts: []
    });
    distributorId = distributor._id;

    // Login distribuidor
    const distLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "dist.catalog@test.com", password: "password123" });
    distributorToken = distLogin.body.token;

    // Crear productos de prueba
    const product1 = await Product.create({
      name: "Producto Catalog 1",
      description: "Descripción 1",
      purchasePrice: 100,
      distributorPrice: 150,
      clientPrice: 200,
      category: categoryId,
      totalStock: 100,
      warehouseStock: 50,
      featured: false
    });
    product1Id = product1._id;

    const product2 = await Product.create({
      name: "Producto Catalog 2",
      description: "Descripción 2",
      purchasePrice: 200,
      distributorPrice: 250,
      clientPrice: 300,
      category: categoryId,
      totalStock: 100,
      warehouseStock: 50,
      featured: false
    });
    product2Id = product2._id;

    const product3 = await Product.create({
      name: "Producto Catalog 3",
      description: "Descripción 3",
      purchasePrice: 300,
      distributorPrice: 350,
      clientPrice: 400,
      category: categoryId,
      totalStock: 100,
      warehouseStock: 50,
      featured: false
    });
    product3Id = product3._id;

    // Asignar stock al distribuidor (solo producto 1 y 2)
    await DistributorStock.create({
      distributor: distributorId,
      product: product1Id,
      quantity: 10
    });

    await DistributorStock.create({
      distributor: distributorId,
      product: product2Id,
      quantity: 5
    });

    // Producto 3 sin stock (quantity = 0)
    await DistributorStock.create({
      distributor: distributorId,
      product: product3Id,
      quantity: 0
    });

    // Actualizar assignedProducts del distribuidor
    await User.findByIdAndUpdate(distributorId, {
      $set: { assignedProducts: [product1Id, product2Id, product3Id] }
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Product.deleteMany({});
    await DistributorStock.deleteMany({});
    await Category.deleteMany({});
    await mongoose.connection.close();
  });

  describe("GET /api/products/my-catalog", () => {
    it("debería devolver solo productos con stock > 0 del distribuidor", async () => {
      const response = await request(app)
        .get("/api/products/my-catalog")
        .set("Authorization", `Bearer ${distributorToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2); // Solo producto 1 y 2
      
      // Verificar que los productos tienen la propiedad distributorStock
      expect(response.body[0]).toHaveProperty("distributorStock");
      expect(response.body[1]).toHaveProperty("distributorStock");
      
      // Verificar que tiene las cantidades correctas
      const stocks = response.body.map(p => p.distributorStock).sort((a, b) => a - b);
      expect(stocks).toEqual([5, 10]);
    });

    it("debería fallar si el usuario no es distribuidor", async () => {
      const response = await request(app)
        .get("/api/products/my-catalog")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Solo los distribuidores");
    });

    it("debería fallar sin token de autenticación", async () => {
      const response = await request(app)
        .get("/api/products/my-catalog")
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });

    it("debería devolver array vacío si el distribuidor no tiene stock", async () => {
      // Crear nuevo distribuidor sin stock
      const newDist = await User.create({
        name: "Distribuidor Sin Stock",
        email: "dist.nostock@test.com",
        password: "password123",
        role: "distribuidor",
        active: true
      });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "dist.nostock@test.com", password: "password123" });

      const response = await request(app)
        .get("/api/products/my-catalog")
        .set("Authorization", `Bearer ${loginRes.body.token}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);

      // Limpiar
      await User.findByIdAndDelete(newDist._id);
    });

    it("debería incluir información de categoría en los productos", async () => {
      const response = await request(app)
        .get("/api/products/my-catalog")
        .set("Authorization", `Bearer ${distributorToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty("category");
      expect(response.body[0].category).toHaveProperty("name");
      expect(response.body[0].category).toHaveProperty("slug");
    });

    it("debería devolver productos con todas las propiedades necesarias", async () => {
      const response = await request(app)
        .get("/api/products/my-catalog")
        .set("Authorization", `Bearer ${distributorToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      
      const product = response.body[0];
      expect(product).toHaveProperty("_id");
      expect(product).toHaveProperty("name");
      expect(product).toHaveProperty("description");
      expect(product).toHaveProperty("purchasePrice");
      expect(product).toHaveProperty("distributorPrice");
      expect(product).toHaveProperty("clientPrice");
      expect(product).toHaveProperty("distributorStock");
      expect(product).toHaveProperty("category");
    });
  });

  describe("Edge Cases", () => {
    it("debería manejar correctamente cuando un producto fue eliminado pero el stock persiste", async () => {
      // Crear producto temporal
      const tempProduct = await Product.create({
        name: "Producto Temporal",
        description: "Temporal",
        purchasePrice: 100,
        distributorPrice: 150,
        clientPrice: 200,
        category: categoryId,
        totalStock: 100,
        warehouseStock: 50,
        featured: false
      });

      // Asignar stock
      await DistributorStock.create({
        distributor: distributorId,
        product: tempProduct._id,
        quantity: 5
      });

      // Eliminar el producto
      await Product.findByIdAndDelete(tempProduct._id);

      // Consultar catálogo (no debería fallar)
      const response = await request(app)
        .get("/api/products/my-catalog")
        .set("Authorization", `Bearer ${distributorToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // El producto eliminado no debe aparecer
      expect(response.body.every(p => p._id !== tempProduct._id.toString())).toBe(true);

      // Limpiar stock huérfano
      await DistributorStock.deleteOne({ product: tempProduct._id });
    });
  });
});
