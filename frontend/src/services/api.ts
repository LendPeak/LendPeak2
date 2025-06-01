import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token and asOfDate
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add asOfDate parameter for time travel functionality
        const asOfDate = this.getAsOfDate();
        if (asOfDate && config.method === 'get') {
          config.params = {
            ...config.params,
            asOfDate: asOfDate.toISOString()
          };
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            if (newToken && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            this.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  private getAsOfDate(): Date | null {
    // This should be integrated with the TimeTravelContext
    // For now, we'll return null and let individual methods handle it
    return null;
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = this.client
      .post<{ data: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
        refreshToken,
      })
      .then((response) => {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        this.setTokens(accessToken, newRefreshToken);
        this.refreshPromise = null;
        return accessToken;
      })
      .catch((error) => {
        this.refreshPromise = null;
        throw error;
      });

    return this.refreshPromise;
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post<{
      data: {
        user: any;
        tokens: {
          accessToken: string;
          refreshToken: string;
        };
      };
    }>('/auth/login', { email, password });

    const { user, tokens } = response.data.data;
    this.setTokens(tokens.accessToken, tokens.refreshToken);
    return { user, tokens };
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      try {
        await this.client.post('/auth/logout', { refreshToken });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    this.clearTokens();
  }

  async register(data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const response = await this.client.post<{
      data: {
        user: any;
        tokens: {
          accessToken: string;
          refreshToken: string;
        };
      };
    }>('/auth/register', data);

    const { user, tokens } = response.data.data;
    this.setTokens(tokens.accessToken, tokens.refreshToken);
    return { user, tokens };
  }

  async getCurrentUser() {
    const response = await this.client.get<{ data: any }>('/auth/me');
    return response.data.data;
  }

  // Loans endpoints
  async getLoans(params?: {
    page?: number;
    limit?: number;
    status?: string;
    borrowerId?: string;
    asOfDate?: string;
  }) {
    const response = await this.client.get<{ data: any[]; total: number }>('/loans', {
      params,
    });
    return response.data;
  }

  async getLoan(id: string) {
    const response = await this.client.get<{ data: any }>(`/loans/${id}`);
    return response.data.data;
  }

  async createLoan(data: any) {
    const response = await this.client.post<{ data: any }>('/loans', data);
    return response.data.data;
  }

  async updateLoan(id: string, data: any) {
    const response = await this.client.patch<{ data: any }>(`/loans/${id}`, data);
    return response.data.data;
  }

  async recordPayment(loanId: string, data: {
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    waterfallConfig?: any;
  }) {
    // Demo mode check
    if (import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_API_URL) {
      return this.recordDemoPayment(loanId, data);
    }
    const response = await this.client.post<{ data: any }>(`/payments/${loanId}`, data);
    return response.data.data;
  }

  async previewPayment(loanId: string, data: {
    amount: string;
    paymentDate?: string;
    waterfallConfig?: any;
  }) {
    // Demo mode check
    if (import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_API_URL) {
      return this.previewDemoPayment(loanId, data);
    }
    const response = await this.client.post<{ data: any }>(`/payments/preview/${loanId}`, data);
    return response.data.data;
  }

  async getLoanStatistics(asOfDate?: string) {
    const response = await this.client.get<{ data: any }>('/loans/statistics', {
      params: asOfDate ? { asOfDate } : undefined,
    });
    return response.data.data;
  }

  // Calculations endpoints
  async calculateLoan(data: {
    principal: string;
    annualRate: string;
    termMonths: number;
    startDate: string;
  }) {
    const response = await this.client.post<{ data: any }>('/calculations/loan', data);
    return response.data.data;
  }

  async calculateAmortization(data: {
    principal: string;
    annualRate: string;
    termMonths: number;
    startDate: string;
  }) {
    const response = await this.client.post<{ data: any }>('/calculations/amortization', data);
    return response.data.data;
  }

  async calculateDailyInterest(data: {
    principal: string;
    annualRate: string;
    days: number;
    calendar: string;
  }) {
    const response = await this.client.post<{ data: any }>('/calculations/interest/daily', data);
    return response.data.data;
  }

  async calculatePaymentSchedule(data: {
    principal: string;
    annualRate: string;
    termMonths: number;
    firstPaymentDate: string;
    calendar: string;
  }) {
    // Demo mode check
    if (import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_API_URL) {
      // Generate demo schedule
      return this.generateDemoSchedule(data);
    }
    const response = await this.client.post<{ data: any }>('/calculations/payment/schedule', data);
    return response.data.data;
  }
  
  private generateDemoSchedule(data: {
    principal: string;
    annualRate: string;
    termMonths: number;
    firstPaymentDate: string;
    calendar: string;
  }) {
    const principal = parseFloat(data.principal);
    const annualRate = parseFloat(data.annualRate);
    const termMonths = data.termMonths;
    const monthlyRate = annualRate / 100 / 12;
    
    // Calculate monthly payment
    const monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    const schedule = [];
    let balance = principal;
    const firstPaymentDate = new Date(data.firstPaymentDate);
    
    for (let i = 0; i < termMonths; i++) {
      const paymentDate = new Date(firstPaymentDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance -= principalPayment;
      
      schedule.push({
        paymentNumber: i + 1,
        paymentDate: paymentDate.toISOString(),
        scheduledPayment: monthlyPayment.toFixed(2),
        principal: principalPayment.toFixed(2),
        interest: interestPayment.toFixed(2),
        balance: Math.max(0, balance).toFixed(2),
      });
      
      if (balance <= 0) break;
    }
    
    return { schedule };
  }

  async applyWaterfall(data: {
    payment: string;
    outstandingAmounts: {
      interest?: string;
      principal?: string;
      fees?: string;
      escrow?: string;
      penalties?: string;
    };
    waterfallConfig?: any;
  }) {
    const response = await this.client.post<{ data: any }>('/calculations/waterfall/apply', data);
    return response.data.data;
  }

  // Users endpoints
  async getUsers(params?: {
    page?: number;
    limit?: number;
    searchTerm?: string;
    roles?: string[];
    status?: string;
  }) {
    const response = await this.client.get<{ data: any[]; total: number }>('/users', {
      params,
    });
    return response.data;
  }

  async getUser(id: string) {
    const response = await this.client.get<{ data: any }>(`/users/${id}`);
    return response.data.data;
  }

  async createUser(data: any) {
    const response = await this.client.post<{ data: any }>('/users', data);
    return response.data.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.client.patch<{ data: any }>(`/users/${id}`, data);
    return response.data.data;
  }

  async getUserStatistics() {
    const response = await this.client.get<{ data: any }>('/users/statistics');
    return response.data.data;
  }

  // Loan detail endpoints
  async getLoanPayments(loanId: string) {
    // Demo mode check
    if (import.meta.env.VITE_DEMO_MODE === 'true' || !import.meta.env.VITE_API_URL) {
      // Return demo payment data
      return this.generateDemoPayments(loanId);
    }
    const response = await this.client.get<{ data: any[] }>(`/loans/${loanId}/payments`);
    return response.data.data;
  }
  
  private generateDemoPayments(loanId: string) {
    const payments = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // Start 12 months ago
    
    for (let i = 0; i < 12; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      
      const status = i === 11 ? 'PENDING' : (i === 8 ? 'PARTIAL' : 'COMPLETED');
      const amount = 1500;
      const principal = 1000 + Math.random() * 100;
      const interest = 400 + Math.random() * 50;
      const fees = i === 8 ? 25 : 0;
      
      payments.push({
        _id: `payment_${i + 1}`,
        paymentNumber: i + 1,
        paymentDate: paymentDate.toISOString(),
        scheduledDate: paymentDate.toISOString(),
        amount: amount.toString(),
        principalPaid: principal.toString(),
        interestPaid: interest.toString(),
        feesPaid: fees.toString(),
        penaltiesPaid: '0',
        escrowPaid: '0',
        remainingBalance: (100000 - (principal * (i + 1))).toString(),
        status,
        paymentMethod: i % 3 === 0 ? 'ACH' : 'CHECK',
        reference: `REF${1000 + i}`,
        notes: i === 8 ? 'Partial payment received' : null,
      });
    }
    
    return payments;
  }
  
  private async recordDemoPayment(loanId: string, data: {
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
  }) {
    // Import dynamically to avoid circular dependency
    const { demoLoanStorage } = await import('./demoLoanStorage');
    
    // Get the loan to calculate allocations
    const loan = demoLoanStorage.getLoan(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }
    
    // Use LoanEngine to calculate payment allocation
    const paymentAmount = parseFloat(data.amount);
    const currentBalance = loan.currentBalance || loan.loanParameters?.principal || 100000;
    const annualRate = loan.interestRate || loan.loanParameters?.interestRate || 4.5;
    
    // Simple allocation logic for demo
    const monthlyRate = annualRate / 100 / 12;
    const interestPayment = currentBalance * monthlyRate;
    const principalPayment = Math.max(0, paymentAmount - interestPayment);
    const newBalance = Math.max(0, currentBalance - principalPayment);
    
    const allocations = {
      interest: Math.min(interestPayment, paymentAmount),
      principal: principalPayment,
      fees: 0,
      penalties: 0,
      escrow: 0,
      lateFees: 0,
      otherFees: 0,
    };
    
    const payment = await demoLoanStorage.recordPayment({
      loanId,
      paymentDate: new Date(data.paymentDate),
      amount: paymentAmount,
      allocations,
      remainingBalance: newBalance,
      status: 'COMPLETED' as const,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      notes: data.notes,
      createdBy: 'demo-user',
    });
    
    // Update loan balance
    demoLoanStorage.updateLoan(loanId, {
      currentBalance: newBalance,
      lastPaymentDate: new Date(data.paymentDate),
    });
    
    return {
      loan: demoLoanStorage.getLoan(loanId),
      payment: {
        ...payment,
        amount: payment.amount.toString(),
        allocations: {
          interest: allocations.interest.toString(),
          principal: allocations.principal.toString(),
          fees: allocations.fees.toString(),
          penalties: allocations.penalties.toString(),
          escrow: allocations.escrow.toString(),
          lateFees: allocations.lateFees.toString(),
          otherFees: allocations.otherFees.toString(),
        },
        newBalance: newBalance.toString(),
        overpayment: '0',
      },
      allocation: {
        totalAmount: paymentAmount.toString(),
        allocations: {
          interest: allocations.interest.toString(),
          principal: allocations.principal.toString(),
          fees: allocations.fees.toString(),
          penalties: allocations.penalties.toString(),
          escrow: allocations.escrow.toString(),
          lateFees: allocations.lateFees.toString(),
          otherFees: allocations.otherFees.toString(),
        },
        newBalance: newBalance.toString(),
        overpayment: '0',
      }
    };
  }
  
  private async previewDemoPayment(loanId: string, data: {
    amount: string;
    paymentDate?: string;
  }) {
    // Import dynamically to avoid circular dependency
    const { demoLoanStorage } = await import('./demoLoanStorage');
    
    // Get the loan to calculate allocations
    const loan = demoLoanStorage.getLoan(loanId);
    if (!loan) {
      throw new Error('Loan not found');
    }
    
    // Use similar logic as recordDemoPayment but don't save
    const paymentAmount = parseFloat(data.amount);
    const currentBalance = loan.currentBalance || loan.loanParameters?.principal || 100000;
    const annualRate = loan.interestRate || loan.loanParameters?.interestRate || 4.5;
    
    const monthlyRate = annualRate / 100 / 12;
    const interestPayment = currentBalance * monthlyRate;
    const principalPayment = Math.max(0, paymentAmount - interestPayment);
    const newBalance = Math.max(0, currentBalance - principalPayment);
    
    const allocations = {
      interest: Math.min(interestPayment, paymentAmount).toString(),
      principal: principalPayment.toString(),
      fees: '0',
      penalties: '0',
      escrow: '0',
      lateFees: '0',
      otherFees: '0',
    };
    
    return {
      allocation: {
        totalAmount: paymentAmount.toString(),
        allocations,
        newBalance: newBalance.toString(),
        overpayment: '0',
        effectiveDate: data.paymentDate || new Date().toISOString(),
      },
      validation: {
        isValid: true,
        warnings: paymentAmount < (currentBalance * monthlyRate) ? ['Payment is less than interest due'] : [],
        errors: [],
      },
      schedule: {
        remainingPayments: Math.ceil(newBalance / (paymentAmount || 1)),
        newBalance: newBalance.toString(),
        isPaidOff: newBalance <= 0,
        scheduledPayments: [],
      },
      outstandingAmounts: {
        currentBalance: currentBalance.toString(),
        accruedInterest: interestPayment.toString(),
        fees: '0',
        penalties: '0',
        lateFees: '0',
        escrow: '0',
      }
    };
  }

  async getLoanAuditTrail(loanId: string, asOfDate?: string) {
    const response = await this.client.get<{ data: any[] }>(`/loans/${loanId}/audit-trail`, {
      params: asOfDate ? { asOfDate } : undefined,
    });
    return response.data.data;
  }

  async getLoanModifications(loanId: string) {
    const response = await this.client.get<{ data: any[] }>(`/loans/${loanId}/modifications`);
    return response.data.data;
  }

  async updateLoanStatus(loanId: string, status: string, reason?: string) {
    const response = await this.client.patch<{ data: any }>(`/loans/${loanId}/status`, {
      status,
      reason,
    });
    return response.data.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;