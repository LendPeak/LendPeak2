// Test setup file for vitest
import { vi, beforeAll, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Mock react-datepicker to avoid DOM prop warnings in tests
vi.mock('react-datepicker', () => {
  return {
    default: ({ value, onChange, placeholder, ...props }: any) => 
      React.createElement('input', {
        'data-testid': 'date-picker',
        type: 'date',
        value: value ? value.toISOString().split('T')[0] : '',
        onChange: (e: any) => {
          const date = e.target.value ? new Date(e.target.value) : null;
          onChange && onChange(date);
        },
        placeholder,
        ...props
      }),
  };
});

// Mock toastify to avoid notification issues in tests
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  ToastContainer: () => React.createElement('div', { 'data-testid': 'toast-container' }),
}));

// Suppress console warnings in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('React does not recognize') ||
       args[0].includes('is unrecognized in this browser') ||
       args[0].includes('using incorrect casing') ||
       args[0].includes('not wrapped in act') ||
       args[0].includes('Warning: An update to'))
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };
  
  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('React does not recognize') ||
       args[0].includes('not wrapped in act'))
    ) {
      return;
    }
    originalConsoleWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});