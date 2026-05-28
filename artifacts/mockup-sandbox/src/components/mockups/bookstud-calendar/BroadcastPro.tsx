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

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const BP_STYLES = `
.bp-root { font-family: ui-sans-serif, system-ui, -apple-system, "Inter", "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #e2e8f0; background: #0f172a; }
.bp-mono { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace; }
.bp-sidebar-item { display:flex; align-items:center; gap:.75rem; padding:.55rem .75rem; font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; border-radius:4px; transition:all .15s; border-left:2px solid transparent; }
.bp-sidebar-item-active { background: linear-gradient(90deg, rgba(6,182,212,.18), rgba(6,182,212,0)); color:#67e8f9; border-left-color:#06b6d4; box-shadow: inset 0 0 0 1px rgba(6,182,212,.25), 0 0 12px rgba(6,182,212,.18); }
.bp-sidebar-item-inactive { color:#94a3b8; }
.bp-sidebar-item-inactive:hover { background:#1e293b; color:#e2e8f0; }
.bp-booking { transition: all .15s ease-out; background:#1e293b; border:1px solid #334155; border-left-width:4px; border-radius:4px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.02); }
.bp-booking:hover { transform: translateY(-1px); box-shadow: 0 6px 18px -6px rgba(6,182,212,.35), inset 0 0 0 1px rgba(6,182,212,.4); }
.bp-pill { display:inline-flex; align-items:center; gap:.35rem; padding: 2px 8px; border-radius: 9999px; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.bp-zebra-even { background:#1a2333; }
.bp-zebra-odd { background:#14202d; }
.bp-today { background: linear-gradient(180deg, rgba(6,182,212,.08), rgba(6,182,212,.02)) !important; box-shadow: inset 0 -2px 0 #06b6d4; }
.bp-grid-cell { border-right:1px solid #334155; border-bottom:1px solid #334155; }
.bp-scroll::-webkit-scrollbar { width:8px; height:8px; }
.bp-scroll::-webkit-scrollbar-track { background:#0f172a; }
.bp-scroll::-webkit-scrollbar-thumb { background:#334155; border-radius:4px; }
.bp-scroll::-webkit-scrollbar-thumb:hover { background:#06b6d4; }
@keyframes bpFadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
.bp-fade-in { animation: bpFadeIn .2s ease-out; }
.bp-glow-cyan { box-shadow: 0 0 0 1px #06b6d4, 0 0 14px rgba(6,182,212,.4); }
.bp-btn { display:inline-flex; align-items:center; justify-content:center; gap:.35rem; padding: 6px 10px; height:32px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#cbd5e1; background:#1e293b; border:1px solid #334155; border-radius:4px; transition: all .12s; }
.bp-btn:hover { background:#243244; color:#fff; border-color:#475569; }
.bp-tab { display:inline-flex; align-items:center; gap:6px; padding: 6px 10px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#94a3b8; border-radius:3px; }
.bp-tab-active { background:#06b6d4; color:#0f172a; }
.bp-accent-underline { box-shadow: inset 0 -2px 0 #06b6d4; }
`;

const USER = { name: "Sarah Chen", role: "admin", initial: "S" };
const SITE_NAME = "BookStud.io";

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
  dayIndex: number;
  title: string;
  start: string;
  end: string;
  type: BookingType;
  producerInitials: string;
}

