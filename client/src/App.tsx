import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BusinessGate from "./components/BusinessGate";
import LoadingProgress from "./components/LoadingProgress";
import QuickGodAccess from "./components/QuickGodAccess";
import { ToastContainer } from "./components/ui/Toast";
import ProtectedRoute from "./routes/ProtectedRoute";

// Loading component con duración corta para minimizar pantalla en blanco
const PageLoader = () => (
  <LoadingProgress message="Cargando aplicación..." duration={400} />
);

// Lazy load all pages
const Home = lazy(() => import("./pages/Home"));
const AccountHold = lazy(() => import("./pages/AccountHold"));
const Catalog = lazy(() => import("./pages/Catalog"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CategoryProducts = lazy(() => import("./pages/CategoryProducts"));
const Login = lazy(() => import("./pages/Login"));
const LoginAdmin = lazy(() => import("./pages/LoginAdmin"));
const LoginDistributor = lazy(() => import("./pages/LoginDistributor"));
const LoginGod = lazy(() => import("./pages/LoginGod"));
const Register = lazy(() => import("./pages/Register"));
const BusinessSettings = lazy(() => import("./pages/BusinessSettings"));
const CreateBusiness = lazy(() => import("./pages/CreateBusiness"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const GodPanel = lazy(() => import("./pages/GodPanel"));

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
const BusinessAssistant = lazy(() => import("./pages/BusinessAssistant"));
const Credits = lazy(() => import("./pages/Credits"));
const CreditDetail = lazy(() => import("./pages/CreditDetail"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Providers = lazy(() => import("./pages/Providers"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Customers = lazy(() => import("./pages/Customers"));
const InventoryEntries = lazy(() => import("./pages/InventoryEntries"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods"));
const DeliveryMethods = lazy(() => import("./pages/DeliveryMethods"));

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
const DistributorCatalogShare = lazy(() => import("./pages/DistributorCatalogShare"));
const Branches = lazy(() => import("./pages/Branches"));
const TransferStock = lazy(() => import("./pages/TransferStock"));
const TransferHistory = lazy(() => import("./pages/TransferHistory"));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ToastContainer position="top-right" />
      <QuickGodAccess />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/account-hold" element={<AccountHold />} />
        <Route path="/productos" element={<Catalog />} />
        <Route path="/producto/:id" element={<ProductDetail />} />
        <Route path="/categoria/:slug" element={<CategoryProducts />} />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/login/admin" element={<LoginAdmin />} />
        <Route path="/login/god" element={<LoginGod />} />
        <Route path="/login/distributor" element={<LoginDistributor />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute
              allowedRoles={["admin", "distribuidor", "super_admin", "god"]}
            >
              <Onboarding />
            </ProtectedRoute>
          }
        />

        <Route
          path="/god"
          element={
            <ProtectedRoute allowedRoles={["god"]}>
              <GodPanel />
            </ProtectedRoute>
          }
        />

        {/* Shared authenticated route - accessible by admin and distributor */}
        <Route path="/catalog" element={<Catalog />} />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "super_admin", "god"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="dashboard"
            element={
              <BusinessGate>
                <Dashboard />
              </BusinessGate>
            }
          />
          <Route
            path="products"
            element={
              <BusinessGate requiredFeature="products">
                <Products />
              </BusinessGate>
            }
          />
          <Route
            path="categories"
            element={
              <BusinessGate requiredFeature="products">
                <Categories />
              </BusinessGate>
            }
          />
          <Route
            path="add-product"
            element={
              <BusinessGate requiredFeature="products">
                <AddProduct />
              </BusinessGate>
            }
          />
          <Route
            path="products/:id/edit"
            element={
              <BusinessGate requiredFeature="products">
                <EditProduct />
              </BusinessGate>
            }
          />
          <Route path="distributors" element={<Distributors />} />
          <Route path="distributors/add" element={<AddDistributor />} />
          <Route path="distributors/:id" element={<DistributorDetail />} />
          <Route path="distributors/:id/edit" element={<EditDistributor />} />
          <Route
            path="stock-management"
            element={
              <BusinessGate requiredFeature="inventory">
                <StockManagement />
              </BusinessGate>
            }
          />
          <Route
            path="branches"
            element={
              <BusinessGate requiredFeature="inventory">
                <Branches />
              </BusinessGate>
            }
          />
          <Route
            path="inventory-entries"
            element={
              <BusinessGate requiredFeature="inventory">
                <InventoryEntries />
              </BusinessGate>
            }
          />
          <Route
            path="sales"
            element={
              <BusinessGate requiredFeature="sales">
                <Sales />
              </BusinessGate>
            }
          />
          <Route
            path="payment-methods"
            element={
              <BusinessGate requiredFeature="sales">
                <PaymentMethods />
              </BusinessGate>
            }
          />
          <Route
            path="delivery-methods"
            element={
              <BusinessGate requiredFeature="sales">
                <DeliveryMethods />
              </BusinessGate>
            }
          />
          <Route
            path="special-sales"
            element={
              <BusinessGate requiredFeature="sales">
                <SpecialSales />
              </BusinessGate>
            }
          />
          <Route
            path="profit-history"
            element={
              <BusinessGate requiredFeature="reports">
                <ProfitHistory />
              </BusinessGate>
            }
          />
          <Route
            path="expenses"
            element={
              <BusinessGate requiredFeature="expenses">
                <Expenses />
              </BusinessGate>
            }
          />
          <Route
            path="analytics"
            element={
              <BusinessGate requiredFeature="reports">
                <AdvancedDashboard />
              </BusinessGate>
            }
          />
          <Route
            path="advanced-analytics"
            element={<Navigate to="/admin/analytics" replace />}
          />
          <Route
            path="business-assistant"
            element={
              <BusinessGate requiredFeature="assistant">
                <BusinessAssistant />
              </BusinessGate>
            }
          />
          <Route path="business-settings" element={<BusinessSettings />} />
          <Route path="create-business" element={<CreateBusiness />} />
          <Route path="user-settings" element={<UserSettings />} />
          <Route path="team" element={<TeamManagement />} />
          <Route
            path="audit-logs"
            element={
              <BusinessGate requiredFeature="reports">
                <AuditLogs />
              </BusinessGate>
            }
          />
          <Route
            path="gamification-config"
            element={
              <BusinessGate requiredFeature="gamification">
                <GamificationConfig />
              </BusinessGate>
            }
          />
          <Route
            path="rankings"
            element={
              <BusinessGate requiredFeature="gamification">
                <Rankings />
              </BusinessGate>
            }
          />
          <Route
            path="defective-products"
            element={<DefectiveProductsManagement />}
          />
          <Route
            path="register-sale"
            element={
              <ProtectedRoute allowedRoles={["admin", "super_admin", "god"]}>
                <BusinessGate requiredFeature="sales">
                  <AdminRegisterSale />
                </BusinessGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="transfer-history"
            element={
              <BusinessGate requiredFeature="transfers">
                <TransferHistory />
              </BusinessGate>
            }
          />
          <Route
            path="credits"
            element={
              <BusinessGate>
                <Credits />
              </BusinessGate>
            }
          />
          <Route
            path="credits/:id"
            element={
              <BusinessGate>
                <CreditDetail />
              </BusinessGate>
            }
          />
          <Route
            path="notifications"
            element={
              <BusinessGate>
                <Notifications />
              </BusinessGate>
            }
          />
          <Route
            path="providers"
            element={
              <BusinessGate requiredFeature="inventory">
                <Providers />
              </BusinessGate>
            }
          />
          <Route
            path="promotions"
            element={
              <BusinessGate requiredFeature="promotions">
                <Promotions />
              </BusinessGate>
            }
          />
          <Route
            path="customers"
            element={
              <BusinessGate>
                <Customers />
              </BusinessGate>
            }
          />
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
          <Route
            path="products"
            element={
              <BusinessGate requiredFeature="inventory">
                <DistributorProducts />
              </BusinessGate>
            }
          />
          <Route
            path="catalog"
            element={
              <BusinessGate requiredFeature="inventory">
                <DistributorCatalog />
              </BusinessGate>
            }
          />
          <Route
            path="share-catalog"
            element={
              <BusinessGate requiredFeature="inventory">
                <DistributorCatalogShare />
              </BusinessGate>
            }
          />
          <Route
            path="transfer-stock"
            element={
              <BusinessGate requiredFeature="transfers">
                <TransferStock />
              </BusinessGate>
            }
          />
          <Route
            path="register-sale"
            element={
              <BusinessGate requiredFeature="sales">
                <RegisterSale />
              </BusinessGate>
            }
          />
          <Route
            path="sales"
            element={
              <BusinessGate requiredFeature="sales">
                <DistributorSales />
              </BusinessGate>
            }
          />
          <Route
            path="stats"
            element={
              <BusinessGate requiredFeature="reports">
                <DistributorStats />
              </BusinessGate>
            }
          />
          <Route
            path="defective-reports"
            element={
              <BusinessGate requiredFeature="incidents">
                <DefectiveReports />
              </BusinessGate>
            }
          />
        </Route>

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
