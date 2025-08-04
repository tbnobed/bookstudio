# BookStud.io - Television Studio Management System

## Overview

BookStud.io is a comprehensive web application for television studio management providing intelligent scheduling, booking, and access control. It supports multi-studio booking, real-time status, template-based booking creation, and role-based user management. The system is designed for television production facilities needing sophisticated scheduling and notification management.

**Latest Version: 1.5.3** - Features comprehensive audit logging system tracking ALL system activities and NEW Teams feature allowing producers and other roles to collaborate by viewing each other's bookings. Teams feature includes full team management (create/edit/delete teams and manage members), team-based booking visibility in "My Bookings" page with tabs for personal vs team bookings, role-based access control for team management (admin/site manager), visual indicators to distinguish team bookings from personal bookings, and enhanced status indicators for cancelled/tentative bookings with proper styling. Fully integrated with Docker deployment pipeline with complete schema compatibility fixes and production-ready migration scripts.

**NEW: Admin Booking Ownership Management** (August 2025) - Complete admin-only interface for correcting the legacy 62.8% admin ownership corruption affecting 78 out of 125 bookings. Features real-time statistics dashboard, filtering/search capabilities, bulk ownership transfer with confirmation dialogs, complete audit trail integration, and safe date handling preventing application crashes. Accessible at `/admin/booking-ownership` for manual correction of historical data corruption issues.

**PRODUCTION BACKUP SYSTEM FIX** - Resolved backup system failures in production Docker environments by including PostgreSQL client tools (postgresql15-client) in Dockerfile and enhancing error handling in backup services to check for tool availability before attempting operations.

**BOOKING OWNERSHIP BUG FIXED** (August 2025) - Completely resolved critical frontend bug where hardcoded `userId: 1` was sent in all booking creation requests from both desktop (`BookingModal.tsx`) and mobile (`SimpleMobileForm-new.tsx`) forms. Server now correctly assigns booking ownership based on authenticated user. Database sequence counter issues resolved to prevent ID conflicts during booking creation. All new bookings now correctly show actual creator ownership instead of admin ownership.

## User Preferences

Preferred communication style: Simple, everyday language.

**CRITICAL TIMEZONE REQUIREMENT**: ALL date/time operations throughout the entire application MUST use facility timezone (configured via VITE_FACILITY_TIMEZONE environment variable). This includes:
- Date comparisons and calculations
- Display formatting
- Database queries with date ranges
- Status checks and availability logic
- Never use browser local timezone or UTC for comparisons
- Always use the configured facility timezone in all date operations

**DOCKER DEPLOYMENT COMPATIBILITY**: All Docker deployment issues have been resolved including SSL connection handling, database schema mismatches, audit logging system integration, and backup system PostgreSQL client tools availability. Complete migration sequence ensures clean deployments with fully functional backup/restore capabilities.

## System Architecture

### Frontend
- **Framework**: React.js with TypeScript
- **UI Components**: Radix UI with shadcn/ui
- **Styling**: TailwindCSS
- **State Management**: React Query
- **Build Tool**: Vite
- **Form Handling**: React Hook Form with Zod validation
- **Design Principles**: Gradient backgrounds, glass-like effects, enhanced shadows, responsive layouts, professional visual appeal for both desktop and mobile.

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js (session-based)
- **Session Storage**: PostgreSQL-backed sessions (connect-pg-simple)
- **File Handling**: Multer for uploads

### Data Storage
- **Primary Database**: PostgreSQL with connection pooling
- **ORM**: Drizzle ORM
- **Schema Management**: Drizzle Kit

### Key Features
- **Studio Management**: Real-time status, multi-studio booking, PCR assignment, calendar views with timezone handling.
- **Booking Engine**: Complex booking creation, template system, status management, color-coded visualization, copy functionality.
- **Linked Copy System** (v1.5.0): Advanced linked booking copies where updates to one booking automatically update all linked copies, with selective deletion options and visual indicators.
- **User Management**: Role-based access control, secure password hashing, email-based invitations, password reset.
- **Notification System**: Email notifications via SendGrid, notification groups, automated confirmations/updates, facility-wide alerts.
- **Template System**: Reusable booking templates (JSON-based), user-specific management.
- **Alerts System**: Dedicated alerts table and API for facility-wide alerts (maintenance, IT), separate from bookings, with severity-based styling and notifications.
- **Signage Display**: Public-facing `/signage` and custom `/custom-signage` pages with real-time schedule, weekly overview, studio status, alerts, weather integration, and auto-refresh.
- **Dynamic Booking Types**: API-driven booking types with CRUD management via Settings page, supporting custom types and active/inactive status.
- **Enhanced Modal Architecture** (v1.5.0): Improved responsive booking modals with proper routing between desktop/mobile forms and fixed day view new booking issues.
- **Comprehensive Audit Logging** (v1.5.2): Complete audit trail implementation across ALL system operations including user management (invite/create/update/delete), template CRUD operations, alert management, system configuration changes, studio/PCR room management, notification group operations, and booking management with 90-day retention policy and enhanced UI display.
- **Teams Feature** (v1.5.3): Collaborative booking system allowing team members to view each other's bookings. Features include team creation/management, member invitation system, role-based team management (admin/site manager access), enhanced "My Bookings" page with personal vs team tabs, visual indicators for team bookings, and pagination support for large teams.
- **Admin Booking Ownership Management** (v1.5.3): Dedicated admin interface for correcting legacy booking ownership corruption. Provides real-time statistics showing current admin ownership percentage (62.4%), filtering and search capabilities, bulk ownership transfer operations with confirmation dialogs, complete audit trail integration, and robust error handling for date formatting issues.

### Core Decisions
- **Architectural Separation**: Strict separation between production bookings and facility alerts to ensure data integrity and prevent cross-contamination.
- **Timezone Consistency**: All date/time operations are consistently handled using a configurable facility timezone (VITE_FACILITY_TIMEZONE) across frontend, backend, and database for multi-city deployment.
- **Containerization**: Docker-first approach for deployment, simplifying environment setup and ensuring consistency.
- **Mobile-First Design**: Optimized layouts, simplified navigation, and intuitive interactions for mobile users, including a dedicated Studios page as the mobile default home.

## External Dependencies

- **PostgreSQL**: Primary database.
- **SendGrid**: Email delivery service for notifications and user management.
- **OpenWeatherMap API**: Weather data integration for signage and calendar displays.
- **Docker**: Containerization platform for deployment.