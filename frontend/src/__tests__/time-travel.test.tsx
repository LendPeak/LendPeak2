import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimeTravelProvider, useTimeTravel } from '../contexts/TimeTravelContext';
import { TimeTravelBar } from '../components/TimeTravelBar';
import apiClient from '../services/api';

// Mock the API client
vi.mock('../services/api', () => ({
  default: {
    getLoanStatistics: vi.fn(),
    getLoans: vi.fn(),
    getLoanAuditTrail: vi.fn(),
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date) => date.toISOString().split('T')[0]),
  isAfter: vi.fn((date1, date2) => date1 > date2),
  isBefore: vi.fn((date1, date2) => date1 < date2),
  startOfDay: vi.fn((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())),
  endOfDay: vi.fn((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)),
  subDays: vi.fn((date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000)),
  subMonths: vi.fn((date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
  }),
  endOfMonth: vi.fn((date) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1, 0);
    return result;
  }),
  endOfQuarter: vi.fn((date) => {
    const quarter = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), quarter * 3 + 3, 0);
  }),
  endOfYear: vi.fn((date) => new Date(date.getFullYear(), 11, 31)),
}));

// Test component that uses time travel
function TestComponent() {
  const { asOfDate, isTimeTravelActive, mode, setAsOfDate, resetToPresent } = useTimeTravel();
  
  return (
    <div>
      <div data-testid="as-of-date">{asOfDate ? asOfDate.toISOString() : 'null'}</div>
      <div data-testid="is-time-travel-active">{isTimeTravelActive.toString()}</div>
      <div data-testid="mode">{mode}</div>
      <button 
        data-testid="set-historical-date" 
        onClick={() => setAsOfDate(new Date('2023-01-01'))}
      >
        Set Historical Date
      </button>
      <button 
        data-testid="set-future-date" 
        onClick={() => setAsOfDate(new Date('2025-12-31'))}
      >
        Set Future Date
      </button>
      <button 
        data-testid="reset-to-present" 
        onClick={resetToPresent}
      >
        Reset to Present
      </button>
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TimeTravelProvider>
        {children}
      </TimeTravelProvider>
    </QueryClientProvider>
  );
}

describe('Time Travel Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TimeTravelContext', () => {
    it('should initialize with current date mode', () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('as-of-date')).toHaveTextContent('null');
      expect(screen.getByTestId('is-time-travel-active')).toHaveTextContent('false');
      expect(screen.getByTestId('mode')).toHaveTextContent('CURRENT');
    });

    it('should set historical date and update mode', () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('set-historical-date'));

      expect(screen.getByTestId('is-time-travel-active')).toHaveTextContent('true');
      expect(screen.getByTestId('mode')).toHaveTextContent('HISTORICAL');
      const asOfDate = screen.getByTestId('as-of-date').textContent;
      expect(asOfDate).toContain('2023-01-01');
    });

    it('should set future date and update mode', () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('set-future-date'));

      expect(screen.getByTestId('is-time-travel-active')).toHaveTextContent('true');
      expect(screen.getByTestId('mode')).toHaveTextContent('FUTURE');
      const asOfDate = screen.getByTestId('as-of-date').textContent;
      expect(asOfDate).toContain('2025-12-31');
    });

    it('should reset to present', () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Set a historical date first
      fireEvent.click(screen.getByTestId('set-historical-date'));
      expect(screen.getByTestId('is-time-travel-active')).toHaveTextContent('true');

      // Reset to present
      fireEvent.click(screen.getByTestId('reset-to-present'));
      expect(screen.getByTestId('as-of-date')).toHaveTextContent('null');
      expect(screen.getByTestId('is-time-travel-active')).toHaveTextContent('false');
      expect(screen.getByTestId('mode')).toHaveTextContent('CURRENT');
    });
  });

  describe('TimeTravelBar Component', () => {
    it('should render time travel bar in inactive state', () => {
      render(
        <TestWrapper>
          <TimeTravelBar />
        </TestWrapper>
      );

      expect(screen.getByText('As of:')).toBeInTheDocument();
      expect(screen.getByText('Current view')).toBeInTheDocument();
    });

    it('should show active state when time travel is enabled', () => {
      render(
        <TestWrapper>
          <TestComponent />
          <TimeTravelBar />
        </TestWrapper>
      );

      // Set historical date
      fireEvent.click(screen.getByTestId('set-historical-date'));

      expect(screen.getByText('Historical')).toBeInTheDocument();
      expect(screen.getByText('Return to Present')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should call API with asOfDate parameter when date is set', async () => {
      const mockGetLoanStatistics = vi.mocked(apiClient.getLoanStatistics);
      mockGetLoanStatistics.mockResolvedValue({
        totalLoans: 10,
        activeLoans: 8,
        delinquentLoans: 2,
      });

      // Component that uses API
      function APITestComponent() {
        const { asOfDate } = useTimeTravel();
        
        const callAPI = () => {
          apiClient.getLoanStatistics(asOfDate?.toISOString());
        };

        return (
          <div>
            <button data-testid="call-api" onClick={callAPI}>Call API</button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
          <APITestComponent />
        </TestWrapper>
      );

      // Set historical date
      fireEvent.click(screen.getByTestId('set-historical-date'));
      
      // Call API
      fireEvent.click(screen.getByTestId('call-api'));

      await waitFor(() => {
        expect(mockGetLoanStatistics).toHaveBeenCalledWith(
          expect.stringContaining('2023-01-01')
        );
      });
    });

    it('should call API without asOfDate when in current mode', async () => {
      const mockGetLoanStatistics = vi.mocked(apiClient.getLoanStatistics);
      mockGetLoanStatistics.mockResolvedValue({
        totalLoans: 10,
        activeLoans: 8,
        delinquentLoans: 2,
      });

      // Component that uses API
      function APITestComponent() {
        const { asOfDate } = useTimeTravel();
        
        const callAPI = () => {
          apiClient.getLoanStatistics(asOfDate?.toISOString());
        };

        return (
          <div>
            <button data-testid="call-api" onClick={callAPI}>Call API</button>
          </div>
        );
      }

      render(
        <TestWrapper>
          <APITestComponent />
        </TestWrapper>
      );

      // Call API without setting date
      fireEvent.click(screen.getByTestId('call-api'));

      await waitFor(() => {
        expect(mockGetLoanStatistics).toHaveBeenCalledWith(undefined);
      });
    });
  });

  describe('Visual Indicators', () => {
    it('should apply different styles for different modes', () => {
      render(
        <TestWrapper>
          <TestComponent />
          <TimeTravelBar />
        </TestWrapper>
      );

      // Set historical date
      fireEvent.click(screen.getByTestId('set-historical-date'));

      // Check for historical styling (amber colors)
      const timeTravelBar = screen.getByText('Historical').closest('div');
      expect(timeTravelBar).toHaveClass('bg-amber-100');
    });

    it('should show data filtered indicator for historical mode', () => {
      render(
        <TestWrapper>
          <TestComponent />
          <TimeTravelBar />
        </TestWrapper>
      );

      // Set historical date
      fireEvent.click(screen.getByTestId('set-historical-date'));

      expect(screen.getByText('Data filtered')).toBeInTheDocument();
    });

    it('should show projected indicator for future mode', () => {
      render(
        <TestWrapper>
          <TestComponent />
          <TimeTravelBar />
        </TestWrapper>
      );

      // Set future date
      fireEvent.click(screen.getByTestId('set-future-date'));

      expect(screen.getByText('Projected')).toBeInTheDocument();
    });
  });
});