const BOOKINGS: Booking[] = [
  { id: 1, studioId: 1, dayIndex: 0, title: "Morning News", start: "6:00 AM", end: "9:00 AM", type: "broadcast", producerInitials: "MW" },
  { id: 2, studioId: 1, dayIndex: 0, title: "Tech Talk Live", start: "10:00 AM", end: "11:30 AM", type: "production", producerInitials: "PP" },
  { id: 3, studioId: 1, dayIndex: 2, title: "Morning News", start: "6:00 AM", end: "9:00 AM", type: "broadcast", producerInitials: "MW" },
  { id: 4, studioId: 1, dayIndex: 4, title: "Election Night Special", start: "7:00 PM", end: "11:00 PM", type: "broadcast", producerInitials: "SC" },
  { id: 5, studioId: 2, dayIndex: 1, title: "Weekly Roundtable", start: "1:00 PM", end: "3:00 PM", type: "production", producerInitials: "JO" },
  { id: 6, studioId: 2, dayIndex: 3, title: "Sports Wrap Rehearsal", start: "2:00 PM", end: "4:00 PM", type: "rehearsal", producerInitials: "PP" },
  { id: 7, studioId: 2, dayIndex: 5, title: "Sports Wrap", start: "5:00 PM", end: "7:00 PM", type: "broadcast", producerInitials: "PP" },
  { id: 8, studioId: 3, dayIndex: 2, title: "Cooking Segment Taping", start: "9:00 AM", end: "12:00 PM", type: "production", producerInitials: "SC" },
  { id: 9, studioId: 3, dayIndex: 6, title: "Sunday Worship", start: "8:00 AM", end: "10:00 AM", type: "broadcast", producerInitials: "JO" },
  { id: 10, studioId: 4, dayIndex: 0, title: "Morning News Control", start: "5:30 AM", end: "9:30 AM", type: "broadcast", producerInitials: "MW" },
  { id: 11, studioId: 4, dayIndex: 2, title: "Morning News Control", start: "5:30 AM", end: "9:30 AM", type: "broadcast", producerInitials: "MW" },
  { id: 12, studioId: 4, dayIndex: 4, title: "Election Night Control", start: "6:30 PM", end: "11:30 PM", type: "broadcast", producerInitials: "SC" },
  { id: 13, studioId: 5, dayIndex: 1, title: "Roundtable Control", start: "12:30 PM", end: "3:30 PM", type: "production", producerInitials: "JO" },
  { id: 14, studioId: 6, dayIndex: 3, title: "Studio Maintenance — HVAC", start: "9:00 AM", end: "5:00 PM", type: "maintenance", producerInitials: "MW" },
  { id: 15, studioId: 6, dayIndex: 5, title: "Promo Edit Session", start: "10:00 AM", end: "2:00 PM", type: "production", producerInitials: "PP" },
];

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
        "bp-sidebar-item w-full text-left",
        isActive ? "bp-sidebar-item-active" : "bp-sidebar-item-inactive"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none" style={{ background: "#f59e0b", color: "#0f172a" }}>
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
      <button className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-bold uppercase tracking-[.15em] transition-colors" style={{ color: "#475569" }}>
        <span className="flex items-center gap-2">
          {icon && <span className="opacity-70">{icon}</span>}
          {title}
        </span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && <div className="space-y-0.5 bp-fade-in">{children}</div>}
    </div>
  );
}

