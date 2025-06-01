/**
 * UI Integration Tests
 * 
 * These tests verify that all pages load without errors, display content,
 * and basic functionality works. They catch runtime errors that might
 * occur during actual user interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import userEvent from '@testing-library/user-event';

// Import pages to test
import { DemoLoanCalculatorPage } from '../pages/loans/DemoLoanCalculatorPage';
import { DemoDashboard } from '../pages/dashboard/DemoDashboard';
import { DemoLoginPage } from '../pages/auth/DemoLoginPage';
import { LoanDetailsPage } from '../pages/loans/LoanDetailsPage';
import { DemoLoanListPage } from '../pages/loans/DemoLoanListPage';
import { AnalyticsPage } from '../pages/analytics/AnalyticsPage';
import { RecommendationsPage } from '../pages/recommendations/RecommendationsPage';

// Import contexts
import { DemoAuthProvider } from '../contexts/DemoAuthContext';
import { AuthProvider } from '../store/auth-context';
import { WebSocketProvider } from '../contexts/WebSocketContext';

// Mock react-router-dom for testing
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/', state: null };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    useParams: () => ({ id: 'loan_001' }),
  };
});

// Mock react-datepicker
vi.mock('react-datepicker', () => ({
  default: ({ onChange, selected, ...props }: any) => (
    <input
      type="date"
      value={selected ? selected.toISOString().split('T')[0] : ''}
      onChange={(e) => onChange && onChange(new Date(e.target.value))}
      {...props}
    />
  ),
}));

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <DemoAuthProvider>
        <WebSocketProvider>
          {children}
          <ToastContainer />
        </WebSocketProvider>
      </DemoAuthProvider>
    </AuthProvider>
  </BrowserRouter>
);

// Utility to capture console errors during test
const captureConsoleErrors = () => {
  const errors: string[] = [];
  const originalError = console.error;
  
  console.error = (...args: any[]) => {
    errors.push(args.join(' '));
    originalError(...args);
  };
  
  return {
    getErrors: () => errors,
    restore: () => { console.error = originalError; }
  };
};

describe('UI Integration Tests', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.clearAllMocks();
  });

  describe('Authentication Pages', () => {
    it('should render login page without errors', async () => {
      const errorCapture = captureConsoleErrors();
      
      render(
        <TestWrapper>
          <DemoLoginPage />
        </TestWrapper>
      );

      // Check that page content is visible
      expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

      // Wait for any async operations to complete
      await waitFor(() => {
        expect(errorCapture.getErrors()).toHaveLength(0);
      });

      errorCapture.restore();
    });

    it('should handle login form submission', async () => {
      const user = userEvent.setup();
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <DemoLoginPage />
        </TestWrapper>
      );

      // Fill out login form
      await user.type(screen.getByLabelText(/email/i), 'demo@lendpeak.com');
      await user.type(screen.getByLabelText(/password/i), 'demo123');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Wait for any async operations
      await waitFor(() => {
        expect(errorCapture.getErrors()).toHaveLength(0);
      });

      errorCapture.restore();
    });
  });

  describe('Dashboard Pages', () => {
    it('should render demo dashboard without errors', async () => {
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <DemoDashboard />
        </TestWrapper>
      );

      // Check for dashboard content
      expect(screen.getByText(/portfolio overview/i)).toBeInTheDocument();
      
      // Wait for loan calculations to complete
      await waitFor(() => {
        expect(screen.getByText(/total portfolio value/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check that no console errors occurred
      expect(errorCapture.getErrors()).toHaveLength(0);
      errorCapture.restore();
    });

    it('should render analytics page without errors', async () => {
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <AnalyticsPage />
        </TestWrapper>
      );

      // Check for analytics content
      expect(screen.getByText(/analytics/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(errorCapture.getErrors()).toHaveLength(0);
      });

      errorCapture.restore();
    });
  });

  describe('Loan Pages', () => {
    it('should render loan calculator without errors', async () => {
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <DemoLoanCalculatorPage />
        </TestWrapper>
      );

      // Check for calculator content
      expect(screen.getByText(/loan calculator/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/loan amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/annual interest rate/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(errorCapture.getErrors()).toHaveLength(0);
      });

      errorCapture.restore();
    });

    it('should perform loan calculation without errors', async () => {
      const user = userEvent.setup();
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <DemoLoanCalculatorPage />
        </TestWrapper>
      );

      // Fill out loan parameters
      const principalInput = screen.getByLabelText(/loan amount/i);
      const rateInput = screen.getByLabelText(/annual interest rate/i);
      const termInput = screen.getByLabelText(/loan term/i);

      await user.clear(principalInput);
      await user.type(principalInput, '100000');
      
      await user.clear(rateInput);
      await user.type(rateInput, '5.5');
      
      await user.clear(termInput);
      await user.type(termInput, '360');

      // Submit calculation
      const calculateButton = screen.getByRole('button', { name: /calculate loan/i });
      await user.click(calculateButton);

      // Wait for calculation results
      await waitFor(() => {
        expect(screen.getByText(/monthly payment/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check for no errors during calculation
      expect(errorCapture.getErrors()).toHaveLength(0);
      errorCapture.restore();
    });

    it('should render loan list without errors', async () => {
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <DemoLoanListPage />
        </TestWrapper>
      );

      // Check for loan list content
      expect(screen.getByText(/loan portfolio/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(errorCapture.getErrors()).toHaveLength(0);
      });

      errorCapture.restore();
    });

    it('should render loan details without errors', async () => {
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <LoanDetailsPage />
        </TestWrapper>
      );

      // Wait for loan details to load
      await waitFor(() => {
        expect(screen.getByText(/loan overview/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check that no console errors occurred
      expect(errorCapture.getErrors()).toHaveLength(0);
      errorCapture.restore();
    });
  });

  describe('Feature Pages', () => {
    it('should render recommendations page without errors', async () => {
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <RecommendationsPage />
        </TestWrapper>
      );

      // Check for recommendations content
      expect(screen.getByText(/recommendations/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(errorCapture.getErrors()).toHaveLength(0);
      });

      errorCapture.restore();
    });
  });

  describe('Error Boundary Tests', () => {
    it('should handle component errors gracefully', async () => {
      const errorCapture = captureConsoleErrors();

      // Test with invalid loan data that might cause errors
      const invalidLoanState = {
        template: {
          principal: null,
          interestRate: 'invalid',
          termMonths: -1,
        }
      };

      mockLocation.state = invalidLoanState;

      render(
        <TestWrapper>
          <DemoLoanCalculatorPage />
        </TestWrapper>
      );

      // Page should still render even with invalid data
      expect(screen.getByText(/loan calculator/i)).toBeInTheDocument();

      await waitFor(() => {
        // Some errors might be expected and handled, but shouldn't crash the app
        const errors = errorCapture.getErrors();
        const fatalErrors = errors.filter(error => 
          error.includes('TypeError') || 
          error.includes('ReferenceError') ||
          error.includes('Cannot read properties of undefined')
        );
        expect(fatalErrors).toHaveLength(0);
      });

      errorCapture.restore();
    });
  });

  describe('LoanEngine Integration Tests', () => {
    it('should handle various loan calculation scenarios without errors', async () => {
      const user = userEvent.setup();
      const errorCapture = captureConsoleErrors();

      render(
        <TestWrapper>
          <DemoLoanCalculatorPage />
        </TestWrapper>
      );

      // Test different loan scenarios
      const scenarios = [
        { principal: '50000', rate: '3.5', term: '180' },
        { principal: '250000', rate: '6.8', term: '360' },
        { principal: '15000', rate: '12.5', term: '60' },
      ];

      for (const scenario of scenarios) {
        const principalInput = screen.getByLabelText(/loan amount/i);
        const rateInput = screen.getByLabelText(/annual interest rate/i);
        const termInput = screen.getByLabelText(/loan term/i);

        await user.clear(principalInput);
        await user.type(principalInput, scenario.principal);
        
        await user.clear(rateInput);
        await user.type(rateInput, scenario.rate);
        
        await user.clear(termInput);
        await user.type(termInput, scenario.term);

        // Calculate
        await user.click(screen.getByRole('button', { name: /calculate loan/i }));

        // Wait for results
        await waitFor(() => {
          expect(screen.getByText(/monthly payment/i)).toBeInTheDocument();
        });
      }

      // Check for no errors across all scenarios
      expect(errorCapture.getErrors()).toHaveLength(0);
      errorCapture.restore();
    });
  });
});