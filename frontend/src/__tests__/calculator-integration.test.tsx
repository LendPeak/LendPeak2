/**
 * Calculator Integration Test - specifically to catch the round error
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DemoLoanCalculatorPage } from '../pages/loans/DemoLoanCalculatorPage';
import { AuthProvider } from '../store/auth-context';
import { DemoAuthProvider } from '../contexts/DemoAuthContext';

// Mock dependencies that might cause issues
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/', state: null }),
  };
});

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
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <DemoAuthProvider>
        {children}
      </DemoAuthProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Calculator Integration - Error Detection', () => {
  it('should catch runtime errors during calculation', { timeout: 15000 }, async () => {
    // Capture console errors
    const originalError = console.error;
    const errors: any[] = [];
    console.error = (...args) => {
      errors.push(args);
      originalError(...args);
    };

    const { getByDisplayValue, getByRole } = render(
      <TestWrapper>
        <DemoLoanCalculatorPage />
      </TestWrapper>
    );

    // Try to trigger the calculation with various inputs
    try {
      // Find the form inputs by name attribute
      const principalInput = document.querySelector('input[name="principal"]') as HTMLInputElement;
      const rateInput = document.querySelector('input[name="annualRate"]') as HTMLInputElement;
      const termInput = document.querySelector('input[name="termMonths"]') as HTMLInputElement;
      
      expect(principalInput).toBeTruthy();
      expect(rateInput).toBeTruthy();
      expect(termInput).toBeTruthy();

      // Clear and set new values
      if (principalInput) fireEvent.change(principalInput, { target: { value: '150000' } });
      if (rateInput) fireEvent.change(rateInput, { target: { value: '6.25' } });
      if (termInput) fireEvent.change(termInput, { target: { value: '240' } });

      // Submit the form
      const calculateButton = getByRole('button', { name: /calculate loan/i });
      await act(async () => {
        fireEvent.click(calculateButton);
      });

      // Wait for any calculations to complete
      await waitFor(() => {
        // Check if there are any runtime errors
        const runtimeErrors = errors.filter(errorArgs => 
          errorArgs.some(arg => 
            typeof arg === 'string' && (
              arg.includes('value.round is not a function') ||
              arg.includes('TypeError') ||
              arg.includes('Cannot read properties of undefined')
            )
          )
        );

        if (runtimeErrors.length > 0) {
          console.log('Captured runtime errors:', runtimeErrors);
          throw new Error(`Runtime errors detected: ${JSON.stringify(runtimeErrors)}`);
        }
      }, { timeout: 10000 });

    } finally {
      console.error = originalError;
    }

    // If we get here without throwing, the test passed
    expect(errors.filter(e => e.some(arg => typeof arg === 'string' && arg.includes('value.round is not a function')))).toHaveLength(0);
  });

  it('should handle edge cases that might trigger rounding errors', { timeout: 15000 }, async () => {
    const originalError = console.error;
    const errors: any[] = [];
    console.error = (...args) => {
      errors.push(args);
      originalError(...args);
    };

    const { getByDisplayValue, getByRole } = render(
      <TestWrapper>
        <DemoLoanCalculatorPage />
      </TestWrapper>
    );

    try {
      // Test edge cases that might cause rounding issues
      const edgeCases = [
        { principal: '0.01', rate: '0.01', term: '1' },
        { principal: '999999.99', rate: '49.99', term: '480' },
        { principal: '100000.001', rate: '5.555', term: '360' },
      ];

      for (const testCase of edgeCases) {
        const principalInput = document.querySelector('input[name="principal"]') as HTMLInputElement;
        const rateInput = document.querySelector('input[name="annualRate"]') as HTMLInputElement;
        const termInput = document.querySelector('input[name="termMonths"]') as HTMLInputElement;

        if (principalInput) fireEvent.change(principalInput, { target: { value: testCase.principal } });
        if (rateInput) fireEvent.change(rateInput, { target: { value: testCase.rate } });
        if (termInput) fireEvent.change(termInput, { target: { value: testCase.term } });

        const calculateButton = getByRole('button', { name: /calculate loan/i });
        await act(async () => {
          fireEvent.click(calculateButton);
        });

        // Wait briefly for calculation
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Check for rounding errors
      const roundingErrors = errors.filter(errorArgs => 
        errorArgs.some(arg => 
          typeof arg === 'string' && arg.includes('value.round is not a function')
        )
      );

      expect(roundingErrors).toHaveLength(0);

    } finally {
      console.error = originalError;
    }
  });
});