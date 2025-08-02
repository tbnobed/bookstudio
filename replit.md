# BookStud.io - Television Studio Management System

## Overview

BookStud.io is a comprehensive web application for television studio management providing intelligent scheduling, booking, and access control. It supports multi-studio booking, real-time status, template-based booking creation, and role-based user management. The system is designed for television production facilities needing sophisticated scheduling and notification management.

**Latest Version: 1.5.0** - Features advanced linked copy functionality where users can create linked booking copies that automatically synchronize updates across all linked instances, with selective deletion options and enhanced modal architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

**CRITICAL TIMEZONE REQUIREMENT**: ALL date/time operations throughout the entire application MUST use facility timezone (configured via VITE_FACILITY_TIMEZONE environment variable). This includes:
- Date comparisons and calculations
- Display formatting
- Database queries with date ranges
- Status checks and availability logic
- Never use browser local timezone or UTC for comparisons
- Always use the configured facility timezone in all date operations

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