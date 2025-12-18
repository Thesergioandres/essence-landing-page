import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoadingProgress from "./components/LoadingProgress";
import ProtectedRoute from "./routes/ProtectedRoute";

// Loading component con barra de progreso
const PageLoader = () => (
  <LoadingProgress message="Cargando aplicación..." duration={1500} />
);

// Lazy load all pages
const Home = lazy(() => import("./pages/Home"));
const Catalog = lazy(() => import("./pages/Catalog"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CategoryProducts = lazy(() => import("./pages/CategoryProducts"));
const Login = lazy(() => import("./pages/Login"));
const LoginAdmin = lazy(() => import("./pages/LoginAdmin"));
const LoginDistributor = lazy(() => import("./pages/LoginDistributor"));

// Admin pages
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Categories = lazy(() => import("./pages/Categories"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const EditProduct = lazy(() => import("./pages/EditProduct"));
const Distributors = lazy(() => import("./pages/Distributors"));
const AddDistributor = lazy(() => import("./pages/AddDistributor"));
const DistributorDetail = lazy(() => import("./pages/DistributorDetail"));
const EditDistributor = lazy(() => import("./pages/EditDistributor"));
const StockManagement = lazy(() => import("./pages/StockManagement"));
const Sales = lazy(() => import("./pages/Sales"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const GamificationConfig = lazy(() => import("./pages/GamificationConfig"));
const Rankings = lazy(() => import("./pages/Rankings"));
const DefectiveProductsManagement = lazy(
  () => import("./pages/DefectiveProductsManagement")
);
const AdminRegisterSale = lazy(() => import("./pages/AdminRegisterSale"));
const AdvancedDashboard = lazy(() => import("./pages/AdvancedDashboard"));
const SpecialSales = lazy(() => import("./pages/SpecialSales"));
const ProfitHistory = lazy(() => import("./pages/ProfitHistory"));
const Expenses = lazy(() => import("./pages/Expenses"));

// Distributor pages
const DistributorDashboardLayout = lazy(
  () => import("./pages/DistributorDashboardLayout")
);
const DistributorDashboard = lazy(() => import("./pages/DistributorDashboard"));
const DistributorProducts = lazy(() => import("./pages/DistributorProducts"));
const RegisterSale = lazy(() => import("./pages/RegisterSale"));
const DistributorSales = lazy(() => import("./pages/DistributorSales"));
const DistributorStats = lazy(() => import("./pages/DistributorStats"));
const DefectiveReports = lazy(() => import("./pages/DefectiveReports"));
const DistributorCatalog = lazy(() => import("./pages/DistributorCatalog"));
const TransferStock = lazy(() => import("./pages/TransferStock"));
const TransferHistory = lazy(() => import("./pages/TransferHistory"));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/productos" element={<Catalog />} />
        <Route path="/producto/:id" element={<ProductDetail />} />
        <Route path="/categoria/:slug" element={<CategoryProducts />} />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/login/admin" element={<LoginAdmin />} />
        <Route path="/login/distributor" element={<LoginDistributor />} />

        {/* Shared authenticated route - accessible by admin and distributor */}
        <Route
          path="/catalog"
          element={
            <ProtectedRoute allowedRoles={["admin", "distribuidor"]}>
              <Catalog />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="add-product" element={<AddProduct />} />
          <Route path="products/:id/edit" element={<EditProduct />} />
          <Route path="distributors" element={<Distributors />} />
          <Route path="distributors/add" element={<AddDistributor />} />
          <Route path="distributors/:id" element={<DistributorDetail />} />
          <Route path="distributors/:id/edit" element={<EditDistributor />} />
          <Route path="stock-management" element={<StockManagement />} />
          <Route path="sales" element={<Sales />} />
          <Route path="special-sales" element={<SpecialSales />} />
          <Route path="profit-history" element={<ProfitHistory />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="advanced-analytics" element={<AdvancedDashboard />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="gamification-config" element={<GamificationConfig />} />
          <Route path="rankings" element={<Rankings />} />
          <Route
            path="defective-products"
            element={<DefectiveProductsManagement />}
          />
          <Route
            path="register-sale"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminRegisterSale />
              </ProtectedRoute>
            }
          />
          <Route path="transfer-history" element={<TransferHistory />} />
        </Route>

        {/* Distributor Routes */}
        <Route
          path="/distributor"
          element={
            <ProtectedRoute allowedRoles={["distribuidor"]}>
              <DistributorDashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DistributorDashboard />} />
          <Route path="products" element={<DistributorProducts />} />
          <Route path="catalog" element={<DistributorCatalog />} />
          <Route path="transfer-stock" element={<TransferStock />} />
          <Route path="register-sale" element={<RegisterSale />} />
          <Route path="sales" element={<DistributorSales />} />
          <Route path="stats" element={<DistributorStats />} />
          <Route path="defective-reports" element={<DefectiveReports />} />
        </Route>

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
