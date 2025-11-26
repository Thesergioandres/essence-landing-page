import { Navigate, Route, Routes } from "react-router-dom";
import AddDistributor from "./pages/AddDistributor";
import AddProduct from "./pages/AddProduct";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import Catalog from "./pages/Catalog";
import Categories from "./pages/Categories";
import CategoryProducts from "./pages/CategoryProducts";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./pages/DashboardLayout";
import DefectiveProductsManagement from "./pages/DefectiveProductsManagement";
import DefectiveReports from "./pages/DefectiveReports";
import DistributorDashboard from "./pages/DistributorDashboard";
import DistributorDashboardLayout from "./pages/DistributorDashboardLayout";
import DistributorDetail from "./pages/DistributorDetail";
import DistributorProducts from "./pages/DistributorProducts";
import DistributorSales from "./pages/DistributorSales";
import DistributorStats from "./pages/DistributorStats";
import Distributors from "./pages/Distributors";
import EditDistributor from "./pages/EditDistributor";
import EditProduct from "./pages/EditProduct";
import GamificationConfig from "./pages/GamificationConfig";
import Home from "./pages/Home";
import Login from "./pages/Login";
import LoginAdmin from "./pages/LoginAdmin";
import LoginDistributor from "./pages/LoginDistributor";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import Rankings from "./pages/Rankings";
import RegisterSale from "./pages/RegisterSale";
import Sales from "./pages/Sales";
import StockManagement from "./pages/StockManagement";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
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
        <Route path="analytics" element={<Analytics />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="gamification-config" element={<GamificationConfig />} />
        <Route path="rankings" element={<Rankings />} />
        <Route path="defective-products" element={<DefectiveProductsManagement />} />
        <Route path="register-sale" element={<ProtectedRoute allowedRoles={["admin"]}><AdminRegisterSale /></ProtectedRoute>} />
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
        <Route path="register-sale" element={<RegisterSale />} />
        <Route path="sales" element={<DistributorSales />} />
        <Route path="stats" element={<DistributorStats />} />
        <Route path="defective-reports" element={<DefectiveReports />} />
      </Route>

      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