function Sidebar() {
  const iconSize = "h-4 w-4";
  return (
    <aside className="w-64 shrink-0 flex flex-col" style={{ background: "#0b1220", borderRight: "1px solid #1e293b" }}>
      <div className="flex-shrink-0 p-4" style={{ borderBottom: "1px solid #1e293b" }}>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 flex items-center justify-center font-bold text-lg bp-mono bp-glow-cyan" style={{ background: "#0f172a", color: "#06b6d4", borderRadius: 4 }}>
            BS
          </div>
          <div className="flex flex-col">
            <h1 className="text-[13px] font-bold tracking-wider text-white uppercase">{SITE_NAME}</h1>
            <span className="text-[10px] uppercase tracking-[.2em]" style={{ color: "#06b6d4" }}>Control Room</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4 bp-scroll">
        <div className="space-y-0.5">
          <NavItem icon={<IconCalendar className={iconSize} />} label="Calendar" isActive />
          <NavItem icon={<IconMyBookings className={iconSize} />} label="My Bookings" />
          <NavItem icon={<IconTemplates className={iconSize} />} label="Templates" />
          <NavItem icon={<IconReports className={iconSize} />} label="Reports" />
          <NavItem icon={<IconAssets className={iconSize} />} label="Assets" badge="Beta" />
          <NavItem icon={<UserPlus className={iconSize} />} label="Crew" badge="New" />
        </div>

        <NavSection title="Administration" icon={<IconAdministration className="h-3 w-3" />}>
          <NavItem icon={<Users className={iconSize} />} label="User Management" />
          <NavItem icon={<ClipboardList className={iconSize} />} label="Booking Ownership" />
          <NavItem icon={<Database className={iconSize} />} label="Database Health" />
        </NavSection>

        <NavSection title="Management" icon={<IconManagement className="h-3 w-3" />}>
          <NavItem icon={<UsersRound className={iconSize} />} label="Teams" />
          <NavItem icon={<FileCheck2 className={iconSize} />} label="Audit Logs" />
        </NavSection>

        <div className="pt-2" style={{ borderTop: "1px solid #1e293b" }}>
          <NavItem icon={<IconSettings className={iconSize} />} label="Settings" />
        </div>
      </nav>

      <div className="flex-shrink-0 p-3" style={{ borderTop: "1px solid #1e293b", background: "#070d18" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center text-white font-bold text-sm bp-mono" style={{ background: "#06b6d4", color: "#0f172a", borderRadius: 4 }}>
            {USER.initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-white truncate">{USER.name}</p>
            <p className="text-[10px] uppercase tracking-[.15em]" style={{ color: "#06b6d4" }}>{USER.role}</p>
          </div>
          <button className="p-2 transition-colors" style={{ color: "#64748b", borderRadius: 4 }} title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const viewOptions = [
    { key: "day", label: "Day", icon: CalendarDays },
    { key: "week", label: "Week", icon: CalendarIcon },
    { key: "timeline", label: "Timeline", icon: Clock },
    { key: "month", label: "Month", icon: LayoutGrid },
  ] as const;
  const activeView = "week";

  return (
    <header style={{ background: "#0b1220", borderBottom: "1px solid #06b6d4" }}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 lg:px-6 min-h-[64px] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button className="hidden lg:flex shrink-0 items-center justify-center h-8 w-8 transition-colors" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 4 }} title="Hide sidebar">
            <Menu className="h-4 w-4" style={{ color: "#94a3b8" }} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center shrink-0" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 4 }}>
              <button className="p-2 transition-colors" style={{ borderRight: "1px solid #334155" }}>
                <ChevronLeft className="h-4 w-4" style={{ color: "#94a3b8" }} />
              </button>
              <button className="px-3 py-1.5 min-w-[120px] lg:min-w-[200px] text-center transition-colors flex items-center justify-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5 hidden sm:block shrink-0" style={{ color: "#06b6d4" }} />
                <span className="text-[12px] font-bold bp-mono tracking-wider text-white truncate uppercase">
                  MAY 25 – 31, 2026
                </span>
              </button>
              <button className="p-2 transition-colors" style={{ borderLeft: "1px solid #334155" }}>
                <ChevronRight className="h-4 w-4" style={{ color: "#94a3b8" }} />
              </button>
            </div>

            <button className="hidden md:inline-flex bp-btn shrink-0">
              Today
            </button>

            <button className="bp-btn shrink-0">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Studios</span>
            </button>
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="bp-pill" style={{ background: "#052e2b", color: "#22c55e", border: "1px solid #14532d" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }}></span>
              3 Available
            </span>
            <span className="bp-pill" style={{ background: "#350f10", color: "#ef4444", border: "1px solid #7f1d1d" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }}></span>
              2 On Air
            </span>
            <span className="bp-pill" style={{ background: "#3b260a", color: "#f59e0b", border: "1px solid #78350f" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }}></span>
              1 Maint.
            </span>
          </div>
          <div className="hidden xl:flex items-center gap-2 text-[10px] uppercase tracking-[.15em] bp-mono" style={{ color: "#94a3b8" }}>
            <Sun className="h-3 w-3" style={{ color: "#f59e0b" }} />
            <span className="font-bold text-white">72°F</span>
            <span className="opacity-70">CLEAR · DALLAS</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 lg:gap-3">
          <div className="hidden lg:flex items-center p-1" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 4 }}>
            {viewOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeView === option.key;
              return (
                <button
                  key={option.key}
                  className={cn("bp-tab", isActive && "bp-tab-active")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              );
            })}
          </div>

          <button className="h-8 w-8 flex items-center justify-center transition-colors" style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 4 }} title="Toggle theme">
            <Moon className="h-4 w-4" style={{ color: "#94a3b8" }} />
          </button>
        </div>
      </div>
    </header>
  );
}

