import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import connectDB from "./config/database.js";

// Importar rutas
import analyticsRoutes from "./routes/analytics.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import defectiveProductRoutes from "./routes/defectiveProduct.routes.js";
import distributorRoutes from "./routes/distributor.routes.js";
import gamificationRoutes from "./routes/gamification.routes.js";
import productRoutes from "./routes/product.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import stockRoutes from "./routes/stock.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

// Configuración
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Conectar a MongoDB
connectDB();

// Middlewares - CORS Configuration v4.0 - Simplified & Permissive
app.use(
  cors({
    origin: true, // Permitir TODOS los orígenes
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
  })
);
// Aumentar límite de tamaño del body para imágenes Base64 (50MB)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rutas
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Essence API funcionando correctamente",
    version: "2.0.0",
    cors: "enabled-for-all-vercel-domains",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/distributors", distributorRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/defective-products", defectiveProductRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/gamification", gamificationRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
