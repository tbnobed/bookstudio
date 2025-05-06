# BookStud.io Architecture

## 1. Overview

BookStud.io is a comprehensive television studio management system designed to facilitate intelligent scheduling, booking, and access control for TV studios with support for multi-studio bookings. The application provides real-time status indicators, production control room (PCR) integration, template systems, role-based authentication, and automated notifications.

The system follows a modern web application architecture with a separation between frontend and backend components, containerized deployment, and a PostgreSQL database for data persistence.

## 2. System Architecture

BookStud.io employs a client-server architecture with the following major components:

### 2.1 Frontend

- **Framework**: React.js with TypeScript
- **UI Components**: Shadcn/UI (based on Radix UI), enhanced with TailwindCSS
- **State Management**: React Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing

### 2.2 Backend

- **Framework**: Node.js with Express
- **API Style**: RESTful API endpoints
- **Runtime**: ESM modules with TypeScript
- **Authentication**: Session-based auth using Passport.js
- **Email Services**: SendGrid integration for transactional emails

### 2.3 Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM for type-safe database queries
- **Session Store**: connect-pg-simple for PostgreSQL-based session storage
- **Schema**: Structured around studios, bookings, users, templates, and PCR rooms

### 2.4 Deployment

- **Containerization**: Docker with Docker Compose
- **Environment**: Production-ready Docker containers with Alpine Node.js base
- **Configuration**: Environment variables for all configurable settings
- **Persistence**: Docker volumes for file uploads and database data

## 3. Key Components

### 3.1 User Authentication System

- **Session-based Authentication**: Uses Express sessions with Passport.js
- **Password Security**: Scrypt-based password hashing with salt
- **Role-based Access Control**: Different permission levels for producers, engineers, site managers, and administrators
- **Password Reset**: Token-based password reset flow with email notifications
- **User Invitations**: Token-based invitation system for adding new users

### 3.2 Booking Management

- **Calendar Interface**: Daily, weekly, and monthly views
- **Studio Selection**: Multiple studios can be linked to a single booking
- **Production Control Room**: PCR assignment for bookings
- **Booking Templates**: Reusable booking templates for common setups
- **File Attachments**: Support for attaching files to bookings
- **Status Tracking**: Real-time status indicators for studios (available, booked, maintenance)

### 3.3 Studio Management

- **Studio Status**: Available, booked, or maintenance states
- **PCR Integration**: Production Control Room association with bookings
- **Multi-studio Bookings**: Junction table associating multiple studios with a single booking

### 3.4 Notification System

- **Email Notifications**: Automated emails for booking confirmations, updates, and cancellations
- **Notification Groups**: Targeted notifications for different department groups
- **Facility Alerts**: System for outages and maintenance notifications

### 3.5 Reporting

- **Usage Analytics**: Studio usage statistics and reports
- **User Activity**: Tracking of bookings by user
- **Charts**: Visual representation of studio usage data

## 4. Data Flow

### 4.1 Booking Flow

1. User authenticates through the login page or session
2. User navigates to calendar view and selects date/time and studio(s)
3. User enters booking details, selects PCR room if needed, and submits
4. Backend validates booking data against constraints
5. Backend stores booking in database with studio-booking relationships
6. Confirmation email is sent to the booking creator
7. Calendar UI updates to show the new booking

### 4.2 Authentication Flow

1. User logs in with username/password or uses invitation/reset links
2. Backend validates credentials and creates session
3. Session cookie is stored in browser and referenced on server
4. Subsequent requests include the session cookie
5. Backend validates session and user permissions for protected routes
6. UI conditionally renders components based on user role

### 4.3 Studio Status Flow

1. Backend calculates studio status based on current bookings and manual status
2. UI displays color-coded status indicators (green = available, red = booked, orange = maintenance)
3. Admins/Engineers can manually update studio status for maintenance
4. Status changes trigger UI updates through React Query's invalidation

## 5. External Dependencies

### 5.1 Email Services

- **SendGrid**: Used for all transactional emails (booking confirmations, password resets, invitations)
- **Verified Sender**: Configured via environment variables for all outgoing emails

### 5.2 Database Services

- **PostgreSQL**: Primary data store, running in Docker container
- **Connection Pooling**: Configured to handle multiple simultaneous connections

### 5.3 UI Components

- **Radix UI**: Accessible and customizable UI primitives
- **Shadcn/UI**: Component collection built on Radix UI
- **TailwindCSS**: Utility-first CSS framework for styling

## 6. Deployment Strategy

### 6.1 Docker-Only Approach

- **Docker Compose**: Primary deployment mechanism for all environments
- **Container Orchestration**: Multi-container setup with defined dependencies
- **Database Initialization**: Separate initialization container ensures proper setup
- **Volumes**: Persistent storage for uploads and database data

### 6.2 Environment Configuration

- **Environment Variables**: All configuration handled through .env file
- **Sensible Defaults**: Preset values for development environments
- **Production Settings**: Secure defaults for production deployments

### 6.3 Deployment Process

1. Clone repository from source control
2. Configure environment variables in .env file
3. Run `docker-compose up -d` to start all services
4. Database migrations and initialization run automatically
5. Application becomes available on configured port

### 6.4 Scaling Strategy

- **Horizontal Scaling**: Container-based deployment allows easy replication
- **Database Separation**: PostgreSQL in separate container for independent scaling
- **Stateless Application**: Session data stored in database, enabling multiple application instances

## 7. Security Considerations

### 7.1 Authentication Security

- **Password Hashing**: Scrypt with random salt for secure password storage
- **Session Security**: HTTP-only cookies with secure flag (configurable)
- **CSRF Protection**: Same-site cookie policy to prevent cross-site request forgery

### 7.2 Data Protection

- **Validation**: Input validation using Zod schema validation
- **Parameterized Queries**: SQL injection protection through ORM
- **Role-based Access**: Restricted API access based on user roles

### 7.3 API Security

- **Authentication Checking**: Middleware validates session before accessing protected routes
- **Error Handling**: Sanitized error responses to prevent information disclosure
- **Rate Limiting**: Future consideration for protecting against abuse