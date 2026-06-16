# BookStud.io - Television Studio Management System

## Overview

BookStud.io is a comprehensive web application for television studio management providing intelligent scheduling, booking, and access control. It supports multi-studio booking, real-time status, template-based booking creation, and role-based user management. The system is designed for television production facilities needing sophisticated scheduling and notification management.

**Latest Version: 1.8.4** - Two-way SSO role sync. Previously every Authentik SSO login force-overwrote the user's role with the group-derived role, which reverted any manual permission changes made in-app (everyone not in a mapped group kept dropping back to the default). Now the group→role mapping and the in-app role coexist: a new nullable `sso_synced_role` column on `users` records the last group-derived role applied. On each SSO login, the role is only re-synced from Authentik when the group-derived role actually changed since last login (group membership changed in Authentik); otherwise the in-app role is left untouched so manual edits persist. First login under this scheme (NULL baseline, e.g. linked-by-email or pre-existing SSO accounts) records the baseline without overwriting the current role. The no-group default role is `viewer`. Group mapping env vars: `OIDC_ADMIN_GROUP`, `OIDC_SITE_MANAGER_GROUP`, `OIDC_ENGINEER_GROUP`. Startup auto-ensures the column; migration: `scripts/production-migration-v1.8.4.cjs`.

**Version 1.8.3** - Centerable studio names on the facility Map. Polygon labels previously rendered at the vertex centroid, which lands off-center on L-shaped rooms. Each shape now supports an optional manual label position: in Edit layout mode, drag a room's name to reposition it, click "Center label" (in the selected-shape edit panel) to snap it to the shape's bounding-box center, or "Reset" to return to automatic centering. The label position is stored on `facility_map_rooms` via two new nullable columns `label_x`/`label_y` (double precision, facility-map SVG coordinate space) — NULL means auto-center on the shape. Persisted through the existing replace-all `PUT /api/facility-map`, and included in map backup/restore (download/upload). Startup auto-ensures the columns; migration: `scripts/production-migration-v1.8.3.cjs`.

**Version 1.8.2** - Studio photo pins on the facility map (editor-only). Reference photos are placed as pins at exact spots on the Studios → Map view, and the whole pin system lives inside the map's Edit layout mode. An authorized user (admin, site_manager, engineer, it) enters Edit layout, clicks "Add photo pin" (in the editor toolbar beside Rectangle/Polygon/Delete/Cancel/Save), clicks the spot on a studio shape where a shot was taken (cursor becomes a crosshair; shape dragging is suppressed while in pin mode), then takes/chooses a photo (client-side compressed to ≤1000px JPEG base64) with an optional angle label. A camera pin appears at that point, tied to the studio whose shape was clicked. Pins render and are clickable only in Edit layout mode — click a pin to view that angle fullscreen or delete it. Pins are stored in the existing `studio_photos` table, extended with nullable `x`/`y` (double precision, facility-map SVG coordinate space 0..680 × 0..470) — a photo with coordinates is a pin. API: `GET /api/facility-map/photo-pins` (auth, returns all positioned photos), `POST /api/studios/:id/photos` now accepts optional `x`/`y` (validated: studio exists, both-or-neither, finite, in-bounds), delete via existing `DELETE /api/studios/:id/photos/:photoId`. The previous per-studio photo gallery surfaces were replaced by this pin system. Migration: `scripts/production-migration-v1.8.2.cjs`.

**Version 1.8.1** - Studio reference photos. On the Studios → Map view, clicking a room linked to a studio shows a "Studio photos" section in the side panel where reference shots of the studio (from different angles) can be viewed in a fullscreen viewer. Authorized roles (admin, site_manager, engineer, it) can add photos (camera or file, client-side compressed to ≤1000px JPEG base64, max 12 per studio) with an optional angle caption, and delete them; all other authenticated users are view-only. Photo management is allowed on mobile too (camera capture) even though map editing is desktop-only. New table `studio_photos` (studioId FK→studios ON DELETE CASCADE, photoData, caption, uploadedBy, createdAt). API: `GET /api/studios/:id/photos` (auth), `POST` and `DELETE /api/studios/:id/photos/:photoId` (admin/site_manager/engineer/it). Migration: `scripts/production-migration-v1.8.1.cjs`.

**Version 1.8.0** - Interactive facility map. The Studios page now has a Cards/Map toggle. The Map view renders a free-form SVG floorplan where each shape (rectangle or polygon) can be linked to a studio OR a PCR room, with colors derived automatically from live booking status (available/in-use/maintenance/upcoming; unlinked shapes are grey). Clicking a room shows a side panel with its status, current/next booking, and a Book button (opens the booking modal pre-set to that studio). Admins and site managers get a desktop-only edit mode to add/move/resize/reshape/restyle/relink/delete shapes with Save/Cancel; mobile and other roles are view-only. New table `facility_map_rooms` (shapes). Fresh deployments start with an empty map (no default floorplan is seeded); authorized users build the layout via the in-app editor. A `facilityMapSeeded` system setting (set during migration) guards against any auto-restore of a default layout. Editing the map is restricted to admin, site_manager, engineer, and it roles. API: `GET /api/facility-map`, `PUT /api/facility-map` (admin/site_manager, replace-all, audit logged). Migration: `scripts/production-migration-v1.8.0.cjs`.

**Version 1.6.2** - Authentik SSO/OIDC login. Set `OIDC_ENABLED=true`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `OIDC_ISSUER_URL` (e.g. `https://sso.obtv.io/application/o/<app-slug>/`) in the environment. When enabled, a "Sign in with SSO" button appears on the login page below the standard form. Users are matched by Authentik `sub` claim first, then by email (which links an existing local account), then auto-provisioned as `producer` role. New columns `sso_provider` and `sso_id` added to `users` table. Migration: `scripts/production-migration-v1.6.2.cjs`. PKCE flow used for security.

**Version 1.6.1** - iPhone Calendar sync. Every user gets a private iCal subscription URL at `GET /api/calendar/:token.ics`. Token is stored in new `calendar_token` column on users table (migration: `scripts/production-migration-v1.6.1.cjs`). Settings → My Profile shows a "Calendar Sync" card with the subscription URL, one-click copy, step-by-step iPhone/Google/macOS instructions, and a Reset URL button that regenerates the token (invalidating the old link). The feed includes all user bookings with proper CONFIRMED/TENTATIVE/CANCELLED status, refreshes hourly, and requires no authentication beyond the token itself.

**Version 1.6.0** - Kit asset grouping. Assets can be marked as "Kit" containers that bundle serialized components (e.g., an Aputure LS 600x lamp head + control box) into a single checkout unit. Schema: `isKit boolean` and `parentAssetId integer FK` on `assets` table. Cascade checkout/checkin: checking out a kit auto-checks out all available members; checking in a kit auto-checks in all members with active checkouts. Kit management UI in the desktop edit modal: Kit toggle, "Part of Kit" parent selector, and Kit Members section for adding/removing components. Table row shows a violet "Kit" badge with member count, and a grey "in kit" badge + "Part of: …" line for kit members. Migration script: `scripts/production-migration-v1.6.0.cjs`.

**Version 1.5.9** - New "Production" user role. Can: edit/delete own bookings, edit any production/rehearsal booking, change PCR room status, create/edit/delete templates (own), add booking attachments. Cannot: create/edit/delete maintenance bookings, change studio status, copy bookings, manage notification groups, create/edit/delete site alerts, manage users/teams/studios. Teal badge color in user management. Available in all role dropdowns (invite and edit).

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