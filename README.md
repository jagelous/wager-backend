# Wager Backend

A TypeScript Express backend with Google OAuth authentication, Prisma ORM, and MySQL database.

## Features

- Google OAuth authentication
- JWT token-based authentication
- TypeScript support
- Prisma ORM with MySQL
- CORS enabled for frontend integration
- Cookie-based session management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file in the root directory with:
```
PORT=5000
DATABASE_URL="mysql://DB_USER:DB_PASS@DB_HOST:3306/DB_NAME"
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
JWT_SECRET=your_jwt_secret_here
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

3. Set up the database:
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Protected Routes
- `GET /api/profile` - Get user profile (requires authentication)

### Health Check
- `GET /api/health` - Server health check

## Development

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run prisma:studio` - Open Prisma Studio

## Database

The application uses Prisma ORM with MySQL. The User model includes:
- Google OAuth integration
- User profile information
- Role-based access control
- Login tracking
