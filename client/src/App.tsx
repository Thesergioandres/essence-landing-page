import { Navigate, Route, Routes } from "react-router-dom";
import AddDistributor from "./pages/AddDistributor";
import AddProduct from "./pages/AddProduct";
import Catalog from "./pages/Catalog";
import Categories from "./pages/Categories";
import CategoryProducts from "./pages/CategoryProducts";
import Dashboard from "./pages/Dashboard";
import DashboardLayout from "./pages/DashboardLayout";
import DistributorDetail from "./pages/DistributorDetail";
import Distributors from "./pages/Distributors";
import EditDistributor from "./pages/EditDistributor";
import EditProduct from "./pages/EditProduct";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
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

      {/* Auth Route */}
      <Route path="/login" element={<Login />} />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
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

      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
