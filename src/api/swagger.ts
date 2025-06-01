import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LendPeak2 API',
      version: '1.0.0',
      description: 'State-of-the-art loan management system API documentation',
      contact: {
        name: 'LendPeak2 Team',
        email: 'api@lendpeak2.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/v1`,
        description: 'Development server',
      },
      {
        url: 'https://api.lendpeak2.com/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'Error code',
                },
                message: {
                  type: 'string',
                  description: 'Error message',
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Additional error details',
                },
              },
            },
          },
        },
        Loan: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            loanNumber: {
              type: 'string',
              example: 'LN-2024-000001',
            },
            borrowerId: {
              type: 'string',
            },
            principal: {
              type: 'string',
              description: 'Original loan amount',
              example: '250000.00',
            },
            currentBalance: {
              type: 'string',
              description: 'Current outstanding balance',
              example: '245000.00',
            },
            interestRate: {
              type: 'string',
              description: 'Annual interest rate',
              example: '0.045',
            },
            termMonths: {
              type: 'integer',
              description: 'Loan term in months',
              example: 360,
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'ACTIVE', 'DELINQUENT', 'DEFAULT', 'FORBEARANCE', 'DEFERMENT', 'CLOSED', 'CHARGED_OFF'],
            },
            originationDate: {
              type: 'string',
              format: 'date-time',
            },
            firstPaymentDate: {
              type: 'string',
              format: 'date-time',
            },
            nextPaymentDate: {
              type: 'string',
              format: 'date-time',
            },
            monthlyPayment: {
              type: 'string',
              example: '1266.71',
            },
          },
        },
        Payment: {
          type: 'object',
          required: ['amount', 'paymentDate', 'principalPaid', 'interestPaid'],
          properties: {
            amount: {
              type: 'string',
              description: 'Total payment amount',
              example: '1266.71',
            },
            paymentDate: {
              type: 'string',
              format: 'date-time',
            },
            principalPaid: {
              type: 'string',
              example: '450.00',
            },
            interestPaid: {
              type: 'string',
              example: '816.71',
            },
            feesPaid: {
              type: 'string',
              example: '0.00',
            },
          },
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./src/api/routes/*.ts', './src/api/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);