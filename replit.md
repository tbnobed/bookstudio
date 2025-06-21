# BookStud.io - Television Studio Management System

## Overview

BookStud.io is a comprehensive web application for television studio management that provides intelligent scheduling, booking, and access control tools. The system features multi-studio booking capabilities, real-time status indicators, template-based booking creation, and role-based user management. It's designed specifically for television production facilities requiring sophisticated studio scheduling and notification management.

## System Architecture

### Frontend Architecture
- **Framework**: React.js with TypeScript for type safety
- **UI Components**: Radix UI with shadcn/ui component library
- **Styling**: TailwindCSS for responsive design
- **State Management**: React Query (@tanstack/react-query) for server state management
- **Build Tool**: Vite for fast development and optimized production builds
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with session-based authentication
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **File Handling**: Multer for file uploads with configurable storage

### Data Storage Solutions
- **Primary Database**: PostgreSQL with connection pooling
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema validation
- **Session Store**: PostgreSQL-based session storage for scalability

## Key Components

### Studio Management System
- Real-time studio status tracking (available, maintenance, in-use)
- Multi-studio booking support with junction table relationships
- Production Control Room (PCR) assignment and management
- Calendar views (daily, weekly, monthly) with timezone handling

### Booking Engine
- Complex booking creation with multi-studio support
- Template system for recurring production setups
- Booking status management (confirmed, tentative, cancelled)
- Color-coded booking visualization
- Copy booking functionality with timezone-aware date handling

### User Management & Authentication
- Role-based access control (producer, engineer, it, site_manager, admin)
- Secure password hashing using Node.js crypto module
- Email-based user invitations with time-limited tokens
- Password reset functionality with secure token validation

### Notification System
- Email notifications via SendGrid integration
- Notification groups for targeted communications
- Automated booking confirmations and updates
- Facility-wide alert system for maintenance and outages
- File attachment notifications

### Template System
- Reusable booking templates for common production setups
- JSON-based configuration storage
- Template migration system for legacy data conversion
- User-specific template management

## Data Flow

### Booking Creation Flow
1. User selects studios and time slots through React frontend
2. Form validation occurs client-side using Zod schemas
3. Backend validates booking conflicts and availability
4. Database transaction creates booking and studio relationships
5. Email notifications sent to relevant notification groups
6. Real-time calendar updates via React Query cache invalidation

### Authentication Flow
1. User credentials validated against hashed passwords in PostgreSQL
2. Passport.js creates secure session stored in database
3. Session cookies with configurable security settings
4. Role-based route protection on both frontend and backend

### File Upload Flow
1. Files uploaded via Multer to local filesystem
2. Metadata stored in PostgreSQL with booking associations
3. File access controlled through authenticated routes
4. Notification system alerts relevant users of new attachments

## External Dependencies

### Email Service
- **SendGrid**: Transactional email delivery
- Configuration: API key and verified sender required
- Features: Booking notifications, user invitations, password resets

### Production Dependencies
- **PostgreSQL**: Primary database with connection pooling
- **Docker**: Containerized deployment with multi-stage builds
- **Node.js 20**: Latest LTS runtime environment

### Development Tools
- **Vite**: Fast development server with HMR
- **TypeScript**: Static type checking across full stack
- **Drizzle Studio**: Database inspection and management

## Deployment Strategy

### Docker-First Approach
- Multi-stage Dockerfile for optimized production builds
- Docker Compose orchestration with PostgreSQL service
- Environment-based configuration management
- Health checks and logging configuration

### Database Management
- Automated migrations on container startup
- Backup system with configurable retention
- Schema validation and restoration scripts
- Timezone handling (America/Chicago) for facility consistency

### Production Features
- Static file serving with caching headers
- Request size limits for file uploads (50MB)
- Security headers and HTTPS configuration
- Automated database fixes for schema inconsistencies

### Scalability Considerations
- Connection pooling for database efficiency
- Session storage in PostgreSQL for horizontal scaling
- Static asset optimization and caching
- Modular service architecture for easy maintenance

## Changelog
- June 18, 2025: Initial setup
- June 18, 2025: Calendar timezone display issue resolved - all bookings now appear on correct dates with proper America/Chicago timezone handling
- June 18, 2025: Fixed timezone consistency - ALL dates now display in Chicago timezone regardless of user's local timezone
- June 20, 2025: Site manager email notification system completed - all booking activities now trigger comprehensive emails with working links to actual Replit application URL
- June 20, 2025: Email header visibility completely fixed - all email templates now display headers correctly with text shadows and proper contrast, replaced CSS class-based templates with inline HTML styling for maximum email client compatibility
- June 20, 2025: FINAL email header fix implemented - replaced all invisible text headers with BookStud.io logo image for bulletproof visibility across all email clients, using assets/logo.png for consistent branding
- June 21, 2025: Email templates upgraded to use actual BookStud.io logo - replaced all "BS" text placeholders with the authentic BookStud.io logo (assets/logo.png) for professional branding across all email notifications including booking confirmations, cancellations, maintenance alerts, and site manager notifications
- June 21, 2025: Fixed critical deletion email bug - resolved ReferenceError where logoUrl was undefined in sendSiteManagerNotification function, now all booking deletion emails send properly with the BookStud.io logo
- June 21, 2025: Enhanced email header visibility - added !important declarations, -webkit-text-fill-color, and mso-line-height-rule properties to ensure white text displays properly on colored backgrounds across all email clients including Outlook and mobile apps
- June 21, 2025: FINAL email header visibility fix - added semi-transparent black background boxes behind all header text to ensure visibility regardless of email client text color overrides, with inline-block display and padding for perfect contrast
- June 21, 2025: Applied header visibility fixes to ALL email templates - updated password reset and invitation emails with same background box solution for universal header visibility across all email types

## User Preferences

Preferred communication style: Simple, everyday language.