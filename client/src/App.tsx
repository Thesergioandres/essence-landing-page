import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from "framer-motion";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import BusinessGate from "./components/BusinessGate";
import ImpersonationBanner from "./components/ImpersonationBanner";
import LoadingProgress from "./components/LoadingProgress";
import QuickGodAccess from "./components/QuickGodAccess";
import ProtectedRoute from "./routes/ProtectedRoute";
import { ToastContainer } from "./shared/components/ui";
import { useMotionProfile } from "./shared/config/motion.config";

const ADMIN_ORIGINAL_TOKEN_KEY = "admin_original_token";

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
const LoginEmpleado = lazy(
  () => import("./features/auth/pages/LoginEmployeeRedirect")
);
const LoginGod = lazy(() => import("./features/auth/pages/LoginGodRedirect"));
const Register = lazy(() => import("./features/auth/pages/RegisterPage"));
const AccountHold = lazy(() => import("./features/auth/pages/AccountHoldPage"));

// Common / Public pages
const Home = lazy(() => import("./features/common/pages/HomePage"));
const Manual = lazy(() => import("./features/common/pages/ManualPage"));
const Catalog = lazy(() => import("./features/common/pages/CatalogPage"));
const PublicStorefront = lazy(
  () => import("./features/public-storefront/pages/PublicStorefrontPage")
);
const GodPanel = lazy(() => import("./features/common/pages/GodPanelPage"));
const DefectiveReports = lazy(
  () => import("./features/common/pages/DefectiveReportsPage")
);
const DefectiveProductsManagement = lazy(
  () => import("./features/common/pages/DefectiveProductsManagementPage")
);
const CustomerWarranty = lazy(
  () => import("./features/warranties/pages/CustomerWarrantyPage")
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
const AdminProductDetail = lazy(
  () => import("./features/inventory/pages/AdminProductDetailPage")
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
const PriceList = lazy(
  () => import("./features/inventory/pages/PriceListPage")
);

// Analytics pages
const AdvancedDashboard = lazy(
  () => import("./features/analytics/pages/AdvancedDashboardPage")
);
const AuditLogs = lazy(
  () => import("./features/analytics/pages/AuditLogsPage")
);
const Expenses = lazy(() => import("./features/analytics/pages/ExpensesPage"));
const ProfitHistory = lazy(
  () => import("./features/analytics/pages/ProfitHistoryPage")
);

// Sales pages
const Sales = lazy(() => import("./features/sales/pages/SalesPage"));
const SpecialSales = lazy(
  () => import("./features/sales/pages/SpecialSalesPage")
);
const StandardSale = lazy(
  () => import("./features/sales/pages/StandardSalePage")
);
const PromotionSale = lazy(
  () => import("./features/sales/pages/PromotionSalePage")
);

// Employees pages
const Employees = lazy(
  () => import("./features/employees/pages/EmployeesPage")
);
const AddEmployee = lazy(
  () => import("./features/employees/pages/AddEmployeePage")
);
const EmployeeDetail = lazy(
  () => import("./features/employees/pages/EmployeeDetailPage")
);
const EditEmployee = lazy(
  () => import("./features/employees/pages/EditEmployeePage")
);
const EmployeeDashboard = lazy(
  () => import("./features/employees/pages/EmployeeDashboardPage")
);
const EmployeeDashboardLayout = lazy(
  () => import("./features/employees/pages/EmployeeDashboardLayout")
);
const EmployeeProducts = lazy(
  () => import("./features/employees/pages/EmployeeProductsPage")
);
const EmployeeSales = lazy(
  () => import("./features/employees/pages/EmployeeSalesPage")
);
const EmployeeCredits = lazy(
  () => import("./features/employees/pages/EmployeeCreditsPage")
);
const EmployeeStats = lazy(
  () => import("./features/employees/pages/EmployeeStatsPage")
);
const EmployeeCatalog = lazy(
  () => import("./features/employees/pages/EmployeeCatalogPage")
);
const EmployeeCatalogShare = lazy(
  () => import("./features/employees/pages/EmployeeCatalogSharePage")
);
const EmployeeShipments = lazy(
  () => import("./features/employees/pages/EmployeeShipmentsPage")
);
const EmployeeRequestDispatch = lazy(
  () => import("./features/employees/pages/EmployeeRequestDispatchPage")
);
const PublicEmployeeCatalog = lazy(
  () => import("./features/employees/pages/PublicEmployeeCatalogPage")
);
const EmployeeAdvertising = lazy(
  () => import("./features/advertising/pages/EmployeeAdvertisingPage")
);
const EmployeeManagement = lazy(
  () => import("./features/staff/pages/EmployeeManagementPage")
);
const EmployeeSchedule = lazy(
  () => import("./features/scheduling/pages/EmployeeSchedulePage")
);
const AdminScheduleOverview = lazy(
  () => import("./features/scheduling/pages/AdminScheduleOverviewPage")
);
const Contracts = lazy(
  () => import("./features/contracts/pages/ContractsPage")
);
const OperativoStockManagement = lazy(
  () =>
    import("./features/employees/pages/operativo/OperativoStockManagementPage")
);
const OperativoGlobalInventory = lazy(
  () =>
    import("./features/employees/pages/operativo/OperativoGlobalInventoryPage")
);
const OperativoBranches = lazy(
  () => import("./features/employees/pages/operativo/OperativoBranchesPage")
);
const OperativoTransferHistory = lazy(
  () =>
    import("./features/employees/pages/operativo/OperativoTransferHistoryPage")
);
const OperativoSales = lazy(
  () => import("./features/employees/pages/operativo/OperativoSalesPage")
);
const OperativoAnalytics = lazy(
  () => import("./features/employees/pages/operativo/OperativoAnalyticsPage")
);
const OperativoExpenses = lazy(
  () => import("./features/employees/pages/operativo/OperativoExpensesPage")
);
const OperativoTeam = lazy(
  () => import("./features/employees/pages/operativo/OperativoTeamPage")
);
const OperativoPromotions = lazy(
  () => import("./features/employees/pages/operativo/OperativoPromotionsPage")
);
const OperativoProviders = lazy(
  () => import("./features/employees/pages/operativo/OperativoProvidersPage")
);
const OperativoCustomers = lazy(
  () => import("./features/employees/pages/operativo/OperativoCustomersPage")
);
const DemoPage = lazy(() => import("./features/demo/DemoPage"));

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
const PublicPageSettings = lazy(
  () => import("./features/business/pages/PublicPageSettingsPage")
);
const BusinessFullInfo = lazy(
  () => import("./features/business/pages/BusinessFullInfoPage")
);
const CreateBusiness = lazy(
  () => import("./features/business/pages/CreateBusinessPage")
);
const BusinessAssistant = lazy(
  () => import("./features/business/pages/BusinessAssistantPage")
);
const Onboarding = lazy(
  () => import("./features/business/pages/OnboardingPage")
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
const DispatchCenter = lazy(
  () => import("./features/branches/pages/DispatchCenterPage")
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
const Advertising = lazy(
  () => import("./features/advertising/pages/AdvertisingPage")
);

export default function App() {
  const location = useLocation();
  const { motionProfile } = useMotionProfile();
  const [isImpersonating, setIsImpersonating] = useState(
    typeof window !== "undefined" &&
      Boolean(localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY))
  );
  const routeTransition = useMemo(
    () => ({
      duration: motionProfile.routeDuration,
      ease: [0.22, 1, 0.36, 1] as const,
    }),
    [motionProfile.routeDuration]
  );

  useEffect(() => {
    const syncImpersonationState = () => {
      setIsImpersonating(
        Boolean(localStorage.getItem(ADMIN_ORIGINAL_TOKEN_KEY))
      );
    };

    window.addEventListener("auth-changed", syncImpersonationState);
    window.addEventListener("storage", syncImpersonationState);

    return () => {
      window.removeEventListener("auth-changed", syncImpersonationState);
      window.removeEventListener("storage", syncImpersonationState);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <Suspense fallback={<PageLoader />}>
          <ToastContainer position="top-right" />
          <ImpersonationBanner />
          <QuickGodAccess />
          <div className={isImpersonating ? "pt-10" : ""}>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={`${location.pathname}${location.search}`}
                className="essence-route-frame"
                initial={{
                  opacity: 0,
                  y: motionProfile.routeEnterY,
                  scale: motionProfile.routeEnterScale,
                  filter: `blur(${motionProfile.routeEnterBlur}px)`,
                }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  y: motionProfile.routeExitY,
                  scale: motionProfile.routeExitScale,
                  filter: `blur(${motionProfile.routeExitBlur}px)`,
                }}
                transition={routeTransition}
              >
                <Routes location={location}>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/manual" element={<Manual />} />
                  <Route path="/demo" element={<DemoPage />} />
                  <Route path="/account-hold" element={<AccountHold />} />
                  <Route path="/productos" element={<Catalog />} />
                  <Route path="/producto/:id" element={<ProductDetail />} />
                  <Route
                    path="/categoria/:slug"
                    element={<CategoryProducts />}
                  />
                  <Route
                    path="/staff-catalog/:employeeId"
                    element={<PublicEmployeeCatalog />}
                  />
                  <Route
                    path="/employee-catalog/:employeeId"
                    element={<PublicEmployeeCatalog />}
                  />
                  <Route path="/tienda/:slug" element={<PublicStorefront />} />

                  {/* Auth Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/login/admin" element={<LoginAdmin />} />
                  <Route path="/login/god" element={<LoginGod />} />
                  <Route path="/login/staff" element={<LoginEmpleado />} />
                  <Route path="/login/employee" element={<LoginEmpleado />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "admin",
                          "employee",
                          "super_admin",
                          "god",
                        ]}
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

                  {/* Shared authenticated route - accessible by admin and employee */}
                  <Route path="/catalog" element={<Catalog />} />

                  {/* Admin Routes */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "admin",
                          "super_admin",
                          "god",
                          "employee",
                          "viewer",
                        ]}
                      >
                        <DashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    {/* Redirect /admin to /admin/analytics */}
                    <Route
                      index
                      element={<Navigate to="/admin/analytics" replace />}
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
                      path="products/:id"
                      element={
                        <BusinessGate requiredFeature="products">
                          <AdminProductDetail />
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
                    <Route
                      path="price-list"
                      element={
                        <BusinessGate requiredFeature="products">
                          <PriceList />
                        </BusinessGate>
                      }
                    />
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
                      path="business-full-info"
                      element={
                        <BusinessGate requiredFeature="reports">
                          <BusinessFullInfo />
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
                      path="advanced-analytics"
                      element={<Navigate to="/admin/analytics" replace />}
                    />
                    {/* Legacy redirect for old dashboard URL */}
                    <Route
                      path="dashboard"
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
                    <Route
                      path="public-page"
                      element={
                        <BusinessGate>
                          <PublicPageSettings />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="business-settings"
                      element={<BusinessSettings />}
                    />
                    <Route
                      path="create-business"
                      element={<CreateBusiness />}
                    />
                    <Route path="user-settings" element={<UserSettings />} />
                    <Route
                      path="audit-logs"
                      element={
                        <BusinessGate requiredFeature="reports">
                          <AuditLogs />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="audit"
                      element={<Navigate to="/admin/audit-logs" replace />}
                    />
                    <Route
                      path="defective-products"
                      element={<DefectiveProductsManagement />}
                    />
                    <Route
                      path="warranties"
                      element={
                        <BusinessGate requiredFeature="defectiveProducts">
                          <CustomerWarranty />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="warrantiess"
                      element={<Navigate to="/admin/warranties" replace />}
                    />
                    <Route
                      path="register-sale"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <StandardSale />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="register-promotion"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <PromotionSale />
                        </BusinessGate>
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
                      path="dispatch"
                      element={
                        <BusinessGate requiredFeature="transfers">
                          <DispatchCenter />
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
                      path="staff/new"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <AddEmployee />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="staff"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <EmployeeManagement />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="employees"
                      element={<Navigate to="/admin/staff" replace />}
                    />
                    <Route
                      path="employees/add"
                      element={<Navigate to="/admin/staff/new" replace />}
                    />
                    <Route
                      path="employees/new"
                      element={<Navigate to="/admin/staff/new" replace />}
                    />
                    <Route
                      path="schedules"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <AdminScheduleOverview />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="schedules/edit/:employeeId"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <EmployeeSchedule />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="contracts"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <Contracts />
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
                      path="advertising"
                      element={
                        <BusinessGate>
                          <Advertising />
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
                      path="segments"
                      element={
                        <BusinessGate>
                          <Segments />
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

                  {/* Employee Routes */}
                  <Route
                    path="/staff"
                    element={
                      <ProtectedRoute allowedRoles={["employee"]}>
                        <EmployeeDashboardLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="dashboard" element={<EmployeeDashboard />} />
                    <Route
                      path="products"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <EmployeeProducts />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="catalog"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <EmployeeCatalog />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="share-catalog"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <EmployeeCatalogShare />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="advertising"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <EmployeeAdvertising />
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
                      path="request-dispatch"
                      element={
                        <BusinessGate requiredFeature="transfers">
                          <EmployeeRequestDispatch />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="my-shipments"
                      element={
                        <BusinessGate requiredFeature="transfers">
                          <EmployeeShipments />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="register-sale"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <StandardSale />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="register-promotion"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <PromotionSale />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/stock-management"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <OperativoStockManagement />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/global-inventory"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <OperativoGlobalInventory />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/branches"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <OperativoBranches />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/transfer-history"
                      element={
                        <BusinessGate requiredFeature="transfers">
                          <OperativoTransferHistory />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/sales"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <OperativoSales />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/analytics"
                      element={
                        <BusinessGate requiredFeature="reports">
                          <OperativoAnalytics />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/expenses"
                      element={
                        <BusinessGate requiredFeature="expenses">
                          <OperativoExpenses />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/team"
                      element={
                        <BusinessGate>
                          <OperativoTeam />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/promotions"
                      element={
                        <BusinessGate requiredFeature="promotions">
                          <OperativoPromotions />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/providers"
                      element={
                        <BusinessGate requiredFeature="inventory">
                          <OperativoProviders />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="operativo/customers"
                      element={
                        <BusinessGate>
                          <OperativoCustomers />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="sales"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <EmployeeSales />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="credits"
                      element={
                        <BusinessGate requiredFeature="sales">
                          <EmployeeCredits />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="stats"
                      element={
                        <BusinessGate requiredFeature="reports">
                          <EmployeeStats />
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
                      path="schedule"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <EmployeeSchedule />
                        </BusinessGate>
                      }
                    />
                    <Route
                      path="contracts"
                      element={
                        <BusinessGate requiredFeature="employees">
                          <Contracts />
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
                    <Route
                      path="warranties"
                      element={
                        <BusinessGate requiredFeature="defectiveProducts">
                          <CustomerWarranty />
                        </BusinessGate>
                      }
                    />
                  </Route>

                  <Route
                    path="/employee/*"
                    element={<Navigate to="/staff/dashboard" replace />}
                  />

                  {/* Redirect unknown routes to home */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </m.div>
            </AnimatePresence>
          </div>
        </Suspense>
      </LazyMotion>
    </MotionConfig>
  );
}
