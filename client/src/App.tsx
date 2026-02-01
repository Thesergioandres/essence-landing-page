import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BusinessGate from "./components/BusinessGate";
import LoadingProgress from "./components/LoadingProgress";
import QuickGodAccess from "./components/QuickGodAccess";
import ProtectedRoute from "./routes/ProtectedRoute";
import { ToastContainer } from "./shared/components/ui";

// Loading component con duración corta para minimizar pantalla en blanco
const PageLoader = () => (
  <LoadingProgress message="Cargando aplicación..." duration={400} />
);

// ========== LAZY LOAD - FEATURE-BASED PAGES ==========

// Auth pages
const Login = lazy(() => import("./features/auth/pages/LoginPage"));
const LoginAdmin = lazy(
  () => import("./features/auth/pages/LoginAdminRedirect")
);
const LoginDistributor = lazy(
  () => import("./features/auth/pages/LoginDistributorRedirect")
);
const LoginGod = lazy(() => import("./features/auth/pages/LoginGodRedirect"));
const Register = lazy(() => import("./features/auth/pages/RegisterPage"));
const AccountHold = lazy(() => import("./features/auth/pages/AccountHoldPage"));

// Common / Public pages
const Home = lazy(() => import("./features/common/pages/HomePage"));
const Catalog = lazy(() => import("./features/common/pages/CatalogPage"));
const GodPanel = lazy(() => import("./features/common/pages/GodPanelPage"));
const DefectiveReports = lazy(
  () => import("./features/common/pages/DefectiveReportsPage")
);
const DefectiveProductsManagement = lazy(
  () => import("./features/common/pages/DefectiveProductsManagementPage")
);
const TestOptimization = lazy(
  () => import("./features/common/pages/TestOptimizationPage")
);

// Inventory pages
const Products = lazy(() => import("./features/inventory/pages/ProductsPage"));
const Categories = lazy(
  () => import("./features/inventory/pages/CategoriesPage")
);
const AddProduct = lazy(
  () => import("./features/inventory/pages/AddProductPage")
);
const EditProduct = lazy(
  () => import("./features/inventory/pages/EditProductPage")
);
const ProductDetail = lazy(
  () => import("./features/inventory/pages/ProductDetailPage")
);
const CategoryProducts = lazy(
  () => import("./features/inventory/pages/CategoryProductsPage")
);
const GlobalInventory = lazy(
  () => import("./features/inventory/pages/GlobalInventoryPage")
);
const InventoryEntries = lazy(
  () => import("./features/inventory/pages/InventoryEntriesPage")
);

// Analytics pages
const Dashboard = lazy(
  () => import("./features/analytics/pages/DashboardPage")
);
const AdvancedDashboard = lazy(
  () => import("./features/analytics/pages/AdvancedDashboardPage")
);
const AuditLogs = lazy(
  () => import("./features/analytics/pages/AuditLogsPage")
);
const Rankings = lazy(() => import("./features/analytics/pages/RankingsPage"));
const Expenses = lazy(() => import("./features/analytics/pages/ExpensesPage"));
const ProfitHistory = lazy(
  () => import("./features/analytics/pages/ProfitHistoryPage")
);

// Sales pages
const Sales = lazy(() => import("./features/sales/pages/SalesPage"));
const SpecialSales = lazy(
  () => import("./features/sales/pages/SpecialSalesPage")
);
const RegisterSale = lazy(
  () => import("./features/sales/pages/RegisterSalePage")
);
const AdminRegisterSale = lazy(
  () => import("./features/sales/pages/RegisterSalePage")
);

// Distributors pages
const Distributors = lazy(
  () => import("./features/distributors/pages/DistributorsPage")
);
const AddDistributor = lazy(
  () => import("./features/distributors/pages/AddDistributorPage")
);
const DistributorDetail = lazy(
  () => import("./features/distributors/pages/DistributorDetailPage")
);
const EditDistributor = lazy(
  () => import("./features/distributors/pages/EditDistributorPage")
);
const DistributorDashboard = lazy(
  () => import("./features/distributors/pages/DistributorDashboardPage")
);
const DistributorDashboardLayout = lazy(
  () => import("./features/distributors/pages/DistributorDashboardLayout")
);
const DistributorProducts = lazy(
  () => import("./features/distributors/pages/DistributorProductsPage")
);
const DistributorSales = lazy(
  () => import("./features/distributors/pages/DistributorSalesPage")
);
const DistributorCredits = lazy(
  () => import("./features/distributors/pages/DistributorCreditsPage")
);
const DistributorStats = lazy(
  () => import("./features/distributors/pages/DistributorStatsPage")
);
const DistributorCatalog = lazy(
  () => import("./features/distributors/pages/DistributorCatalogPage")
);
const DistributorCatalogShare = lazy(
  () => import("./features/distributors/pages/DistributorCatalogSharePage")
);
const PublicDistributorCatalog = lazy(
  () => import("./features/distributors/pages/PublicDistributorCatalogPage")
);

// Customers pages
const Customers = lazy(
  () => import("./features/customers/pages/CustomersPage")
);
const Segments = lazy(() => import("./features/customers/pages/SegmentsPage"));

// Credits pages
const Credits = lazy(() => import("./features/credits/pages/CreditsPage"));
const CreditDetail = lazy(
  () => import("./features/credits/pages/CreditDetailPage")
);

// Business pages
const DashboardLayout = lazy(
  () => import("./features/business/pages/DashboardLayout")
);
const BusinessSettings = lazy(
  () => import("./features/business/pages/BusinessSettingsPage")
);
const CreateBusiness = lazy(
  () => import("./features/business/pages/CreateBusinessPage")
);
const BusinessAssistant = lazy(
  () => import("./features/business/pages/BusinessAssistantPage")
);
const TeamManagement = lazy(
  () => import("./features/business/pages/TeamManagementPage")
);
const Onboarding = lazy(
  () => import("./features/business/pages/OnboardingPage")
);
const GamificationConfig = lazy(
  () => import("./features/business/pages/GamificationConfigPage")
);

// Branches pages
const Branches = lazy(() => import("./features/branches/pages/BranchesPage"));
const StockManagement = lazy(
  () => import("./features/branches/pages/StockManagementPage")
);
const TransferStock = lazy(
  () => import("./features/branches/pages/TransferStockPage")
);
const TransferHistory = lazy(
  () => import("./features/branches/pages/TransferHistoryPage")
);

// Notifications pages
const Notifications = lazy(
  () => import("./features/notifications/pages/NotificationsPage")
);

// Settings pages
const UserSettings = lazy(
  () => import("./features/settings/pages/UserSettingsPage")
);
const PaymentMethods = lazy(
  () => import("./features/settings/pages/PaymentMethodsPage")
);
const DeliveryMethods = lazy(
  () => import("./features/settings/pages/DeliveryMethodsPage")
);
const Providers = lazy(() => import("./features/settings/pages/ProvidersPage"));
const Promotions = lazy(
  () => import("./features/settings/pages/PromotionsPage")
);
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
        <Route
          path="/distributor-catalog/:distributorId"
          element={<PublicDistributorCatalog />}
        />

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
            path="global-inventory"
            element={
              <BusinessGate requiredFeature="inventory">
                <GlobalInventory />
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
            path="profit-history"
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
          <Route
            path="test-optimization"
            element={
              <BusinessGate requiredFeature="sales">
                <TestOptimization />
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
            path="credits"
            element={
              <BusinessGate requiredFeature="sales">
                <DistributorCredits />
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
