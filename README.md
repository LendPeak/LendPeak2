# LendPeak2 - State-of-the-Art Loan Management System

A comprehensive loan management platform designed to handle complex financial calculations, regulatory compliance, and multi-party loan structures.

## 🚀 Features

- **High-Precision Financial Calculations** using Big.js
- **Multiple Loan Types**: DSI, Amortized, and Blended modes
- **Configurable Payment Waterfalls** with custom allocation rules
- **Comprehensive Loan Restructuring** capabilities
- **Multi-Investor Support** with revenue sharing
- **Regulatory Compliance**: TILA, RESPA, FCRA, SCRA
- **Real-time Payment Processing** via Stripe
- **Advanced Analytics** and ML-based predictions

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- MongoDB >= 5.0 (or use our built-in scripts)
- AWS Account (for deployment)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/lendpeak2.git
cd lendpeak2
```

2. Install dependencies:
```bash
npm install
cd frontend && npm install && cd ..
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

## 🚀 Quick Start

```bash
# Start everything (MongoDB + Backend + Frontend)
npm start

# Or start with fresh database and sample data
npm run start:fresh
```

## 🗄️ MongoDB Management

All MongoDB operations are managed through npm scripts:

```bash
# MongoDB Controls
npm run mongodb:start     # Start MongoDB with replica set
npm run mongodb:stop      # Stop MongoDB gracefully
npm run mongodb:status    # Check if MongoDB is running
npm run mongodb:logs      # View MongoDB logs
npm run mongodb:console   # Open MongoDB shell
npm run mongodb:reset     # Reset database (WARNING: deletes all data)

# Database Operations
npm run db:seed          # Seed sample data (users + borrowers)
npm run db:backup        # Backup database
npm run db:restore       # Restore from backup

# Service Management
npm run services:start   # Start all services
npm run services:stop    # Stop all services
npm run services:status  # Check all services status
```

For detailed MongoDB commands, see [MongoDB Commands Reference](docs/MONGODB_COMMANDS.md).

## 🧪 Testing

We follow Test-Driven Development (TDD). Always write tests first!

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:unit
npm run test:functional
npm run test:compliance

# Check coverage
npm run test:coverage
```

## 🏃‍♂️ Development

### Quick Development Commands

```bash
# Full Stack Development (MongoDB + Backend + Frontend)
npm start

# Backend Only (with MongoDB)
npm run start:backend

# Frontend Only (uses demo data)
npm run start:frontend

# Fresh Start (reset DB + seed + start all)
npm run start:fresh
```

### Individual Services

```bash
# Backend Development
npm run dev              # Start backend (requires MongoDB running)

# Frontend Development
npm run dev:frontend     # Start frontend dev server

# Build Commands
npm run build           # Build backend
npm run build:frontend  # Build frontend
npm run build:all       # Build everything
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run typecheck
npm run dev:all
```

## 🏗️ Infrastructure

We use AWS CDK for infrastructure as code:

```bash
cd infrastructure

# Synthesize CloudFormation
npm run cdk:synth

# Deploy to AWS
npm run cdk:deploy
```

## 📦 Project Structure

```
lendpeak2/
├── src/                    # Backend source code
│   ├── core/              # Core business logic
│   ├── api/               # API endpoints
│   ├── services/          # External services
│   ├── models/            # Data models
│   ├── utils/             # Utilities
│   └── config/            # Configuration
├── frontend/              # React frontend application
│   ├── src/               # Frontend source code
│   ├── public/            # Static assets
│   └── README.md          # Frontend documentation
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   ├── functional/        # Functional tests
│   ├── scenarios/         # Business scenarios
│   ├── compliance/        # Regulatory tests
│   └── performance/       # Performance tests
├── infrastructure/         # AWS CDK code
├── documents/             # Requirements docs
│   ├── MAIN.md           # Business requirements
│   └── WORK.md           # Task tracking
└── .github/               # GitHub Actions
```

## 🚀 Deployment

Deployment is automated via GitHub Actions:

1. Push to `main` branch triggers staging deployment
2. Manual approval required for production
3. All deployments include:
   - Automated tests
   - Security scanning
   - Database migrations
   - Health checks
   - Rollback on failure

## 📊 Monitoring

- CloudWatch dashboards for system metrics
- Business metrics tracking
- Real-time alerts via SNS
- Performance monitoring

## 🔒 Security

- All data encrypted at rest and in transit
- AWS Cognito for authentication
- Role-based access control (RBAC)
- PCI DSS Level 1 compliance
- Regular security audits

## 📚 Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guidelines
- [Business Requirements](./documents/MAIN.md)
- [Task Tracking](./documents/WORK.md)
- API Documentation (coming soon)

## 🤝 Contributing

1. Check `documents/WORK.md` for available tasks
2. Follow TDD approach - write tests first
3. Ensure all tests pass
4. Update task status in WORK.md
5. Create pull request

## 📄 License

Proprietary - All rights reserved