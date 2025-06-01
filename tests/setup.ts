// Test setup file for Jest
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Add custom matchers for financial calculations
expect.extend({
  toBeWithinTolerance(received: number, expected: number, tolerance = 0.01) {
    const pass = Math.abs(received - expected) <= tolerance;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within ${tolerance} of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${tolerance} of ${expected}`,
        pass: false,
      };
    }
  },
  toBePennyPerfect(received: number, expected: number) {
    const pass = Math.abs(received - expected) < 0.01;
    if (pass) {
      return {
        message: () => `expected ${received} not to be penny-perfect with ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be penny-perfect with ${expected}`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinTolerance(expected: number, tolerance?: number): R;
      toBePennyPerfect(expected: number): R;
    }
  }
}