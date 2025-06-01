// Demo data for browser-only mode
import type { LoanParameters } from '@lendpeak/engine';
import { DEMO_WATERFALL_TEMPLATES } from '../../../src/demo/demoLoanLibrary';

// Use waterfall templates from the comprehensive demo library
const WATERFALL_TEMPLATES = DEMO_WATERFALL_TEMPLATES;

export interface DemoCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string;
  dateOfBirth: string;
  creditScore: number;
  annualIncome: number;
  employmentStatus: 'EMPLOYED' | 'SELF_EMPLOYED' | 'RETIRED' | 'STUDENT';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface DemoLoan {
  id: string;
  customerId: string;
  loanParameters: LoanParameters;
  status: 'PENDING' | 'ACTIVE' | 'PAID_OFF' | 'DEFAULTED';
  applicationDate: Date;
  approvalDate?: Date;
  disbursementDate?: Date;
  purpose: string;
  notes?: string;
}

// Demo customers
export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    id: 'cust_001',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    ssn: '123-45-6789',
    dateOfBirth: '1985-06-15',
    creditScore: 750,
    annualIncome: 85000,
    employmentStatus: 'EMPLOYED',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
    },
  },
  {
    id: 'cust_002',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@example.com',
    phone: '+1 (555) 234-5678',
    ssn: '234-56-7890',
    dateOfBirth: '1990-03-22',
    creditScore: 680,
    annualIncome: 65000,
    employmentStatus: 'SELF_EMPLOYED',
    address: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
    },
  },
  {
    id: 'cust_003',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@example.com',
    phone: '+1 (555) 345-6789',
    ssn: '345-67-8901',
    dateOfBirth: '1978-11-08',
    creditScore: 820,
    annualIncome: 120000,
    employmentStatus: 'EMPLOYED',
    address: {
      street: '789 Pine Rd',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
    },
  },
  {
    id: 'cust_004',
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@example.com',
    phone: '+1 (555) 456-7890',
    ssn: '456-78-9012',
    dateOfBirth: '1992-09-30',
    creditScore: 720,
    annualIncome: 55000,
    employmentStatus: 'EMPLOYED',
    address: {
      street: '321 Elm St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
    },
  },
];