function bookingTypeColor(type: BookingType): string {
  switch (type) {
    case "broadcast": return "#ef4444";
    case "production": return "#06b6d4";
    case "rehearsal": return "#a855f7";
    case "maintenance": return "#f59e0b";
  }
}

function bookingTypeLabel(type: BookingType): string {
  switch (type) {
    case "broadcast": return "ON AIR";
    case "production": return "PROD";
    case "rehearsal": return "REH";
    case "maintenance": return "MAINT";
  }
}

function BookingBlock({ booking }: { booking: Booking }) {
  const color = bookingTypeColor(booking.type);
  return (
    <div
      className="bp-booking px-2 py-1 mb-1 overflow-hidden relative cursor-pointer"
      style={{
        minHeight: "40px",
        borderLeftColor: color,
      }}
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <span className="font-bold text-[11px] text-white inline-block overflow-hidden text-ellipsis whitespace-nowrap uppercase tracking-wide">
          {booking.title}
        </span>
        <span
          className="bp-mono text-[9px] font-bold leading-none px-1 py-0.5 flex-shrink-0"
          style={{ background: "#0f172a", color: color, borderRadius: 2, border: `1px solid ${color}40` }}
          title={booking.producerInitials}
        >
          {booking.producerInitials}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="text-[10px] bp-mono whitespace-nowrap" style={{ color: "#06b6d4" }}>
          {booking.start} – {booking.end}
        </div>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1 leading-none" style={{ color: color }}>
          {bookingTypeLabel(booking.type)}
        </span>
      </div>
    </div>
  );
}

