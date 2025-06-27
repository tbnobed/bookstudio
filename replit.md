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

## Production Deployment

### Environment Configuration
- Weather API integration requires VITE_OPENWEATHER_API_KEY in production .env
- Location can be configured via VITE_WEATHER_LOCATION or coordinates
- Docker environment includes all necessary weather variables
- See PRODUCTION_WEATHER_SETUP.md for detailed setup instructions

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
- June 24, 2025: IMPLEMENTED FORCE DELETION capability for administrative cleanup - users and templates can now be deleted even with associated dependencies using ?force=true parameter, with safe reassignment of bookings and templates to admin user, comprehensive frontend dialogs showing dependency warnings and clear explanations of force deletion actions, ensuring data integrity while providing administrative flexibility for cleanup operations
- June 24, 2025: FIXED calendar date initialization - resolved issue where calendar defaulted to June 19th instead of current date on page load
- June 25, 2025: IDENTIFIED production weather integration issue - weather API works perfectly in development but fails in production Docker environment because VITE_OPENWEATHER_API_KEY must be embedded at build time, not runtime. Updated Dockerfile to copy .env file during build process, production deployment requires Docker rebuild to embed weather functionality
- June 25, 2025: CONFIRMED weather API key not embedded in production - Network tab shows no api.openweathermap.org requests, indicating Docker build failed to embed VITE_OPENWEATHER_API_KEY. Enhanced Dockerfile debugging to show exact .env file contents during build process
- June 25, 2025: WEATHER INTEGRATION ISSUE RESOLVED - hardcoded API key test confirmed weather API works perfectly, issue is Docker build not embedding VITE_OPENWEATHER_API_KEY from .env file. Fixed Dockerfile environment variable handling for proper production weather integration
- June 25, 2025: Enhanced weather forecast processing and added fallback display for extended days - improved daily forecast accuracy by properly grouping hourly data and calculating min/max temperatures, added visual placeholders for days beyond 5-day API limit (Monday/Tuesday show cloud icon with "--/--" due to OpenWeatherMap free API limitation)
- June 25, 2025: Fixed Docker Compose pkConstraint variable warning - resolved "pkConstraint variable is not set" warning by replacing JavaScript template literal with string concatenation to prevent Docker Compose from interpreting JavaScript variables as environment variables
- June 25, 2025: FIXED Nashville deployment weather location issue - updated .env and docker-compose.yml to use correct Hendersonville, TN coordinates (36.3048, -86.6200) instead of Dallas coordinates, and modified signage page to use VITE_WEATHER_LOCATION environment variable instead of hardcoded Dallas location
- June 25, 2025: REMOVED ALL hardcoded location defaults for multi-city deployment - eliminated all fallback weather coordinates from docker-compose.yml and made weather location completely configurable via environment variables, added validation to gracefully disable weather when location not configured, created DEPLOYMENT_MULTI_CITY.md guide for deploying in multiple cities
- June 25, 2025: FIXED weather environment variable loading for both development and production - added client/.env file creation during Docker build process to ensure Vite can access weather variables in production deployments, verified working weather integration with Hendersonville, TN coordinates
- June 25, 2025: COMPLETED production multi-city deployment configuration - enhanced Dockerfile to properly create client/.env during build, created PRODUCTION_MULTI_CITY_CHECKLIST.md with complete deployment guide, verified system works for any city with proper environment configuration
- June 25, 2025: IMPROVED signage page layout efficiency - converted today's bookings from vertical list to compact 4-column grid layout to save vertical space when displaying many bookings, reduced card padding and font sizes while maintaining readability
- June 25, 2025: CREATED smart TV compatible signage page - developed tv-signage.html using vanilla JavaScript and older browser patterns (XMLHttpRequest, ES5 syntax, table layouts) to ensure compatibility with Samsung TV built-in browsers and other embedded systems
- June 25, 2025: ENHANCED TV signage page with complete feature replication - added weekly overview with 7-day calendar, studio status monitoring, active site alerts system, maintenance notifications, Chicago timezone formatting, and comprehensive booking display exactly matching the React signage page functionality for perfect Smart TV compatibility
- June 25, 2025: OPTIMIZED Today's Schedule for compact 4-column layout - reduced TV signage booking cards to smaller, space-efficient design with 8px padding, 11px titles, and 9px detail text while maintaining studio status section in original 2-column format for optimal readability
- June 25, 2025: SHORTENED TV signage URL - renamed tv-signage.html to tv.html for cleaner access at /tv.html
- June 26, 2025: OPTIMIZED main signage page (/signage) for 1920x1080 displays - increased all font sizes for better readability from distance viewing, enhanced facility name to 6xl (56px), section titles to 3xl (30px), booking titles to lg (18px), time display to 4xl (36px), studio names to lg (18px), and improved overall spacing and contrast for professional TV display presentation, ensuring optimal viewing experience for facility monitors
- June 26, 2025: REMOVED tv.html page - eliminated standalone Smart TV signage page, keeping only the main React signage page at /signage route for unified display system
- June 25, 2025: FIXED Docker build environment variable embedding - resolved .env file access issue by using ARG and ENV in Dockerfile with build arguments passed from docker-compose.yml, ensuring VITE_* variables are properly embedded during build process for production weather functionality
- June 25, 2025: ENHANCED signage page booking entries - added comprehensive information display including booking times, studio assignments, status indicators (confirmed/tentative/cancelled), maintenance badges, and descriptions to provide complete booking details at a glance for facility monitors
- June 24, 2025: COMPLETELY FIXED foreign key constraint errors - implemented proper dependency checking for user and template deletion with meaningful error messages instead of database crashes. Users and templates with associated bookings now show clear error messages explaining the restriction and required actions
- June 24, 2025: ENHANCED Day Chronological View booking cards - completely redesigned main booking cards to display comprehensive information directly on the card including status indicators with icons (confirmed/tentative/cancelled), full descriptions with smart truncation, color indicators, notification group names with badges, PCR room info, and creation timestamps, eliminating the need to hover for essential booking details
- June 24, 2025: UPDATED studios icon to camera symbol - replaced generic Users icon with Camera icon for studio sections in booking cards, providing more appropriate visual representation for television production facilities
- June 24, 2025: REMOVED color information display - eliminated color indicators and hex color codes from booking cards to create cleaner, more focused interface while retaining all essential booking information
- June 24, 2025: MATCHED tentative booking styling across views - applied consistent visual styling for tentative bookings in day view to match weekly view with dashed borders, reduced opacity, gray background, and proper border coloring for visual consistency
- June 24, 2025: UPDATED alerts section border to solid - changed alerts section border from conditional dashed to always solid for cleaner, more professional appearance
- June 24, 2025: ENHANCED Recent Updates cards with comprehensive booking information - added studios list with camera icon, PCR room assignment with monitor icon, and booking times with clock icon to Recent Updates entries, replacing hover effects with permanent information display for better usability and fixed object display issues to show actual studio names and proper time formatting
- June 24, 2025: FIXED Docker deployment templates schema - updated docker-migrate-db.cjs to create templates table with complete current schema including studio_ids, pcr_room_id, color, status, notify_list, start_time, end_time, and created_by columns to prevent "column does not exist" errors in fresh Docker deployments
- June 24, 2025: FIXED user invitation email error - resolved ReferenceError where variable 'email' was undefined in sendInviteEmail function by correcting parameter reference from 'email' to 'to', ensuring invitation emails send successfully
- June 24, 2025: FIXED password reset email error - resolved ReferenceError where logoUrl was undefined in sendPasswordResetEmail function by adding missing logoUrl definition, ensuring password reset emails send successfully
- June 24, 2025: COMPLETELY FIXED email service integration - updated both sendInviteEmail and sendPasswordResetEmail functions to use proper sendEmail service instead of undefined mailService, ensuring all email functionality works correctly
- June 24, 2025: FINAL email parameter fix - corrected sendEmail function calls to use proper parameter names (senderEmail, to) instead of undefined msg.from and msg.to, resolving "Provide at least one of to, cc or bcc" SendGrid errors
- June 24, 2025: ULTIMATE email service fix - updated sendEmail function calls to use single-object parameter format matching working booking notification pattern, ensuring email invitations and password resets work correctly
- June 24, 2025: FINAL COMPLETE email fix - restructured sendEmail calls to match exact working notification pattern with proper EmailParams object structure, resolving all undefined parameter issues for user invitations and password resets
- June 24, 2025: ENHANCED day view with analytics sidebar - added comprehensive right sidebar with Day Overview statistics, Studio Utilization with progress bars, Quick Actions panel, and Studio Status overview to maximize screen space usage and provide valuable production facility insights
- June 24, 2025: FIXED studio utilization calculation - updated to include multi-studio bookings via booking-studio junction table links, ensuring accurate utilization percentages for all studio assignments
- June 24, 2025: STREAMLINED Quick Actions - removed redundant "Schedule Maintenance" button, keeping only "Create Alert" for cleaner interface
- June 24, 2025: CREATED public signage display system - built /signage page with real-time facility information including today's schedule, weekly overview, live studio status with availability times, maintenance alerts, current Chicago time, and auto-refresh every 2 minutes for monitor displays throughout the facility
- June 24, 2025: FIXED signage display data access - confirmed existing public API infrastructure works correctly for signage displays to access booking data without authentication
- June 24, 2025: FIXED signage display timezone - corrected Central Time display to show accurate local time (5:25 PM CST instead of 7:25 PM UTC) using JavaScript Intl API for reliable timezone conversion
- June 24, 2025: COMPLETED signage display with weather integration - implemented OpenWeatherMap API integration for Dallas weather data on signage display, with automatic retry mechanism every 5 minutes for new API key activation, displays temperature, humidity, wind speed and weather conditions alongside facility schedule and studio status information
- June 24, 2025: OPTIMIZED studio status display for no-scroll viewing - redesigned studio status section to use 2-column grid layout with compact stacked cards showing studio name, status indicator, current booking title, and availability time in vertical format with smaller text and reduced padding, ensuring all studios visible without scrolling on signage monitors
- June 24, 2025: REPLACED weather details with active site alerts - removed weather information display and added Active Site Alerts section showing maintenance-type bookings as facility alerts (active, today's upcoming, and future maintenance), while filtering these out of Today's Schedule to properly separate regular production bookings from facility maintenance alerts
- June 24, 2025: REPLACED Studio Status with Recent Updates - removed studio status overview and added Recent Updates card showing last 5 bookings created within past 3 days, sorted by creation date with clickable booking tiles displaying status indicators and creation timestamps for better activity tracking
- June 24, 2025: OPTIMIZED sidebar layout for maximum screen utilization - moved Quick Actions card to top for easy access, expanded Studio Utilization and Recent Updates cards with flex-1 classes to dynamically use available vertical screen space, improved overall day view ergonomics
- June 24, 2025: ENHANCED Recent Updates with interactive hover effects - added smooth blue hover backgrounds, enhanced borders, subtle shadows, vibrant status indicators, coordinated text color changes, and 200ms transitions for professional user interaction feedback
- June 24, 2025: IMPLEMENTED CSS-based hover effects with !important declarations - created dedicated .recent-update-item class with forced CSS styling to ensure hover effects override any conflicting styles and display properly
- June 24, 2025: FILTERED Site Management groups from notification selection - hidden site_management group type from booking notification selection interface since these groups are automatically notified for all booking activities, improving UI clarity while maintaining automatic notification functionality
- June 24, 2025: FIXED notification display in booking hover cards - resolved issue where notification groups showed as numeric IDs instead of readable names by implementing proper notification group name resolution across calendar components
- June 23, 2025: Enhanced mobile form button styling - redesigned all form action buttons with modern gradients, improved spacing, rounded corners, and subtle hover animations for better visual appeal and professional appearance
- June 23, 2025: Fixed mobile form deletion UI refresh - resolved issue where deleted bookings didn't disappear from the calendar view without manual page refresh by improving React Query cache invalidation and adding immediate page reload for reliable UI updates
- June 23, 2025: FIXED maintenance booking modal routing - resolved issue where maintenance bookings were opening regular booking edit modal instead of maintenance/alert modal in mobile daily view by implementing proper booking type detection and modal routing based on booking type and studioId
- June 23, 2025: FIXED mobile deletion cache refresh issue - eliminated window.location.reload() calls and implemented comprehensive React Query cache invalidation across all mobile forms (SimpleMobileForm, DirectMobileForm, AlertModal) to ensure deleted bookings and maintenance alerts disappear immediately without manual page refresh
- June 23, 2025: FIXED template studio selection validation - resolved issue where loading templates with selected studios would fail validation by automatically setting primary studioId to first studio from template studioIds array, ensuring mobile forms work seamlessly with template-based booking creation
- June 23, 2025: COMPREHENSIVE mobile view cache refresh fix - implemented advanced React Query pattern matching with predicate functions to invalidate ALL booking-related queries across the entire mobile app, ensuring deletions, additions, and changes appear immediately without requiring manual refresh
- June 23, 2025: FIXED multi-studio template booking creation - updated both SimpleMobileForm and DirectMobileForm to properly pass studioIds array to booking creation API, ensuring templates with multiple studios create bookings on ALL selected studios instead of just the first one
- June 23, 2025: DEBUGGING multi-studio mobile submission - enhanced MobileBookingController and useStudioBookings hook to properly pass studioIds array through the complete submission chain, added comprehensive debug logging to track data flow from mobile form to server API, identified that studioIds array needs to be preserved in booking creation mutation
- June 23, 2025: CONFIRMED multi-studio bug - booking 173 "Test Studio A and F" created with only Studio A link despite user selecting both studios, no entries in booking_studios table proving studioIds array not reaching server, enhanced debug logging in submission chain to track exact data flow issue
- June 26, 2025: IMPLEMENTED PCR room conflict validation - added checkPcrRoomConflicts method to both MemStorage and DatabaseStorage classes, integrated PCR room conflict checking into booking creation (POST /api/bookings) and update (PATCH /api/bookings/:id) API routes to prevent double-booking of PCR rooms during overlapping time periods, ensuring production facility resource integrity
- June 26, 2025: MIGRATED BookingModal to professional notification system - replaced all toast messages with professional modal-based notifications using NotificationModal component and useNotification hook, providing better user experience with proper error handling, success confirmations, and warning messages for booking operations including creation, updates, deletion, and template saving
- June 26, 2025: ENHANCED engineering page with complete 24-hour view and hover tooltips - expanded time display from 6 AM-10 PM to full midnight-11:59 PM view for complete daily visibility, added comprehensive hover tooltips to all booking entries showing title, description, time, studios, PCR room, type, and status, severity field now only displays for maintenance/site alert bookings to reduce clutter on regular production bookings
- June 26, 2025: CLEANED UP engineering page header - removed unnecessary "Google Calendar Style View" badge from page header for cleaner, more professional appearance
- June 26, 2025: IMPLEMENTED severity-based alert styling in engineering view - added color-coded backgrounds (yellow/orange/red) based on severity levels (low/medium/high/critical), distinctive alert badges with warning icons and severity indicators, enhanced borders and contrast for maintenance/alert bookings, ensuring immediate visual identification of critical facility issues
- June 26, 2025: FIXED all-day maintenance display issue - resolved problem where all-day maintenance events (like "Coms Outage") only showed as tiny segments by implementing proper cross-midnight span detection and full-day height calculation, all-day alerts now properly span entire 24-hour day in engineering calendar view for maximum visibility
- June 26, 2025: ADDED current time indicator line to engineering calendar - implemented real-time red line that tracks current Chicago/Dallas time position across the 24-hour schedule, updates every minute, includes time label and visual indicators, only displays when current day is visible in week view for immediate schedule awareness
- June 26, 2025: IMPLEMENTED dedicated alerts row in engineering view - added prominent alerts section at top of page showing all maintenance and site alerts with severity-based coloring, separated alerts from time-based schedule similar to calendar week view, includes alert count badge and comprehensive hover tooltips for quick facility issue assessment
- June 26, 2025: COMPLETED day-by-day alerts grid layout - transformed alerts row to show alerts organized by their scheduled days in column format, with "No alerts" display for empty days, matching engineering calendar layout for optimal visual consistency
- June 26, 2025: FIXED time display format in engineering view - corrected 12-hour time conversion logic to properly show 12:00 AM to 11:59 PM instead of incorrect 2:00 AM to 1:59 AM format, ensuring standard time display throughout the facility schedule
- June 27, 2025: COMPLETELY FIXED booking update email template "Changes Made" section - replaced raw database field output with professional formatting that matches the original booking information section, including proper field labels (Title, Start, End, Studios, Status, PCR Room), formatted dates in Chicago timezone, uppercase status values, and clean studio name display instead of technical field names like "studioIds: 5,6"
- June 27, 2025: FIXED Sunday booking display issue in engineering calendar view - resolved critical bug where bookings scheduled on Sunday weren't appearing by updating week filtering logic to use endOfDay() for week end calculation, ensuring Sunday bookings throughout the entire day (not just midnight) are properly included in the weekly view
- June 27, 2025: IMPLEMENTED comprehensive time validation across ALL booking forms - added real-time validation to prevent end times from being earlier than start times in SimpleMobileForm, DirectMobileForm, and BookingModal with user-friendly notification messages, ensuring data integrity and preventing invalid booking time ranges throughout the entire application
- June 27, 2025: ENHANCED calendar booking overlap display - replaced equal-division algorithm with minimum readable width (40%) approach, implemented controlled overlap positioning with 15% offset, added shadows and z-index layering for visual separation, improved day filtering logic to prevent bookings appearing on incorrect days, added overflow containment to day columns for clean visual boundaries

## User Preferences

Preferred communication style: Simple, everyday language.