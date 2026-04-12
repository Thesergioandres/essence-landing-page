import { Router } from "express";
import { EmployeeController } from "../controllers/EmployeeController.js";

const router = Router();
const controller = new EmployeeController();

// Public employee catalog (no auth)
router.get("/:id/catalog", (req, res) => controller.getPublicCatalog(req, res));

export default router;