function AlertsRow() {
  return (
    <div className="contents">
      <div
        className="bp-grid-cell flex items-center sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden"
        style={{ height: "92px", background: "#0b1220" }}
      >
        <div className="text-center w-full px-2">
          <span className="text-[10px] font-bold uppercase tracking-[.15em]" style={{ color: "#f59e0b" }}>⚠ Facility Alerts</span>
        </div>
      </div>

      {WEEK_DATES.map((d, i) => {
        const hasAlert = i === 5;
        return (
          <div
            key={i}
            className={cn(
              "relative bp-grid-cell cursor-pointer",
              i % 2 === 0 ? "bp-zebra-even" : "bp-zebra-odd",
              d.isToday && "bp-today"
            )}
            style={{ height: "92px" }}
          >
            {hasAlert ? (
              <div className="flex flex-col h-full w-full p-1 overflow-y-auto bp-scroll">
                <div className="relative px-2 py-2 mb-4 overflow-visible cursor-pointer" style={{ background: "#3b260a", border: "1px solid #f59e0b", borderLeft: "4px solid #f59e0b", borderRadius: 4 }}>
                  <div className="flex items-center w-full gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }}></span>
                    <span className="font-bold text-[11px] text-white inline-block w-full overflow-hidden text-ellipsis uppercase tracking-wide">
                      Power Maintenance
                    </span>
                  </div>
                  <div className="text-[10px] pl-3.5 bp-mono mt-0.5" style={{ color: "#f59e0b" }}>2:00 AM – 4:00 AM</div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StudioRow({ studio }: { studio: (typeof STUDIOS)[number] }) {
  const studioBookings = BOOKINGS.filter((b) => b.studioId === studio.id);
  const perDay = WEEK_DATES.map((_, i) => studioBookings.filter((b) => b.dayIndex === i).length);
  const maxPerDay = Math.max(...perDay, 0);
  const baseHeight = 48;
  const heightPerBooking = 36;
  const additional = Math.min(maxPerDay * heightPerBooking, 320);
  const rowHeight = baseHeight + additional;

  const statusColor =
    studio.status === "maintenance" ? "#f59e0b"
    : studio.status === "in-use" ? "#ef4444"
    : "#22c55e";
  const statusLabel =
    studio.status === "maintenance" ? "MAINT"
    : studio.status === "in-use" ? "ON AIR"
    : "READY";

  return (
    <div className="contents">
      <div
        className="bp-grid-cell flex items-center px-3 sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden"
        style={{ height: `${rowHeight}px`, background: "#0b1220" }}
      >
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-[12px] font-bold text-white truncate uppercase tracking-wider bp-mono">
            {studio.name}
          </span>
          <span className="bp-pill" style={{ background: "#0f172a", color: statusColor, border: `1px solid ${statusColor}60`, alignSelf: "flex-start", padding: "1px 6px", fontSize: "9px" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor, boxShadow: `0 0 4px ${statusColor}` }}></span>
            {statusLabel}
          </span>
        </div>
      </div>

      {WEEK_DATES.map((d, i) => {
        const dayBookings = studioBookings.filter((b) => b.dayIndex === i);
        return (
          <div
            key={i}
            className={cn(
              "flex flex-col bp-grid-cell p-1 cursor-pointer overflow-y-auto bp-scroll",
              i % 2 === 0 ? "bp-zebra-even" : "bp-zebra-odd",
              d.isToday && "bp-today"
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

function WeekGrid() {
  return (
    <div className="overflow-auto h-full bp-scroll" style={{ background: "#0f172a" }}>
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[160px_repeat(7,1fr)] sticky top-0 z-30 shadow-sm" style={{ background: "#0b1220" }}>
          <div className="h-20 bp-grid-cell" style={{ background: "#0b1220" }}>
            <div className="h-full flex flex-col items-center justify-center">
              <span className="bp-mono text-[10px] uppercase tracking-[.2em]" style={{ color: "#475569" }}>WK 22</span>
              <span className="text-[9px] uppercase tracking-[.15em] mt-0.5" style={{ color: "#06b6d4" }}>2026</span>
            </div>
          </div>
          {WEEK_DATES.map((d, i) => (
            <div
              key={i}
              className={cn(
                "h-20 bp-grid-cell text-center flex flex-col justify-center z-30 p-1",
                i % 2 === 0 ? "bp-zebra-even" : "bp-zebra-odd",
                d.isToday && "bp-today"
              )}
            >
              <div className="text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: d.isToday ? "#06b6d4" : "#94a3b8" }}>{d.day}</div>
              <div
                className={cn(
                  "text-xl font-bold bp-mono mb-0.5",
                  d.isToday ? "text-white" : "text-slate-200"
                )}
                style={d.isToday ? { color: "#06b6d4", textShadow: "0 0 12px rgba(6,182,212,.6)" } : {}}
              >
                {d.date}
              </div>
              <div className="flex items-center justify-center gap-1 text-[10px] bp-mono" style={{ color: "#64748b" }}>
                {i % 3 === 0 ? (
                  <Sun className="h-3 w-3" style={{ color: "#f59e0b" }} />
                ) : (
                  <Cloud className="h-3 w-3" style={{ color: "#06b6d4" }} />
                )}
                <span>{68 + i}°</span>
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="grid grid-cols-[160px_repeat(7,1fr)]">
            <AlertsRow />
            <div className="col-span-8 h-1.5" style={{ background: "#06b6d4", borderBottom: "1px solid #0891b2" }}></div>
            {STUDIOS.map((s) => (
              <StudioRow key={s.id} studio={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fab() {
  return (
    <button
      className="fixed z-40 flex items-center gap-2 transition-all duration-200 bottom-8 right-8 px-5 py-3 bp-glow-cyan"
      style={{
        background: "#06b6d4",
        color: "#0f172a",
        borderRadius: 4,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: ".1em",
      }}
      aria-label="Create new booking"
    >
      <Plus className="flex-shrink-0 h-4 w-4" strokeWidth={3} />
      <span className="text-[12px] whitespace-nowrap">New Booking</span>
    </button>
  );
}

export default function BroadcastPro() {
  return (
    <div className="bp-root min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: BP_STYLES }} />
      <div className="flex h-screen" style={{ background: "#0f172a" }}>
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
