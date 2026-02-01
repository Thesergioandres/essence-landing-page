import express from "express";
import { protect } from "../../../../middleware/auth.middleware.js";
import {
  businessContext,
  requireFeature,
  requirePermission,
} from "../../../../middleware/business.middleware.js";
import CategoryController from "../controllers/CategoryController.js";

const router = express.Router();

/**
 * Routes V2: /api/v2/categories
 * Hexagonal Architecture Pattern
 */

// Middleware global: autenticación + contexto de negocio
router.use(
  protect,
  businessContext,
  requireFeature("products"),
  requirePermission({ module: "products", action: "read" }),
);

/**
 * @swagger
 * /api/v2/categories:
 *   get:
 *     summary: Obtener todas las categorías del negocio
 *     tags: [Categories V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-business-id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de categorías
 */
router.get("/", CategoryController.getAll.bind(CategoryController));

/**
 * @swagger
 * /api/v2/categories/{id}:
 *   get:
 *     summary: Obtener una categoría por ID
 *     tags: [Categories V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-business-id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoría encontrada
 *       404:
 *         description: Categoría no encontrada
 */
router.get("/:id", CategoryController.getById.bind(CategoryController));

/**
 * @swagger
 * /api/v2/categories:
 *   post:
 *     summary: Crear una nueva categoría
 *     tags: [Categories V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: x-business-id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Categoría creada
 *       400:
 *         description: Datos inválidos o categoría duplicada
 */
router.post(
  "/",
  requirePermission({ module: "products", action: "create" }),
  CategoryController.create.bind(CategoryController),
);

/**
 * @swagger
 * /api/v2/categories/{id}:
 *   put:
 *     summary: Actualizar una categoría
 *     tags: [Categories V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-business-id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *       404:
 *         description: Categoría no encontrada
 */
router.put(
  "/:id",
  requirePermission({ module: "products", action: "update" }),
  CategoryController.update.bind(CategoryController),
);

/**
 * @swagger
 * /api/v2/categories/{id}:
 *   delete:
 *     summary: Eliminar una categoría
 *     tags: [Categories V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-business-id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoría eliminada
 *       400:
 *         description: Categoría tiene productos asociados
 *       404:
 *         description: Categoría no encontrada
 */
router.delete(
  "/:id",
  requirePermission({ module: "products", action: "delete" }),
  CategoryController.delete.bind(CategoryController),
);

export default router;
