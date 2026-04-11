import { Router } from "express";
import getStorefrontController from "../controllers/GetStorefrontController.js";

const router = Router();

router.get("/storefront/:slug", (req, res) =>
  getStorefrontController.getBySlug(req, res),
);

export default router;
