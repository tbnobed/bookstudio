# BookStud.io Architecture

## Overview

BookStud.io is a television studio management system designed to provide intelligent scheduling, booking, and access control tools with enhanced multi-booking capabilities. The application follows a full-stack JavaScript/TypeScript architecture with a React frontend and Node.js backend, using PostgreSQL for data storage.

The system is designed with a primary focus on Docker-based deployment, allowing for consistent and reliable deployment across environments. It provides role-based access control with different user roles (admin, producer, engineer, IT, site manager) having different permissions within the application.

## System Architecture

### High-Level Architecture

BookStud.io follows a client-server architecture with the following key components:

1. **Frontend**: A React.js single-page application with TypeScript, using modern UI components (shadcn/ui)
2. **Backend**: Node.js with Express.js REST API
3. **Database**: PostgreSQL with Drizzle ORM for schema management and queries
4. **Authentication**: Session-based authentication with Passport.js
5. **Email Service**: Integration with SendGrid for transactional emails

### Core Design Principles

1. **Docker-First Deployment**: The entire application is designed to be deployed using Docker and Docker Compose for maximum consistency across environments.
2. **TypeScript Throughout**: Both frontend and backend use TypeScript for improved type safety and developer experience.
3. **Role-Based Authorization**: Strict role-based access control for different user types.
4. **Responsive Design**: Mobile-first approach to ensure the application works on all devices.

## Key Components

### Frontend

- **Framework**: React.js with TypeScript
- **Styling**: TailwindCSS with shadcn/ui component library
- **State Management**: React Query for server state, React Context for global state
- **Form Management**: React Hook Form with Zod validation
- **Routing**: Wouter for lightweight client-side routing

The frontend follows a component-based architecture with the following key features:

1. **Calendar Views**: Daily, weekly, and monthly calendar interfaces for studio booking management
2. **Responsive Design**: Different views for mobile and desktop users
3. **Role-Based UI**: Interface adapts based on user permissions
4. **Real-time Status Indicators**: Visual representation of studio availability and status

### Backend

- **Framework**: Node.js with Express.js
- **API Style**: RESTful API
- **Authentication**: Passport.js with session-based auth using connect-pg-simple for session storage
- **Database Access**: Drizzle ORM for type-safe database operations
- **Email**: SendGrid API for sending notifications and invitations

Key backend features:

1. **RESTful API**: Standard HTTP methods for CRUD operations
2. **Middleware-based Authentication**: Session-based authentication with role verification
3. **Email Service**: Transactional emails for booking confirmations, invitations, and password resets
4. **File Handling**: Support for file uploads and attachments to bookings

### Database Schema

The primary database entities include:

1. **Users**: Account details with role-based permissions
2. **Studios**: Television studios with status tracking
3. **PCR Rooms**: Production Control Rooms that can be assigned to bookings
4. **Bookings**: Scheduling information for studio usage
5. **Templates**: Reusable booking templates for common setups
6. **Notification Groups**: Groups for sending maintenance and facility alerts

A notable feature is the junction table `booking_studios` which enables multi-studio booking, allowing a single booking to reserve multiple studios for complex productions.

### Authentication and Authorization

The system uses session-based authentication with Passport.js and PostgreSQL session storage:

1. **User Sessions**: Persistent sessions stored in the database
2. **Password Security**: Passwords are hashed using scrypt with unique salts
3. **Role-Based Access**: Different permissions for admin, producer, engineer, IT, and site manager roles
4. **Invitation System**: Secure token-based invitation flow for adding new users
5. **Password Reset**: Token-based password reset functionality

## Data Flow

### Booking Creation Flow

1. User authenticates and navigates to the calendar view
2. User selects date/time and studio(s) for a new booking
3. System validates availability and user permissions
4. Booking is stored in the database with associated studios
5. Email notifications are sent to relevant users
6. Calendar view is updated to reflect the new booking

### User Invitation Flow

1. Admin or site manager creates an invitation for a new user
2. System generates a secure invitation token
3. Invitation email is sent via SendGrid
4. User clicks link and completes registration form
5. System validates the token and creates the user account
6. User can now log in with assigned permissions

## External Dependencies

### Core Dependencies

1. **React.js**: Frontend UI library
2. **Express.js**: Backend web framework
3. **PostgreSQL**: Primary database
4. **Drizzle ORM**: Database access layer
5. **Passport.js**: Authentication framework
6. **Tailwind CSS**: Utility-first CSS framework
7. **shadcn/ui**: Component library based on Radix UI primitives

### External Services

1. **SendGrid**: Email delivery service for transactional emails
   - Used for sending booking confirmations
   - Used for password reset functionality
   - Used for user invitations

## Deployment Strategy

BookStud.io is designed for Docker-based deployment, which ensures consistency across environments and simplifies the deployment process.

### Docker Components

1. **Application Container**: Node.js application with the built frontend and backend
2. **Database Container**: PostgreSQL instance
3. **Database Initialization Container**: Handles schema migration and initial data seeding

### Deployment Process

1. Clone the repository
2. Configure environment variables (database credentials, SendGrid API key, etc.)
3. Run `docker-compose up -d` to start the application
4. Database migrations run automatically on startup
5. Application becomes available on the configured port (default: 5000)

### Development Setup

Development can be done using:
1. Local Node.js setup with `npm run dev`
2. Docker-based development with hot-reloading
3. Replit workspace using the included `.replit` configuration

### Production Considerations

1. **Nginx Integration**: Sample configuration included for SSL termination and caching
2. **Email Configuration**: Production requires a valid SendGrid API key
3. **Volume Management**: Persistent storage for database and file uploads
4. **Health Checks**: Configured in the Dockerfile for container orchestration

## Future Extensions

The architecture supports several planned extensions:

1. **Public Calendar Integration**: An embeddable public view of studio availability
2. **API Expansion**: Additional endpoints for integration with other systems
3. **Enhanced Multi-Studio Booking**: More advanced features for linking studios

This architecture document provides a high-level overview of the BookStud.io system. For detailed implementation specifics, refer to the code documentation and comments.