import {
  Users,
  ClipboardList,
  Database,
  UsersRound,
  FileCheck2,
  LogOut,
  ChevronDown,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Menu,
  CalendarDays,
  LayoutGrid,
  Calendar as CalendarIcon,
  Clock,
  Filter,
  Plus,
  Sun,
  Moon,
  Cloud,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const BASE_STYLES = `
.sidebar-item { display:flex; align-items:center; gap:.75rem; padding:.625rem .75rem; font-size:.875rem; font-weight:500; border-radius:.5rem; transition:all .15s; }
.sidebar-item-active { background:#2563eb; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.05); }
.sidebar-item-inactive { color:#4b5563; }
.sidebar-item-inactive:hover { background:#f3f4f6; }
.booking-card { transition:all .2s ease-out; border-left:4px solid #2563eb; }
.booking-card:hover { box-shadow:0 10px 15px -3px rgba(0,0,0,.1); transform:translateY(-2px); }
@keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
.animate-fade-in { animation: fadeIn .2s ease-out; }
`;

const USER = { name: "Sarah Chen", role: "admin", initial: "S" };
const SITE_NAME = "BookStud.io";

// Week: Mon May 25 – Sun May 31, 2026
const WEEK_DATES: { day: string; date: number; isToday?: boolean; isWeekend?: boolean }[] = [
  { day: "Mon", date: 25 },
  { day: "Tue", date: 26 },
  { day: "Wed", date: 27, isToday: true },
  { day: "Thu", date: 28 },
  { day: "Fri", date: 29 },
  { day: "Sat", date: 30, isWeekend: true },
  { day: "Sun", date: 31, isWeekend: true },
];

const STUDIOS = [
  { id: 1, name: "Studio A", status: "in-use" as const },
  { id: 2, name: "Studio B", status: "available" as const },
  { id: 3, name: "Studio C", status: "available" as const },
  { id: 4, name: "PCR 1", status: "in-use" as const },
  { id: 5, name: "PCR 2", status: "available" as const },
  { id: 6, name: "Edit Bay", status: "maintenance" as const },
];

type BookingType = "production" | "rehearsal" | "maintenance" | "broadcast";

interface Booking {
  id: number;
  studioId: number;
  dayIndex: number; // 0 = Mon ... 6 = Sun
  title: string;
  start: string;
  end: string;
  type: BookingType;
  producerInitials: string;
}

// 14 bookings spanning the week
const BOOKINGS: Booking[] = [
  // Studio A
  { id: 1, studioId: 1, dayIndex: 0, title: "Morning News", start: "6:00 AM", end: "9:00 AM", type: "broadcast", producerInitials: "MW" },
  { id: 2, studioId: 1, dayIndex: 0, title: "Tech Talk Live", start: "10:00 AM", end: "11:30 AM", type: "production", producerInitials: "PP" },
  { id: 3, studioId: 1, dayIndex: 2, title: "Morning News", start: "6:00 AM", end: "9:00 AM", type: "broadcast", producerInitials: "MW" },
  { id: 4, studioId: 1, dayIndex: 4, title: "Election Night Special", start: "7:00 PM", end: "11:00 PM", type: "broadcast", producerInitials: "SC" },

  // Studio B
  { id: 5, studioId: 2, dayIndex: 1, title: "Weekly Roundtable", start: "1:00 PM", end: "3:00 PM", type: "production", producerInitials: "JO" },
  { id: 6, studioId: 2, dayIndex: 3, title: "Sports Wrap Rehearsal", start: "2:00 PM", end: "4:00 PM", type: "rehearsal", producerInitials: "PP" },
  { id: 7, studioId: 2, dayIndex: 5, title: "Sports Wrap", start: "5:00 PM", end: "7:00 PM", type: "broadcast", producerInitials: "PP" },

  // Studio C
  { id: 8, studioId: 3, dayIndex: 2, title: "Cooking Segment Taping", start: "9:00 AM", end: "12:00 PM", type: "production", producerInitials: "SC" },
  { id: 9, studioId: 3, dayIndex: 6, title: "Sunday Worship", start: "8:00 AM", end: "10:00 AM", type: "broadcast", producerInitials: "JO" },

  // PCR 1
  { id: 10, studioId: 4, dayIndex: 0, title: "Morning News Control", start: "5:30 AM", end: "9:30 AM", type: "broadcast", producerInitials: "MW" },
  { id: 11, studioId: 4, dayIndex: 2, title: "Morning News Control", start: "5:30 AM", end: "9:30 AM", type: "broadcast", producerInitials: "MW" },
  { id: 12, studioId: 4, dayIndex: 4, title: "Election Night Control", start: "6:30 PM", end: "11:30 PM", type: "broadcast", producerInitials: "SC" },

  // PCR 2
  { id: 13, studioId: 5, dayIndex: 1, title: "Roundtable Control", start: "12:30 PM", end: "3:30 PM", type: "production", producerInitials: "JO" },

  // Edit Bay
  { id: 14, studioId: 6, dayIndex: 3, title: "Studio Maintenance — HVAC", start: "9:00 AM", end: "5:00 PM", type: "maintenance", producerInitials: "MW" },
  { id: 15, studioId: 6, dayIndex: 5, title: "Promo Edit Session", start: "10:00 AM", end: "2:00 PM", type: "production", producerInitials: "PP" },
];

// ────────────────────────────────────────────────────────────────────────────
// Sidebar — copied from client/src/components/layout/Sidebar.tsx
// ────────────────────────────────────────────────────────────────────────────
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="17" rx="2"/>
      <path d="M2 10h20"/>
      <path d="M7 3v4M17 3v4"/>
      <rect x="5" y="13" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <rect x="10.5" y="13" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <rect x="5" y="17" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <rect x="10.5" y="17" width="3" height="2.5" rx=".6" fill="currentColor" stroke="none"/>
      <circle cx="18.5" cy="7.5" r="1.6" fill="#ef4444" stroke="none"/>
    </svg>
  );
}
function IconMyBookings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="8" width="20" height="14" rx="2"/>
      <rect x="2" y="3" width="20" height="6" rx="1.5"/>
      <path d="M5.5 3L3.5 9M9.5 3L7.5 9M13.5 3L11.5 9M17.5 3L15.5 9M21.5 3L19.5 9" strokeWidth="1.2" opacity=".55"/>
      <path d="M7.5 16.5l3 2.5 6-6" strokeWidth="1.6"/>
    </svg>
  );
}
function IconTemplates({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="16" height="18" rx="2"/>
      <rect x="3" y="2" width="16" height="18" rx="2"/>
      <rect x="6" y="6.5" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/>
      <rect x="6" y="11" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/>
      <rect x="6" y="15.5" width="2" height="2" rx=".4" fill="currentColor" stroke="none"/>
      <path d="M10 7.5h6M10 12h6M10 16.5h4" strokeWidth="1.2"/>
    </svg>
  );
}
function IconReports({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".4"/>
      <rect x="3" y="15" width="3.5" height="6" rx="1.75" fill="currentColor"/>
      <rect x="8.25" y="11" width="3.5" height="10" rx="1.75" fill="currentColor"/>
      <rect x="13.5" y="7" width="3.5" height="14" rx="1.75" fill="currentColor"/>
      <rect x="18.5" y="13" width="3" height="8" rx="1.5" fill="currentColor" opacity=".5"/>
      <path d="M12 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9.5 3.8Q12 2 14.5 3.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}
function IconAssets({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="5.5"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5"/>
      <circle cx="12" cy="12" r="3.5"/>
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" strokeWidth="1.4"/>
      <path d="M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5" strokeWidth="1"/>
      <path d="M12 8.5V12.5" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconAdministration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="15" rx="2"/>
      <path d="M2 10h20" strokeWidth="1" opacity=".4"/>
      <circle cx="5.5" cy="7.5" r="1.1" fill="#ef4444" stroke="none"/>
      <circle cx="9" cy="7.5" r="1.1" fill="#f59e0b" stroke="none"/>
      <circle cx="12.5" cy="7.5" r="1.1" fill="#22c55e" stroke="none"/>
      <rect x="4.5" y="12.5" width="4" height="5" rx="1"/>
      <rect x="10" y="12.5" width="4" height="5" rx="1"/>
      <circle cx="19" cy="15" r="2.5"/>
    </svg>
  );
}
function IconManagement({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="6" r="2"/>
      <circle cx="4" cy="12" r="2"/>
      <circle cx="4" cy="18" r="2"/>
      <circle cx="20" cy="8" r="2"/>
      <circle cx="20" cy="16" r="2"/>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/>
    </svg>
  );
}

function NavItem({
  icon,
  label,
  isActive,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  badge?: string;
}) {
  return (
    <button
      className={cn(
        "sidebar-item w-full text-left",
        isActive ? "sidebar-item-active" : "sidebar-item-inactive"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

function NavSection({
  title,
  icon,
  children,
  open = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <div className="space-y-1">
      <button className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        <span className="flex items-center gap-2">
          {icon && <span className="opacity-70">{icon}</span>}
          {title}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && <div className="space-y-0.5 animate-fade-in">{children}</div>}
    </div>
  );
}

function Sidebar() {
  const iconSize = "h-5 w-5";
  return (
    <aside className="w-72 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Header with Logo placeholder */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col items-center">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-2xl shadow-md">
            BS
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-3">{SITE_NAME}</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-0.5">
          <NavItem icon={<IconCalendar className={iconSize} />} label="Calendar" isActive />
          <NavItem icon={<IconMyBookings className={iconSize} />} label="My Bookings" />
          <NavItem icon={<IconTemplates className={iconSize} />} label="Templates" />
          <NavItem icon={<IconReports className={iconSize} />} label="Reports" />
          <NavItem icon={<IconAssets className={iconSize} />} label="Assets" badge="Beta" />
          <NavItem icon={<UserPlus className={iconSize} />} label="Crew" badge="New" />
        </div>

        <NavSection title="Administration" icon={<IconAdministration className="h-3.5 w-3.5" />}>
          <NavItem icon={<Users className={iconSize} />} label="User Management" />
          <NavItem icon={<ClipboardList className={iconSize} />} label="Booking Ownership" />
          <NavItem icon={<Database className={iconSize} />} label="Database Health" />
        </NavSection>

        <NavSection title="Management" icon={<IconManagement className="h-3.5 w-3.5" />}>
          <NavItem icon={<UsersRound className={iconSize} />} label="Teams" />
          <NavItem icon={<FileCheck2 className={iconSize} />} label="Audit Logs" />
        </NavSection>

        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <NavItem icon={<IconSettings className={iconSize} />} label="Settings" />
        </div>
      </nav>

      {/* User Profile */}
      <div className="flex-shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-semibold text-sm shadow-md">
            {USER.initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{USER.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{USER.role}</p>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────────────────
function Header() {
  const viewOptions = [
    { key: "day", label: "Day", icon: CalendarDays },
    { key: "week", label: "Week", icon: CalendarIcon },
    { key: "timeline", label: "Timeline", icon: Clock },
    { key: "month", label: "Month", icon: LayoutGrid },
  ] as const;
  const activeView = "week";

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 lg:px-6 min-h-[72px] gap-2">
        {/* Left Section */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="hidden lg:flex shrink-0 items-center justify-center h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Hide sidebar"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition-colors">
                <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="px-3 py-1.5 min-w-[120px] lg:min-w-[180px] text-center border-x border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block shrink-0" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  May 25 – 31, 2026
                </span>
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition-colors">
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <button className="hidden md:inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 shrink-0">
              Today
            </button>

            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-1.5 shrink-0">
              <Filter className="h-4 w-4" />
              <span className="hidden lg:inline">Studios</span>
            </button>
          </div>
        </div>

        {/* Center Section: Studio Status Summary */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="font-medium text-gray-700 dark:text-gray-300">3 Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="font-medium text-gray-700 dark:text-gray-300">2 In Use</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span className="font-medium text-gray-700 dark:text-gray-300">1 Maint.</span>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Sun className="h-4 w-4 text-amber-500" />
            <span className="font-medium">72°F</span>
            <span className="opacity-60">Clear, Dallas</span>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center justify-end gap-2 lg:gap-3">
          <div className="hidden lg:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {viewOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeView === option.key;
              return (
                <button
                  key={option.key}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    isActive
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              );
            })}
          </div>

          <button className="h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center" title="Toggle theme">
            <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Booking block + colour mapping
// ────────────────────────────────────────────────────────────────────────────
function bookingColorClass(type: BookingType): string {
  switch (type) {
    case "broadcast":
      return "bg-red-100 border-red-300 text-red-800";
    case "production":
      return "bg-blue-100 border-blue-300 text-blue-800";
    case "rehearsal":
      return "bg-purple-100 border-purple-300 text-purple-800";
    case "maintenance":
      return "bg-orange-100 border-orange-400 text-orange-800";
  }
}

function bookingBorderColor(type: BookingType): string {
  switch (type) {
    case "broadcast":
      return "#ef4444";
    case "production":
      return "#3b82f6";
    case "rehearsal":
      return "#a855f7";
    case "maintenance":
      return "#f97316";
  }
}

function BookingBlock({ booking }: { booking: Booking }) {
  return (
    <div
      className={cn(
        "booking-card border dark:border-gray-600 rounded-md px-2 py-1 mb-1 overflow-hidden text-xs z-10 hover:shadow-md cursor-pointer relative",
        bookingColorClass(booking.type)
      )}
      style={{
        minHeight: "38px",
        borderLeftColor: bookingBorderColor(booking.type),
      }}
    >
      <div className="flex items-center w-full">
        <span className="font-medium inline-block w-full overflow-hidden text-ellipsis whitespace-nowrap pr-6">
          {booking.title}
        </span>
        <span
          className="absolute top-0.5 right-1 text-[9px] font-bold leading-none px-1 py-0.5 rounded bg-white/70 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200"
          title={booking.producerInitials}
        >
          {booking.producerInitials}
        </span>
      </div>
      <div className="text-[11px] pl-0 whitespace-nowrap opacity-80">
        {booking.start} – {booking.end}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Alerts Row
// ────────────────────────────────────────────────────────────────────────────
function AlertsRow() {
  // One alert on Saturday (dayIndex 5): Power maintenance
  return (
    <div className="contents">
      <div
        className="border-b dark:border-gray-700 border-r dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden"
        style={{ height: "92px" }}
      >
        <div className="text-center w-full px-2">
          <span className="text-xs font-bold uppercase text-gray-700 dark:text-gray-200">Facility Alerts</span>
        </div>
      </div>

      {WEEK_DATES.map((d, i) => {
        const hasAlert = i === 5; // Saturday
        return (
          <div
            key={i}
            className={cn(
              "relative border-b dark:border-gray-700 border-r dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
              d.isWeekend ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900"
            )}
            style={{ height: "92px" }}
          >
            {hasAlert ? (
              <div className="flex flex-col h-full w-full p-1 overflow-y-auto">
                <div className="relative group border rounded-md px-2 py-2 mb-4 overflow-visible text-xs bg-orange-100 border-orange-400 text-orange-800 shadow-sm transition-all hover:shadow-md cursor-pointer">
                  <div className="flex items-center w-full">
                    <span className="w-2 h-2 rounded-full mr-1 flex-shrink-0 bg-orange-500"></span>
                    <span className="font-medium inline-block w-full overflow-hidden text-ellipsis">
                      Power maintenance — facility-wide
                    </span>
                  </div>
                  <div className="text-xs pl-3">2:00 AM – 4:00 AM</div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Studio Row
// ────────────────────────────────────────────────────────────────────────────
function StudioRow({ studio }: { studio: (typeof STUDIOS)[number] }) {
  const studioBookings = BOOKINGS.filter((b) => b.studioId === studio.id);

  // Compute max bookings/day for row height
  const perDay = WEEK_DATES.map((_, i) => studioBookings.filter((b) => b.dayIndex === i).length);
  const maxPerDay = Math.max(...perDay, 0);
  const baseHeight = 42;
  const heightPerBooking = 32;
  const additional = Math.min(maxPerDay * heightPerBooking, 320);
  const rowHeight = baseHeight + additional;

  const statusClass =
    studio.status === "maintenance"
      ? "bg-orange-500"
      : studio.status === "in-use"
      ? "bg-red-500"
      : "bg-green-500";

  return (
    <div className="contents">
      <div
        className="border-b dark:border-gray-700 border-r dark:border-gray-700 flex items-center px-3 sticky left-0 z-20 bg-white dark:bg-gray-900 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden"
        style={{ height: `${rowHeight}px` }}
      >
        <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${statusClass}`}></div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1 min-w-0">
          {studio.name}
        </span>
      </div>

      {WEEK_DATES.map((d, i) => {
        const dayBookings = studioBookings.filter((b) => b.dayIndex === i);
        return (
          <div
            key={i}
            className={cn(
              "flex flex-col border-b dark:border-gray-700 border-r dark:border-gray-700 p-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 overflow-y-auto",
              d.isWeekend ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900",
              d.isToday && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
            )}
            style={{ minHeight: `${rowHeight}px` }}
          >
            {dayBookings.map((b) => (
              <BookingBlock key={b.id} booking={b} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Week Grid
// ────────────────────────────────────────────────────────────────────────────
function WeekGrid() {
  return (
    <div className="overflow-auto h-full">
      <div className="min-w-[1000px]">
        {/* Days Header with Weather Forecast */}
        <div className="grid grid-cols-[160px_repeat(7,1fr)] sticky top-0 z-30 bg-white dark:bg-gray-900 shadow-sm">
          <div className="h-20 border-b border-r dark:border-gray-700 bg-white dark:bg-gray-900 z-30"></div>
          {WEEK_DATES.map((d, i) => (
            <div
              key={i}
              className={cn(
                "h-20 border-b text-center flex flex-col justify-center z-30 p-1 dark:border-gray-700",
                d.isWeekend ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900",
                d.isToday && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
              )}
            >
              <div className="text-sm font-medium dark:text-gray-200">{d.day}</div>
              <div
                className={cn(
                  "text-lg font-semibold mb-1 dark:text-gray-100",
                  d.isToday &&
                    "text-blue-600 dark:text-blue-400 rounded-full w-8 h-8 mx-auto flex items-center justify-center bg-blue-100 dark:bg-blue-900"
                )}
              >
                {d.date}
              </div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                {i % 3 === 0 ? (
                  <Sun className="h-3 w-3 text-amber-500" />
                ) : (
                  <Cloud className="h-3 w-3 text-sky-500" />
                )}
                <span>{68 + i}°</span>
              </div>
            </div>
          ))}
        </div>

        {/* Grid Body */}
        <div className="relative">
          <div className="grid grid-cols-[160px_repeat(7,1fr)]">
            <AlertsRow />
            <div className="col-span-8 h-2 bg-gray-200 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600"></div>
            {STUDIOS.map((s) => (
              <StudioRow key={s.id} studio={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FAB
// ────────────────────────────────────────────────────────────────────────────
function Fab() {
  return (
    <button
      className={cn(
        "fixed z-40 flex items-center gap-2 rounded-full shadow-xl transition-all duration-300",
        "bg-gradient-to-r from-blue-700 to-indigo-700 text-white",
        "hover:from-blue-800 hover:to-indigo-800 hover:shadow-2xl hover:scale-105",
        "active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-500/30",
        "bottom-8 right-8 px-5 py-3.5"
      )}
      aria-label="Create new booking"
    >
      <Plus className="flex-shrink-0 h-5 w-5" />
      <span className="font-semibold text-sm whitespace-nowrap">New Booking</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────────────────────
export default function Current() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <style dangerouslySetInnerHTML={{ __html: BASE_STYLES }} />
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <div className="flex-1 min-h-0 overflow-hidden">
            <WeekGrid />
          </div>
        </div>
        <Fab />
      </div>
    </div>
  );
}
