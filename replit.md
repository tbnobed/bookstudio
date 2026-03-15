# BookStud.io - Television Studio Management System

## Overview

BookStud.io is a comprehensive web application for television studio management providing intelligent scheduling, booking, and access control. It supports multi-studio booking, real-time status, template-based booking creation, and role-based user management. The system is designed for television production facilities needing sophisticated scheduling and notification management.

**Latest Version: 1.5.9** - New "Production" user role. Has the same permissions as Engineer (can manage bookings, change studio/PCR status, manage notification groups, view reports) except cannot create, edit, or delete site alerts. Teal badge color in user management. Available in all role dropdowns (invite and edit).

**Version 1.5.8** - Pre-printed barcode label scanning for the Asset Tag field. Desktop: new `BarcodeScannerDialog` (webcam-based, using `BarcodeDetectorPolyfill`) with a "Scan Label" button beside the Asset Tag input in the add/edit modal — auto-generates still available as a fallback. Mobile: "Scan Label" button added to the edit form's Asset Tag field; add form scan button renamed from "Bar" → "Scan Label" with improved placeholder; auto-generation on sheet open removed (scan-first UX). Scan callback extended to handle `editTag` / `editSerial` targets so the shared `BarcodeScanner` overlay populates both add and edit forms. No backend changes required.

**Version 1.5.7** - Booking–Asset planning system. Booking gear assignments are now informational-only (no checkout side effects). The "Assets" tab inside booking modals shows a pure planning list — crew add/remove equipment via `/api/bookings/:id/assets` (`booking_assets` table). Physical checkout remains the sole availability gate. Assets still checked out after their associated production ends surface an "Overdue Return" warning on both the desktop Assets table and mobile asset cards (`bookingEnded` flag returned by `/api/assets/checkouts/active`). MemStorage stubs added for `getBookingAssets`, `addBookingAsset`, `removeBookingAsset`. `BookingAssetsTab` completely rewritten.

**Version 1.5.6** - Adds Decommission workflow to asset edit forms. Both desktop and mobile edit forms include a "Decommission Asset" button in the footer that expands a danger zone requiring a written reason before retiring the equipment. On submit, status is set to `retired` and the reason is stored in the new `decommission_reason` column on the `assets` table. Once decommissioned, the reason displays read-only. All 6 asset events (create, update, decommission, checkout, checkin, delete) now write audit log entries and send email notifications to Asset Managers groups — decommission alerts carry a dark-red header and include the recorded reason. Docker migration `production-migration-v1.5.6.cjs` adds the `decommission_reason TEXT` column with a partial index.

**Version 1.5.5** - Adds asset photo management to both the desktop and mobile PWA. Each asset supports up to 5 photos stored as compressed base64 JPEG (max 1200px, 75% quality). Desktop: photo grid inside the edit modal with hover-to-delete and fullscreen viewer. Mobile: collapsible photo section on each asset card (lazy-loaded, tap to expand), plus ability to take or choose a photo when adding a new asset in the "Add New Asset" sheet. Photos are stored in the new `asset_photos` table with a foreign key to `assets` and cascade delete. Docker migration `production-migration-v1.5.5.cjs` creates the table, indexes, and FK for fresh and existing deployments.

**NEW: Admin Booking Ownership Management** (August 2025) - Complete admin-only interface for correcting the legacy 62.8% admin ownership corruption affecting 78 out of 125 bookings. Features real-time statistics dashboard, filtering/search capabilities, bulk ownership transfer with confirmation dialogs, complete audit trail integration, and safe date handling preventing application crashes. Accessible at `/admin/booking-ownership` for manual correction of historical data corruption issues.

**PRODUCTION BACKUP SYSTEM FIX** - Resolved backup system failures in production Docker environments by including PostgreSQL client tools (postgresql15-client) in Dockerfile and enhancing error handling in backup services to check for tool availability before attempting operations.

**BOOKING OWNERSHIP BUG FIXED** (August 2025) - Completely resolved critical frontend bug where hardcoded `userId: 1` was sent in all booking creation requests from both desktop (`BookingModal.tsx`) and mobile (`SimpleMobileForm-new.tsx`) forms. Server now correctly assigns booking ownership based on authenticated user. Database sequence counter issues resolved to prevent ID conflicts during booking creation. All new bookings now correctly show actual creator ownership instead of admin ownership.

**DATABASE HEALTH METRICS COMPLETELY FIXED** (August 2025) - Resolved all PostgreSQL syntax errors in database health monitoring system. Fixed "syntax error at or near 'end'" by replacing raw SQL queries with proper Drizzle ORM operators for reserved keyword handling. Switched invalid date queries from raw SQL to use `lte()` operator for safer column references. Updated duplicate record queries to properly escape column names. Fixed recurring database sequence synchronization issues affecting booking_studios and notifications tables. Database health metrics at `/admin/database-health` now function completely without any PostgreSQL query errors.

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
- **Asset Management** (v1.5.4): Full production gear inventory system at `/assets`. Track cameras, lighting, audio, video, cables, accessories, and other equipment. Features include: status tracking (available/in-use/maintenance/retired), category-based organization with color coding, serial number and asset tag tracking, location tracking, search and multi-filter (category + status), quick-action status summary cards, add/edit/delete modal, role-based delete permissions (admin/site_manager only), right-click context menu for quick status changes, and full check-out/check-in system with per-asset history log, who-has-it display, purpose/notes on checkout, and time-out duration tracking.
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