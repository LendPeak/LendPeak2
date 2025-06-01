# MongoDB Commands Reference

All MongoDB operations can be controlled through npm scripts from the root directory.

## Quick Start

```bash
# Start everything (MongoDB + Backend + Frontend)
npm start

# Start with fresh database
npm run start:fresh
```

## Service Management

### Start Services
```bash
# Start MongoDB with replica set
npm run mongodb:start

# Start all services (currently just MongoDB)
npm run services:start

# Start backend with services
npm run start:backend

# Start everything
npm start
```

### Stop Services
```bash
# Stop MongoDB gracefully
npm run mongodb:stop

# Stop all services
npm run services:stop

# Stop everything
npm stop
```

### Check Status
```bash
# Check MongoDB status
npm run mongodb:status

# Check all services status
npm run services:status
```

## Database Operations

### Seeding
```bash
# Seed all data (users + borrowers)
npm run db:seed

# Seed only users
npm run db:seed-user

# Seed only borrowers
npm run seed:borrowers
```

### Database Management
```bash
# Open MongoDB console
npm run mongodb:console

# View MongoDB logs
npm run mongodb:logs

# Reset database (deletes all data!)
npm run mongodb:reset

# Backup database
npm run db:backup

# Restore database
npm run db:restore
```

## Development Workflows

### Full Stack Development
```bash
# Start MongoDB + Backend + Frontend
npm start

# Start with fresh database and seed data
npm run start:fresh
```

### Backend Only
```bash
# Start MongoDB + Backend
npm run start:backend
```

### Frontend Only
```bash
# Start only frontend (uses demo data)
npm run start:frontend
```

## Troubleshooting

### MongoDB Won't Start
```bash
# Check if MongoDB is already running
npm run mongodb:status

# Check logs for errors
npm run mongodb:logs

# Reset and try again
npm run mongodb:reset
```

### Port Already in Use
```bash
# MongoDB uses port 27017
lsof -i :27017
kill -9 <PID>

# Backend uses port 3001
lsof -i :3001
kill -9 <PID>

# Frontend uses port 5173-5176
lsof -i :5173
kill -9 <PID>
```

## MongoDB Connection String
```
mongodb://localhost:27017/lendpeak2?replicaSet=rs0
```

## Data Location
- Database files: `./data/db/`
- Log files: `./data/logs/`

## Notes
- MongoDB runs as a replica set (required for transactions)
- Data persists between restarts unless you run `mongodb:reset`
- The `start:fresh` command gives you a clean slate with sample data