import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/auth-context';
import { useDemoAuth } from '../../contexts/DemoAuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
}

// Check if we're in demo mode
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || 
                  !import.meta.env.VITE_API_URL || 
                  import.meta.env.VITE_API_URL === 'demo';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  requiredPermissions = [],
}) => {
  const location = useLocation();
  
  // Use demo auth in demo mode, regular auth otherwise
  const authContext = isDemoMode ? useDemoAuth() : useAuth();
  const { isAuthenticated } = authContext;
  
  // In demo mode, we have simplified auth
  if (isDemoMode) {
    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    // In demo mode, grant all permissions
    return <>{children}</>;
  }
  
  // Regular auth flow
  const { isLoading, hasRole, hasPermission } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasRequiredRoles = requiredRoles.length === 0 || requiredRoles.some(role => hasRole(role));
  const hasRequiredPermissions = requiredPermissions.length === 0 || requiredPermissions.some(permission => hasPermission(permission));

  if (!hasRequiredRoles || !hasRequiredPermissions) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};