import express from "express";
import {
  cancelCredit,
  createCredit,
  deleteCredit,
  getCreditById,
  getCreditMetrics,
  getCredits,
  getCustomerCredits,
  getDistributorCredits,
  getPaymentHistory,
  registerDistributorPayment,
  registerPayment,
} from "../controllers/credit.controller.js";
import { admin, protect } from "../middleware/auth.middleware.js";
import { businessContext } from "../middleware/business.middleware.js";
import { creditValidation } from "../middleware/validation.middleware.js";

const router = express.Router();

// Todas las rutas requieren autenticación y contexto de negocio
router.use(protect);
router.use(businessContext);

/**
 * @swagger
 * /credits/metrics:
 *   get:
 *     summary: Obtener métricas de créditos del negocio
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *     responses:
 *       200:
 *         description: Métricas de créditos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCredits:
 *                   type: number
 *                 totalOutstanding:
 *                   type: number
 *                 pendingCount:
 *                   type: number
 *                 overdueCount:
 *                   type: number
 *                 paidCount:
 *                   type: number
 */
router.get("/metrics", admin, getCreditMetrics);

/**
 * @swagger
 * /credits/my-sales:
 *   get:
 *     summary: Obtener créditos de ventas del distribuidor actual
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de créditos de ventas del distribuidor
 */
router.get("/my-sales", getDistributorCredits);

/**
 * @swagger
 * /credits/customer/{customerId}:
 *   get:
 *     summary: Obtener créditos de un cliente específico
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del cliente
 *     responses:
 *       200:
 *         description: Lista de créditos del cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credits:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Credit'
 */
router.get(
  "/customer/:customerId",
  creditValidation.getByCustomer,
  admin,
  getCustomerCredits,
);

/**
 * @swagger
 * /credits:
 *   get:
 *     summary: Listar todos los créditos
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, overdue]
 *         description: Filtrar por estado
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Página (paginación)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Límite por página
 *     responses:
 *       200:
 *         description: Lista de créditos
 *   post:
 *     summary: Crear nuevo crédito
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/BusinessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer, amount]
 *             properties:
 *               customer:
 *                 type: string
 *                 description: ID del cliente
 *               sale:
 *                 type: string
 *                 description: ID de la venta asociada (opcional)
 *               amount:
 *                 type: number
 *                 description: Monto del crédito
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: Fecha de vencimiento
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Crédito creado
 */
router
  .route("/")
  .get(getCredits)
  .post(creditValidation.create, admin, createCredit);

/**
 * @swagger
 * /credits/{id}:
 *   get:
 *     summary: Obtener crédito por ID
 *     tags: [Credits]
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
 *         description: Detalle del crédito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Credit'
 *   delete:
 *     summary: Eliminar un crédito
 *     tags: [Credits]
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
 *         description: Crédito eliminado
 */
router
  .route("/:id")
  .get(creditValidation.getById, admin, getCreditById)
  .delete(creditValidation.getById, admin, deleteCredit);

/**
 * @swagger
 * /credits/{id}/payments:
 *   get:
 *     summary: Obtener historial de pagos de un crédito
 *     tags: [Credits]
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
 *         description: Lista de pagos
 *   post:
 *     summary: Registrar pago a un crédito
 *     tags: [Credits]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Monto del pago
 *               method:
 *                 type: string
 *                 enum: [cash, card, transfer]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pago registrado
 */
router
  .route("/:id/payments")
  .get(creditValidation.getById, admin, getPaymentHistory)
  .post(creditValidation.registerPayment, admin, registerPayment);

/**
 * @swagger
 * /credits/{id}/cancel:
 *   post:
 *     summary: Cancelar un crédito
 *     tags: [Credits]
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
 *         description: Crédito cancelado
 */
router.post("/:id/cancel", creditValidation.getById, admin, cancelCredit);

/**
 * @swagger
 * /credits/{id}/distributor-payment:
 *   post:
 *     summary: Distribuidor registra pago de su propio crédito
 *     tags: [Credits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *               notes:
 *                 type: string
 *               paymentProof:
 *                 type: string
 *                 description: Imagen base64 del comprobante
 *     responses:
 *       200:
 *         description: Pago registrado
 */
router.post(
  "/:id/distributor-payment",
  creditValidation.getById,
  registerDistributorPayment,
);

export default router;
