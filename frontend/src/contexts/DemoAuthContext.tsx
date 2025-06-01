import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DEMO_USER } from '../demo/demoData';

interface DemoAuthContextType {
  isAuthenticated: boolean;
  user: typeof DEMO_USER | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isDemoMode: boolean;
}

const DemoAuthContext = createContext<DemoAuthContextType>({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  logout: () => {},
  isDemoMode: true,
});

export const useDemoAuth = () => {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error('useDemoAuth must be used within DemoAuthProvider');
  }
  return context;
};

interface DemoAuthProviderProps {
  children: ReactNode;
}

export const DemoAuthProvider: React.FC<DemoAuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check if user was previously logged in (stored in localStorage)
    const savedAuth = localStorage.getItem('demo_auth');
    return savedAuth === 'true';
  });
  
  const [user, setUser] = useState<typeof DEMO_USER | null>(() => {
    // Restore user if previously authenticated
    const savedAuth = localStorage.getItem('demo_auth');
    return savedAuth === 'true' ? DEMO_USER : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    // Simulate async login
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check demo credentials
    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      setIsAuthenticated(true);
      setUser(DEMO_USER);
      localStorage.setItem('demo_auth', 'true');
    } else {
      throw new Error('Invalid demo credentials. Use demo@lendpeak.com / demo123');
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('demo_auth');
  }, []);

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    isDemoMode: true,
  };

  return (
    <DemoAuthContext.Provider value={value}>
      {children}
    </DemoAuthContext.Provider>
  );
};

// Helper hook to check if we're in demo mode
export const useIsDemoMode = () => {
  // Check if VITE_DEMO_MODE is set to 'true' or if no backend URL is configured
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || 
                    !import.meta.env.VITE_API_URL ||
                    import.meta.env.VITE_API_URL === 'demo';
  return isDemoMode;
};