// Demo loans
export const DEMO_LOANS: DemoLoan[] = [
  {
    id: 'loan_001',
    customerId: 'cust_001',
    loanParameters: {
      principal: 25000,
      interestRate: 6.5,
      termMonths: 60,
      interestType: 'FIXED',
      paymentFrequency: 'monthly',
      startDate: new Date('2024-01-15'),
      calendarType: 'ACTUAL/365',
      accrualTiming: 'DAY_1',
      perDiemMethod: 'STABLE',
      paymentWaterfall: WATERFALL_TEMPLATES[0],
      fees: {
        originationFee: 1.5,
        processingFee: 299,
      },
    },
    status: 'ACTIVE',
    applicationDate: new Date('2024-01-01'),
    approvalDate: new Date('2024-01-05'),
    disbursementDate: new Date('2024-01-15'),
    purpose: 'Auto Loan - 2023 Honda Accord',
  },
  {
    id: 'loan_002',
    customerId: 'cust_002',
    loanParameters: {
      principal: 15000,
      interestRate: 8.9,
      termMonths: 36,
      interestType: 'FIXED',
      paymentFrequency: 'monthly',
      startDate: new Date('2024-03-01'),
      calendarType: 'ACTUAL/365',
      accrualTiming: 'DAY_1',
      perDiemMethod: 'STABLE',
      paymentWaterfall: WATERFALL_TEMPLATES[0],
      fees: {
        originationFee: 2.0,
        processingFee: 199,
      },
    },
    status: 'ACTIVE',
    applicationDate: new Date('2024-02-15'),
    approvalDate: new Date('2024-02-20'),
    disbursementDate: new Date('2024-03-01'),
    purpose: 'Business Equipment Purchase',
  },
  {
    id: 'loan_003',
    customerId: 'cust_003',
    loanParameters: {
      principal: 350000,
      interestRate: 5.75,
      termMonths: 360,
      interestType: 'FIXED',
      paymentFrequency: 'monthly',
      startDate: new Date('2023-06-01'),
      calendarType: '30/360',
      accrualTiming: 'DAY_1',
      perDiemMethod: 'STABLE',
      paymentWaterfall: WATERFALL_TEMPLATES[0],
      fees: {
        originationFee: 0.5,
        processingFee: 1500,
      },
    },
    status: 'ACTIVE',
    applicationDate: new Date('2023-05-01'),
    approvalDate: new Date('2023-05-15'),
    disbursementDate: new Date('2023-06-01'),
    purpose: 'Home Mortgage - Primary Residence',
  },
  {
    id: 'loan_004',
    customerId: 'cust_001',
    loanParameters: {
      principal: 10000,
      interestRate: 7.2,
      termMonths: 24,
      interestType: 'FIXED',
      paymentFrequency: 'monthly',
      startDate: new Date('2023-01-01'),
      calendarType: 'ACTUAL/365',
      accrualTiming: 'DAY_1',
      perDiemMethod: 'STABLE',
      paymentWaterfall: WATERFALL_TEMPLATES[0],
      fees: {
        originationFee: 1.0,
        processingFee: 99,
      },
    },
    status: 'PAID_OFF',
    applicationDate: new Date('2022-12-15'),
    approvalDate: new Date('2022-12-20'),
    disbursementDate: new Date('2023-01-01'),
    purpose: 'Personal Loan - Debt Consolidation',
  },
  {
    id: 'loan_005',
    customerId: 'cust_004',
    loanParameters: {
      principal: 5000,
      interestRate: 12.5,
      termMonths: 12,
      interestType: 'COMPOUND',
      paymentFrequency: 'monthly',
      compoundingFrequency: 'MONTHLY',
      startDate: new Date('2024-04-01'),
      calendarType: 'ACTUAL/365',
      accrualTiming: 'DAY_0',
      perDiemMethod: 'VARIABLE',
      paymentWaterfall: WATERFALL_TEMPLATES[1],
    },
    status: 'PENDING',
    applicationDate: new Date('2024-03-25'),
    purpose: 'Emergency Medical Expenses',
  },
  {
    id: 'loan_006',
    customerId: 'cust_003',
    loanParameters: {
      principal: 50000,
      interestRate: 6.0,
      termMonths: 84,
      interestType: 'VARIABLE',
      paymentFrequency: 'monthly',
      startDate: new Date('2024-02-01'),
      calendarType: 'ACTUAL/365',
      accrualTiming: 'DAY_1',
      perDiemMethod: 'STABLE',
      paymentWaterfall: WATERFALL_TEMPLATES[0],
      fees: {
        originationFee: 1.25,
        processingFee: 499,
      },
    },
    status: 'ACTIVE',
    applicationDate: new Date('2024-01-15'),
    approvalDate: new Date('2024-01-25'),
    disbursementDate: new Date('2024-02-01'),
    purpose: 'Investment Property Down Payment',
  },
];

// Demo loan templates for quick calculations
export const LOAN_TEMPLATES = [
  {
    name: 'Auto Loan',
    description: 'Typical car loan terms',
    template: {
      principal: 30000,
      interestRate: 5.9,
      termMonths: 60,
      interestType: 'FIXED' as const,
      paymentFrequency: 'monthly' as const,
      fees: {
        originationFee: 1.0,
        processingFee: 299,
      },
    },
  },
  {
    name: 'Personal Loan',
    description: 'Unsecured personal loan',
    template: {
      principal: 10000,
      interestRate: 9.5,
      termMonths: 36,
      interestType: 'FIXED' as const,
      paymentFrequency: 'monthly' as const,
      fees: {
        originationFee: 2.5,
        processingFee: 199,
      },
    },
  },
  {
    name: 'Home Mortgage',
    description: '30-year fixed mortgage',
    template: {
      principal: 400000,
      interestRate: 6.5,
      termMonths: 360,
      interestType: 'FIXED' as const,
      paymentFrequency: 'monthly' as const,
      fees: {
        originationFee: 0.5,
        processingFee: 2000,
      },
    },
  },
  {
    name: 'Student Loan',
    description: 'Education loan with deferred payments',
    template: {
      principal: 50000,
      interestRate: 4.5,
      termMonths: 120,
      interestType: 'COMPOUND' as const,
      paymentFrequency: 'monthly' as const,
      compoundingFrequency: 'QUARTERLY' as const,
      fees: {
        originationFee: 0,
        processingFee: 0,
      },
    },
  },
  {
    name: 'Business Loan',
    description: 'Small business term loan',
    template: {
      principal: 100000,
      interestRate: 7.5,
      termMonths: 60,
      interestType: 'VARIABLE' as const,
      paymentFrequency: 'monthly' as const,
      fees: {
        originationFee: 2.0,
        processingFee: 999,
      },
    },
  },
];

// Demo user for authentication bypass
export const DEMO_USER = {
  id: 'demo_user',
  email: 'demo@lendpeak.com',
  password: 'demo123',
  firstName: 'Demo',
  lastName: 'User',
  role: 'ADMIN',
  avatar: '👤',
};