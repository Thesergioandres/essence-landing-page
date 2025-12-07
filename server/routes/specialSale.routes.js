import express from "express";
import {
  createSpecialSale,
  getAllSpecialSales,
  getSpecialSaleById,
  updateSpecialSale,
  deleteSpecialSale,
  cancelSpecialSale,
  getSpecialSalesStatistics,
  getDistributionByPerson,
  getTopProducts,
} from "../controllers/specialSale.controller.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas y solo permitir admin
router.use(protect);
router.use(admin);

// Rutas de estadísticas
router.get("/stats/overview", getSpecialSalesStatistics);
router.get("/stats/distribution", getDistributionByPerson);
router.get("/stats/top-products", getTopProducts);

// Rutas CRUD
router.route("/").post(createSpecialSale).get(getAllSpecialSales);

router
  .route("/:id")
  .get(getSpecialSaleById)
  .put(updateSpecialSale)
  .delete(deleteSpecialSale);

// Ruta para cancelar venta especial
router.put("/:id/cancel", cancelSpecialSale);

export default router;
