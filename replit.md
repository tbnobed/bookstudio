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
- June 21, 2025: SIMPLIFIED email templates - removed all header text and kept only BookStud.io logo for clean, universally compatible design across all email clients
- June 21, 2025: Completed email template simplification - removed ALL remaining header text from maintenance alerts, facility alerts, and site manager notifications. Every email template now uses logo-only design for universal email client compatibility
- June 21, 2025: FINAL fix for site manager notifications - removed header text from sendSiteManagerNotification function. ALL email templates across the entire system now use clean logo-only design with zero header text visibility issues
- June 21, 2025: COMPLETELY FIXED all email templates - removed ALL remaining CSS-based headers from notification service including booking notifications, maintenance alerts, and facility alerts. Every single email in the entire system now uses the same logo-only design for universal compatibility
- June 21, 2025: Consolidated redundant email functions - unified SendGrid initialization and email sending into single emailService, eliminated duplicate email template structures between server/email.ts and server/services/emailService.ts for cleaner, more maintainable code
- June 21, 2025: FINAL notification group email cleanup - removed ALL remaining blue gradient backgrounds from notification group templates including booking notifications, maintenance alerts, and facility alerts. Every email template now uses clean logo-only design with authentic BookStud.io logo for universal email client compatibility
- June 22, 2025: Fixed production email domain links - updated all email services to prioritize APP_DOMAIN environment variable over Replit domains, ensuring email links point to production domain instead of localhost:5000. Added APP_DOMAIN configuration to .env.example for easy production setup
- June 22, 2025: COMPLETELY eliminated ALL localhost:5000 references from production email system - fixed remaining hardcoded localhost URLs in server/email.ts that were causing production emails to show incorrect links. All email notifications now properly use clean production domains without ports when APP_DOMAIN is set
- June 22, 2025: VERIFIED email system is production-ready - confirmed all email templates generate dynamic URLs using getApplicationUrl() function which prioritizes APP_DOMAIN environment variable. No cached templates exist. System correctly uses Replit development domain when APP_DOMAIN is not set, and will use clean production domain when properly configured
- June 22, 2025: Fixed Docker environment variable loading - added APP_DOMAIN and SITE_MANAGER_EMAIL to docker-compose.yml environment sections and created docker-compose.override.yml to automatically load .env files. Docker now properly reads production environment variables for email domain configuration
- June 22, 2025: FINAL email logo fix completed - fixed missing logos in notification group emails by updating sendEmailToGroups function to use HTML templates with BookStud.io logo instead of plain text. All email types now consistently display the authentic BookStud.io logo across all email clients
- June 22, 2025: VERIFIED notification group email logo fix - confirmed sendEmailToGroups function properly generates HTML templates with logo URLs using getApplicationUrl() for dynamic domain resolution. All notification group emails now include BookStud.io logo for consistent branding
- June 22, 2025: FINAL removal of blue header from notification group emails - eliminated the remaining blue "NOTIFICATION" header bar from notification group email templates, ensuring ALL email types across the entire system use the same clean logo-only design for universal email client compatibility
- June 22, 2025: FIXED logo image serving in emails - added Express static file serving to properly serve logo images from /public directory. Email templates now display actual BookStud.io logo image instead of alt text, with correct Content-Type: image/png headers
- June 22, 2025: FINAL blue header removal from notification group emails - eliminated conflicting createEmailTemplate imports and replaced with createCleanEmailTemplate function that generates logo-only email design without any blue headers. All notification group emails now use consistent clean branding
- June 22, 2025: Increased email logo size by 60% - updated all email templates across the system to use 128px height (up from 80px) for better visibility and brand presence in notification emails, booking confirmations, and site manager alerts
- June 22, 2025: COMPLETELY FIXED maintenance alert system - maintenance bookings now properly send "MAINTENANCE SCHEDULED" alerts to ALL notification groups and facility management instead of regular booking notifications. Fixed missing getApplicationUrl import and ensured facility-wide alerts skip duplicate site manager notifications. System now correctly identifies maintenance bookings (studioId: null, type: maintenance) and sends proper orange maintenance alerts to all groups
- June 22, 2025: Removed redundant "Notify Crew" section from maintenance alert modal - since maintenance alerts automatically notify ALL notification groups, the manual crew selection is no longer needed and was causing confusion
- June 22, 2025: Fixed foreign key constraint error in booking creation - templateId now properly set to null when no template is selected (was causing constraint violations when set to 0)
- June 22, 2025: COMPLETELY FIXED mobile booking foreign key constraints - resolved both templateId and pcrRoomId constraint violations by updating all mobile form components (SimpleMobileForm, BookingModal, DirectMobileForm, MobileBookingController, BookingFormSelector) to use null instead of 0 for foreign key fields, plus updated server-side validation to handle empty values properly
- June 22, 2025: Enhanced mobile daily view to display day of the week names - updated the subtitle below the date header to show full day names (Sunday, Monday, etc.) using Chicago timezone for consistency
- June 22, 2025: FIXED mobile timezone conversion issue - resolved timezone shifting where 8:00 AM selections displayed as 10:00 AM in forms by implementing proper Chicago timezone handling in SimpleMobileForm and DirectMobileForm time input processing, ensuring all mobile booking times display and save correctly in facility timezone
- June 22, 2025: Fixed React null value warnings in mobile forms - updated SimpleMobileForm and DirectMobileForm to handle null templateId and pcrRoomId values properly, eliminating console warnings and runtime errors
- June 22, 2025: FINAL mobile timezone fix - updated SimpleMobileForm and DirectMobileForm to use createFacilityDate function for proper Chicago timezone handling, ensuring all time selections display and save correctly without conversion errors
- June 22, 2025: Mobile booking form timezone issues completely resolved - all mobile forms now properly handle time selection in Chicago timezone, verified working correctly with 7:03 AM selections saving as 7:03 AM facility time
- June 22, 2025: FIXED foreign key constraint error in booking creation - resolved studioId=0 constraint violations by updating server-side validation and all mobile form components (SimpleMobileForm, DirectMobileForm, BookingFormSelector) to use null instead of 0 for invalid studio IDs, preventing database foreign key errors
- June 22, 2025: Enhanced mobile form studio selection handling - added proper validation for studio dropdown changes in both SimpleMobileForm and DirectMobileForm to ensure selected studios are properly captured and never default to invalid ID 0
- June 22, 2025: RESOLVED mobile form syntax error - fixed JavaScript runtime error in SimpleMobileForm handleSubmit function and ensured all mobile booking forms work correctly with proper studio selection validation
- June 22, 2025: FIXED booking update JSON parsing error - resolved "Unexpected end of JSON input" error caused by empty update data by adding proper validation in both routes and storage layers to handle empty requests gracefully
- June 23, 2025: FIXED studio selection validation regression - added mandatory studio selection validation to both mobile forms (SimpleMobileForm and DirectMobileForm) and server-side validation to prevent booking creation without studio selection, ensuring business requirements are enforced
- June 23, 2025: CLEANED UP mobile app code - fixed redundant null conversion logic in form submissions, replaced manual API fetching with proper React Query hooks in SimpleMobileForm, corrected default studio ID logic to avoid hardcoded fallbacks, and improved code consistency across mobile components
- June 23, 2025: ADDED DELETE functionality to mobile forms - added Delete button to both SimpleMobileForm and DirectMobileForm with proper permission handling, confirmation dialog, and error handling for users with delete rights to remove bookings from mobile interface
- June 24, 2025: FIXED calendar date initialization - resolved issue where calendar defaulted to June 19th instead of current date on page load
- June 24, 2025: COMPLETELY FIXED foreign key constraint errors - implemented proper dependency checking for user and template deletion with meaningful error messages instead of database crashes. Users and templates with associated bookings now show clear error messages explaining the restriction and required actions
- June 23, 2025: Enhanced mobile form button styling - redesigned all form action buttons with modern gradients, improved spacing, rounded corners, and subtle hover animations for better visual appeal and professional appearance
- June 23, 2025: Fixed mobile form deletion UI refresh - resolved issue where deleted bookings didn't disappear from the calendar view without manual page refresh by improving React Query cache invalidation and adding immediate page reload for reliable UI updates
- June 23, 2025: FIXED maintenance booking modal routing - resolved issue where maintenance bookings were opening regular booking edit modal instead of maintenance/alert modal in mobile daily view by implementing proper booking type detection and modal routing based on booking type and studioId
- June 23, 2025: FIXED mobile deletion cache refresh issue - eliminated window.location.reload() calls and implemented comprehensive React Query cache invalidation across all mobile forms (SimpleMobileForm, DirectMobileForm, AlertModal) to ensure deleted bookings and maintenance alerts disappear immediately without manual page refresh
- June 23, 2025: FIXED template studio selection validation - resolved issue where loading templates with selected studios would fail validation by automatically setting primary studioId to first studio from template studioIds array, ensuring mobile forms work seamlessly with template-based booking creation
- June 23, 2025: COMPREHENSIVE mobile view cache refresh fix - implemented advanced React Query pattern matching with predicate functions to invalidate ALL booking-related queries across the entire mobile app, ensuring deletions, additions, and changes appear immediately without requiring manual refresh
- June 23, 2025: FIXED multi-studio template booking creation - updated both SimpleMobileForm and DirectMobileForm to properly pass studioIds array to booking creation API, ensuring templates with multiple studios create bookings on ALL selected studios instead of just the first one
- June 23, 2025: DEBUGGING multi-studio mobile submission - enhanced MobileBookingController and useStudioBookings hook to properly pass studioIds array through the complete submission chain, added comprehensive debug logging to track data flow from mobile form to server API, identified that studioIds array needs to be preserved in booking creation mutation
- June 23, 2025: CONFIRMED multi-studio bug - booking 173 "Test Studio A and F" created with only Studio A link despite user selecting both studios, no entries in booking_studios table proving studioIds array not reaching server, enhanced debug logging in submission chain to track exact data flow issue

## User Preferences

Preferred communication style: Simple, everyday language.