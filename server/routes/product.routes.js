import express from "express";
import { upload } from "../config/cloudinary.js";
import {
  createProduct,
  deleteProduct,
  getDistributorCatalog,
  getDistributorPrice,
  getProduct,
  getProducts,
  initializeAverageCost,
  updateProduct,
} from "../controllers/product.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../middleware/business.middleware.js";
import { cacheMiddleware } from "../middleware/cache.middleware.js";

const router = express.Router();

/**
 * @swagger
 * /products/my-catalog:
 *   get:
 *     summary: Obtener catálogo personal del distribuidor
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *     responses:
 *       200:
 *         description: Lista de productos asignados al distribuidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 */
router.get(
  "/my-catalog",
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "read" }),
  getDistributorCatalog,
);

// Inicializar costos promedio (debe ir ANTES de las rutas con parámetros)
router.post(
  "/initialize-average-cost",
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "update" }),
  initializeAverageCost,
);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Listar todos los productos
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoría
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Solo productos destacados
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Solo productos activos
 *     responses:
 *       200:
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 */
router.get("/", cacheMiddleware(600, "products"), getProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Obtener un producto por ID
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Detalle del producto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", cacheMiddleware(600, "product"), getProduct);

/**
 * @swagger
 * /products/{id}/distributor-price/{distributorId}:
 *   get:
 *     summary: Obtener precio de producto para un distribuidor específico
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *       - in: path
 *         name: distributorId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del distribuidor
 *     responses:
 *       200:
 *         description: Precio del distribuidor
 */
router.get(
  "/:id/distributor-price/:distributorId",
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "read" }),
  getDistributorPrice,
);

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Crear nuevo producto
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, purchasePrice, distributorPrice, category]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               purchasePrice:
 *                 type: number
 *               distributorPrice:
 *                 type: number
 *               clientPrice:
 *                 type: number
 *               suggestedPrice:
 *                 type: number
 *               category:
 *                 type: string
 *               totalStock:
 *                 type: number
 *               lowStockAlert:
 *                 type: number
 *               featured:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Producto creado
 *       400:
 *         description: Datos inválidos
 */
router.post(
  "/",
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "create" }),
  upload.single("image"),
  createProduct,
);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Actualizar producto
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               purchasePrice:
 *                 type: number
 *               distributorPrice:
 *                 type: number
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Producto actualizado
 */
router.put(
  "/:id",
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "update" }),
  upload.single("image"),
  updateProduct,
);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Eliminar producto
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Producto eliminado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete(
  "/:id",
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "delete" }),
  deleteProduct,
);

export default router;
