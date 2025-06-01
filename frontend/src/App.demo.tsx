import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { DemoAuthProvider, useIsDemoMode } from './contexts/DemoAuthContext';
import { AuthProvider } from './store/auth-context';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { DemoLoginPage } from './pages/auth/DemoLoginPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DemoDashboard } from './pages/dashboard/DemoDashboard';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoanListPage } from './pages/loans/LoanListPage';
import { LoanCalculatorPage } from './pages/loans/LoanCalculatorPage';
import { CreateLoanPage } from './pages/loans/CreateLoanPage';
import { NotificationCenter } from './components/NotificationsTailwind';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { RecommendationsPage } from './pages/recommendations/RecommendationsPage';
import { DocumentDemoPage } from './pages/DocumentDemoPage';
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

function AppContent() {
  const isDemoMode = useIsDemoMode();

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
          <Route path="loans" element={<LoanListPage />} />
          <Route path="loans/new" element={<CreateLoanPage />} />
          <Route path="loans/:id" element={<div>Loan Details</div>} />
          <Route path="calculator" element={<LoanCalculatorPage />} />
          <Route path="reports" element={<div>Reports</div>} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="documents-demo" element={<DocumentDemoPage />} />
          <Route
            path="users"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                <div>Users Management</div>
              </ProtectedRoute>
            }
          />
          <Route path="settings" element={<div>Settings</div>} />
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
  const isDemoMode = useIsDemoMode();

  // Use demo auth provider in demo mode
  const AuthProviderComponent = isDemoMode ? DemoAuthProvider : AuthProvider;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProviderComponent>
        {isDemoMode ? (
          // In demo mode, skip WebSocket provider
          <AppContent />
        ) : (
          <WebSocketProvider>
            <AppContent />
          </WebSocketProvider>
        )}
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