import { Navigate, Route, Routes } from "react-router-dom";
import AddDistributor from "./pages/AddDistributor";
import AddProduct from "./pages/AddProduct";
import Catalog from "./pages/Catalog";
import Categories from "./pages/Categories";
import CategoryProducts from "./pages/CategoryProducts";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./pages/DashboardLayout";
import DistributorDashboard from "./pages/DistributorDashboard";
import DistributorDashboardLayout from "./pages/DistributorDashboardLayout";
import DistributorDetail from "./pages/DistributorDetail";
import DistributorProducts from "./pages/DistributorProducts";
import DistributorSales from "./pages/DistributorSales";
import DistributorStats from "./pages/DistributorStats";
import Distributors from "./pages/Distributors";
import EditDistributor from "./pages/EditDistributor";
import EditProduct from "./pages/EditProduct";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import RegisterSale from "./pages/RegisterSale";
import StockManagement from "./pages/StockManagement";
import { RoleRoute } from "./routes/RoleRoute";

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/productos" element={<Catalog />} />
      <Route path="/producto/:id" element={<ProductDetail />} />
      <Route path="/categoria/:slug" element={<CategoryProducts />} />

      {/* Auth Route */}
      <Route path="/login" element={<Login />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <RoleRoute role="admin">
            <DashboardLayout />
          </RoleRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
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
      </Route>

      {/* Distributor Routes */}
      <Route
        path="/distributor"
        element={
          <RoleRoute role="distribuidor">
            <DistributorDashboardLayout />
          </RoleRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DistributorDashboard />} />
        <Route path="products" element={<DistributorProducts />} />
        <Route path="register-sale" element={<RegisterSale />} />
        <Route path="sales" element={<DistributorSales />} />
        <Route path="stats" element={<DistributorStats />} />
      </Route>

      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
