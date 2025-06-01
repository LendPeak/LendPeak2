import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './store/auth-context';
import { DemoAuthProvider } from './contexts/DemoAuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { TimeTravelProvider } from './contexts/TimeTravelContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { DemoLoginPage } from './pages/auth/DemoLoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DemoDashboard } from './pages/dashboard/DemoDashboard';
import { LoanListPage } from './pages/loans/LoanListPage';
import { DemoLoanListPage } from './pages/loans/DemoLoanListPage';
import { LoanCalculatorPage } from './pages/loans/LoanCalculatorPage';
import { DemoLoanCalculatorPage } from './pages/loans/DemoLoanCalculatorPage';
import { CreateLoanPage } from './pages/loans/CreateLoanPage';
import { PerDiemCalculatorPage } from './pages/loans/PerDiemCalculatorPage';
import { LoanDetailsPage } from './pages/loans/LoanDetailsPage';
import { AmortizationSchedulePage } from './pages/loans/AmortizationSchedulePage';
import { NotificationCenter } from './components/NotificationsTailwind';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { BusinessIntelligencePage } from './pages/analytics/BusinessIntelligencePage';
import { RecommendationsPage } from './pages/recommendations/RecommendationsPage';
import { DocumentDemoPage } from './pages/DocumentDemoPage';
import DemoShowcasePage from './pages/DemoShowcasePage';
import PerformanceTestPage from './pages/PerformanceTestPage';
import SimpleDemoPage from './pages/SimpleDemoPage';
import CacheTestPage from './pages/CacheTestPage';
import SimpleCacheTestPage from './pages/SimpleCacheTestPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { UsersManagementPage } from './pages/users/UsersManagementPage';
import { CollectionsPage } from './pages/collections/CollectionsPage';
import { DelinquencyPage } from './pages/delinquency/DelinquencyPage';
import { LoanOriginationPage } from './pages/loans/LoanOriginationPage';
import { PaymentRetryPage } from './pages/payments/PaymentRetryPage';
import { BulkPaymentPage } from './pages/payments/BulkPaymentPage';
import { SuspenseAccountPage } from './pages/payments/SuspenseAccountPage';
import { SystemConfigurationPage } from './pages/admin/SystemConfigurationPage';
import { PortfolioPage } from './pages/portfolio/PortfolioPage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Check if we're in demo mode
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_API_URL || import.meta.env.VITE_API_URL === 'demo';

function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={isDemoMode ? <DemoLoginPage /> : <LoginPage />} />
            <Route path="/register" element={isDemoMode ? <Navigate to="/login" replace /> : <RegisterPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={isDemoMode ? <DemoDashboard /> : <DashboardPage />} />
              <Route path="loans" element={isDemoMode ? <DemoLoanListPage /> : <LoanListPage />} />
              <Route path="loans/new" element={<CreateLoanPage />} />
              <Route path="loans/:id" element={<LoanDetailsPage />} />
              <Route path="loans/origination" element={<LoanOriginationPage />} />
              <Route path="calculator" element={isDemoMode ? <DemoLoanCalculatorPage /> : <LoanCalculatorPage />} />
              <Route path="per-diem" element={<PerDiemCalculatorPage />} />
              <Route path="amortization" element={<AmortizationSchedulePage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="delinquency" element={<DelinquencyPage />} />
              <Route path="payments/retry" element={<PaymentRetryPage />} />
              <Route path="payments/bulk" element={<BulkPaymentPage />} />
              <Route path="payments/suspense" element={<SuspenseAccountPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="analytics/business-intelligence" element={<BusinessIntelligencePage />} />
              <Route path="recommendations" element={<RecommendationsPage />} />
              <Route path="demo" element={<DemoShowcasePage />} />
              <Route path="simple-demo" element={<SimpleDemoPage />} />
              <Route path="cache-test" element={<CacheTestPage />} />
              <Route path="simple-cache-test" element={<SimpleCacheTestPage />} />
              <Route path="perf-test" element={<PerformanceTestPage />} />
              <Route path="documents-demo" element={<DocumentDemoPage />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                    <UsersManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/system"
                element={
                  <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                    <SystemConfigurationPage />
                  </ProtectedRoute>
                }
              />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="notifications" element={<NotificationCenter />} />
            </Route>

            {/* Error pages */}
            <Route path="/unauthorized" element={<div>Unauthorized</div>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
  );
}

function App() {
  const AuthProviderComponent = isDemoMode ? DemoAuthProvider : AuthProvider;
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProviderComponent>
        <TimeTravelProvider>
          {isDemoMode ? (
            // In demo mode, skip WebSocket provider
            <AppRoutes />
          ) : (
            <WebSocketProvider>
              <AppRoutes />
            </WebSocketProvider>
          )}
        </TimeTravelProvider>
      </AuthProviderComponent>
      <ReactQueryDevtools initialIsOpen={false} />
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </QueryClientProvider>
  );
}

export default App;