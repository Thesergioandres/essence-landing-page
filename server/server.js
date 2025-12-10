import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import compression from "compression";
import connectDB from "./config/database.js";
import { initRedis } from "./config/redis.js";

// Importar rutas
import analyticsRoutes from "./routes/analytics.routes.js";
import advancedAnalyticsRoutes from "./routes/advancedAnalytics.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import authRoutes from "./routes/auth.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import defectiveProductRoutes from "./routes/defectiveProduct.routes.js";
import distributorRoutes from "./routes/distributor.routes.js";
import gamificationRoutes from "./routes/gamification.routes.js";
import productRoutes from "./routes/product.routes.js";
import profitHistoryRoutes from "./routes/profitHistory.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import specialSaleRoutes from "./routes/specialSale.routes.js";
import stockRoutes from "./routes/stock.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import userRoutes from "./routes/user.routes.js";

// Configuración
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configurar orígenes permitidos
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://essence-landing-page-client.vercel.app",
  "https://ssence-landing-page-client.vercel.app",  // URL con doble 's'
  "https://essence-landing-page-production.up.railway.app",
  /\.vercel\.app$/,  // Todos los subdominios de Vercel
  /\.railway\.app$/  // Todos los subdominios de Railway
];

// Conectar a MongoDB y Redis
connectDB();
initRedis();

// Compression middleware (debe ir antes de las rutas)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
}));

// Middlewares - CORS Configuration v5.0 - Enhanced for Production
app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Verificar si el origin está en la lista permitida
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log('❌ Origin bloqueado:', origin);
        callback(null, true); // Temporalmente permitir todos para debug
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Length", "X-Requested-With"],
    maxAge: 86400 // 24 horas de cache para preflight
  })
);

// Manejo explícito de preflight requests
app.options('*', cors());

// Middleware de logging para debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Origin:', req.headers.origin);
  console.log('Headers:', req.headers);
  next();
});

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
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/distributors", distributorRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/special-sales", specialSaleRoutes);
app.use("/api/defective-products", defectiveProductRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/advanced-analytics", advancedAnalyticsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/profit-history", profitHistoryRoutes);

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
