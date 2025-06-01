# LendPeak2 Frontend

A modern React-based frontend for the LendPeak2 loan management system.

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **TanStack Query** for server state management
- **React Hook Form** with Yup for form handling
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Headless UI** for accessible components
- **Heroicons** for icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running on http://localhost:3000

### Installation

```bash
# From the frontend directory
npm install
```

### Development

```bash
# Start the development server
npm run dev

# The app will be available at http://localhost:5173
```

### Building for Production

```bash
# Create an optimized production build
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── auth/        # Authentication components
│   ├── common/      # Common UI components
│   ├── dashboard/   # Dashboard components
│   └── loans/       # Loan-related components
├── hooks/           # Custom React hooks
├── layouts/         # Layout components
├── pages/           # Page components
│   ├── auth/        # Authentication pages
│   ├── dashboard/   # Dashboard pages
│   └── loans/       # Loan management pages
├── services/        # API services
├── store/           # State management
└── utils/           # Utility functions
```

## Available Routes

- `/login` - User login
- `/register` - User registration
- `/dashboard` - Main dashboard
- `/loans` - Loan list
- `/loans/new` - Create new loan
- `/loans/:id` - Loan details
- `/calculator` - Loan calculator
- `/reports` - Reports (Admin only)
- `/users` - User management (Admin only)
- `/settings` - User settings

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

## Authentication

The app uses JWT-based authentication with automatic token refresh. Access tokens are stored in memory while refresh tokens are stored in localStorage.

## Role-Based Access Control

The app implements RBAC with the following roles:
- **SUPER_ADMIN** - Full system access
- **ADMIN** - Administrative functions
- **LOAN_OFFICER** - Create and manage loans
- **UNDERWRITER** - Review and approve loans
- **SERVICER** - Service existing loans
- **COLLECTOR** - Collection activities
- **AUDITOR** - Read-only access with audit logs
- **VIEWER** - Basic read-only access

## Development Tips

1. **API Proxy**: In development, Vite proxies `/api` requests to the backend server.

2. **Hot Module Replacement**: Vite provides fast HMR for instant updates.

3. **TypeScript**: All components use TypeScript for type safety.

4. **ESLint**: Run `npm run lint` to check for code quality issues.

5. **Component Development**: Use Storybook (when added) for isolated component development.

## Common Tasks

### Adding a New Page

1. Create the page component in `src/pages/`
2. Add the route in `src/App.tsx`
3. Add navigation link in `src/layouts/MainLayout.tsx`

### Adding API Endpoints

1. Add the endpoint method to `src/services/api.ts`
2. Use TanStack Query hooks in components to fetch data

### Styling Components

We use Tailwind CSS utility classes. Common patterns:
- Forms: Use `@tailwindcss/forms` plugin classes
- Buttons: Use predefined button classes
- Layout: Use flexbox and grid utilities

## Troubleshooting

### CORS Issues
Ensure the backend is running and CORS is properly configured for http://localhost:5173

### Authentication Errors
Check that JWT tokens are being properly stored and sent with requests

### Build Errors
Clear node_modules and reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```