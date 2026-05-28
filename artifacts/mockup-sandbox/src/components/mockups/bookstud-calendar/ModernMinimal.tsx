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

const MM_STYLES = `
.mm-root { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif; font-size:15px; line-height:1.55; color:#18181b; background:#fafafa; }
.mm-root *, .mm-root *::before, .mm-root *::after { box-sizing: border-box; }
.mm-card { background:#ffffff; border:1px solid #e4e4e7; border-radius:12px; }
.mm-hairline { border-color:#e4e4e7 !important; }
.mm-sidebar-item { display:flex; align-items:center; gap:.75rem; padding:.5rem .75rem; font-size:14px; font-weight:500; border-radius:8px; transition:background .15s, color .15s; color:#52525b; }
.mm-sidebar-item:hover { background:#f4f4f5; color:#18181b; }
.mm-sidebar-item-active { background:#eef2ff; color:#4338ca; }
.mm-sidebar-item-active:hover { background:#e0e7ff; color:#4338ca; }
.mm-sidebar-icon { width:16px; height:16px; stroke-width:1.75; }
.mm-section-title { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#a1a1aa; }
.mm-ghost-btn { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; height:34px; padding:0 12px; border-radius:8px; font-size:14px; font-weight:500; color:#3f3f46; background:transparent; border:1px solid transparent; transition:background .15s, border-color .15s; }
.mm-ghost-btn:hover { background:#f4f4f5; }
.mm-outline-btn { display:inline-flex; align-items:center; justify-content:center; gap:.4rem; height:34px; padding:0 12px; border-radius:8px; font-size:14px; font-weight:500; color:#3f3f46; background:#ffffff; border:1px solid #e4e4e7; transition:background .15s; }
.mm-outline-btn:hover { background:#fafafa; }
.mm-icon-btn { width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; color:#52525b; transition:background .15s; }
.mm-icon-btn:hover { background:#f4f4f5; color:#18181b; }
.mm-page-heading { font-size:22px; font-weight:600; letter-spacing:-.01em; color:#18181b; }
.mm-booking { position:relative; border-radius:10px; padding:8px 10px 8px 12px; margin-bottom:6px; background:#ffffff; border:1px solid #f4f4f5; overflow:hidden; cursor:pointer; transition: box-shadow .15s, transform .15s; min-height:42px; }
.mm-booking::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-top-left-radius:10px; border-bottom-left-radius:10px; }
.mm-booking:hover { box-shadow:0 2px 4px rgba(0,0,0,.06); transform:translateY(-1px); }
.mm-booking-title { font-size:13px; font-weight:600; color:#18181b; line-height:1.35; }
.mm-booking-time { font-size:12px; color:#71717a; margin-top:2px; }
.mm-booking-initials { position:absolute; top:6px; right:8px; font-size:10px; font-weight:600; color:#52525b; background:#f4f4f5; border-radius:6px; padding:2px 6px; line-height:1; }
.mm-status-dot { width:6px; height:6px; border-radius:9999px; display:inline-block; }
.mm-day-cell-today-pill { width:30px; height:30px; border-radius:9999px; display:inline-flex; align-items:center; justify-content:center; background:#6366f1; color:#ffffff; font-weight:600; }
.mm-day-cell { background:#ffffff; }
.mm-day-cell-weekend { background:#fafafa; }
.mm-day-cell-today { background:#ffffff; box-shadow: inset 0 -2px 0 0 #6366f1; }
.mm-grid-cell { border-right:1px solid #f1f1f4; border-bottom:1px solid #f1f1f4; }
.mm-row-label { background:#ffffff; border-right:1px solid #e4e4e7; border-bottom:1px solid #f1f1f4; }
.mm-fade-in { animation: mm-fade .2s ease-out; }
@keyframes mm-fade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 10h18"/>
      <path d="M8 3v4M16 3v4"/>
    </svg>
  );
}
function IconMyBookings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="17" rx="2"/>
      <path d="M8 10h8M8 14h8M8 18h5"/>
    </svg>
  );
}
function IconTemplates({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}
function IconReports({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21h18"/>
      <path d="M6 17v-5M11 17V8M16 17v-7M21 17V5"/>
    </svg>
  );
}
function IconAssets({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  );
}
function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function NavItem({ icon, label, isActive, badge }: { icon: React.ReactNode; label: string; isActive?: boolean; badge?: string }) {
  return (
    <button className={cn("mm-sidebar-item w-full text-left", isActive && "mm-sidebar-item-active")}>
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {badge && (
        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-zinc-100 text-zinc-600 leading-none">
          {badge}
        </span>
      )}
    </button>
  );
}

function NavSection({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <div className="space-y-1">
      <button className="flex items-center justify-between w-full px-3 py-2 mm-section-title hover:text-zinc-700 transition-colors">
        <span>{title}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && <div className="space-y-0.5 mm-fade-in">{children}</div>}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="w-72 shrink-0 bg-white border-r mm-hairline flex flex-col">
      <div className="flex-shrink-0 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white font-semibold text-sm">
            BS
          </div>
          <h1 className="text-base font-semibold text-zinc-900 tracking-tight">{SITE_NAME}</h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
        <div className="space-y-0.5">
          <NavItem icon={<IconCalendar className="mm-sidebar-icon" />} label="Calendar" isActive />
          <NavItem icon={<IconMyBookings className="mm-sidebar-icon" />} label="My Bookings" />
          <NavItem icon={<IconTemplates className="mm-sidebar-icon" />} label="Templates" />
          <NavItem icon={<IconReports className="mm-sidebar-icon" />} label="Reports" />
          <NavItem icon={<IconAssets className="mm-sidebar-icon" />} label="Assets" badge="Beta" />
          <NavItem icon={<UserPlus className="mm-sidebar-icon" strokeWidth={1.75} />} label="Crew" badge="New" />
        </div>

        <NavSection title="Administration">
          <NavItem icon={<Users className="mm-sidebar-icon" strokeWidth={1.75} />} label="User Management" />
          <NavItem icon={<ClipboardList className="mm-sidebar-icon" strokeWidth={1.75} />} label="Booking Ownership" />
          <NavItem icon={<Database className="mm-sidebar-icon" strokeWidth={1.75} />} label="Database Health" />
        </NavSection>

        <NavSection title="Management">
          <NavItem icon={<UsersRound className="mm-sidebar-icon" strokeWidth={1.75} />} label="Teams" />
          <NavItem icon={<FileCheck2 className="mm-sidebar-icon" strokeWidth={1.75} />} label="Audit Logs" />
        </NavSection>

        <div className="pt-3 border-t mm-hairline">
          <NavItem icon={<IconSettings className="mm-sidebar-icon" />} label="Settings" />
        </div>
      </nav>

      <div className="flex-shrink-0 px-4 py-4 border-t mm-hairline">
        <div className="flex items-center gap-3 px-2">
          <div className="h-9 w-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
            {USER.initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">{USER.name}</p>
            <p className="text-xs text-zinc-500 capitalize">{USER.role}</p>
          </div>
          <button className="mm-icon-btn" title="Sign out">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
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
    <header className="bg-white border-b mm-hairline">
      <div className="flex items-center justify-between px-8 py-5 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button className="mm-icon-btn hidden lg:inline-flex" title="Hide sidebar">
            <Menu className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <div>
            <h2 className="mm-page-heading">May 25 – 31, 2026</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Week 22 · Dallas</p>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button className="mm-icon-btn"><ChevronLeft className="h-4 w-4" strokeWidth={1.75} /></button>
            <button className="mm-icon-btn"><ChevronRight className="h-4 w-4" strokeWidth={1.75} /></button>
          </div>

          <button className="mm-outline-btn hidden md:inline-flex">Today</button>

          <button className="mm-ghost-btn">
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden lg:inline">Studios</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-5 text-xs text-zinc-600">
          <div className="flex items-center gap-1.5">
            <span className="mm-status-dot" style={{ background: "#a1a1aa" }}></span>
            <span>3 Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mm-status-dot" style={{ background: "#52525b" }}></span>
            <span>2 In Use</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mm-status-dot" style={{ background: "#d4d4d8" }}></span>
            <span>1 Maint.</span>
          </div>
          <div className="hidden xl:flex items-center gap-1.5 pl-4 border-l mm-hairline">
            <Sun className="h-4 w-4 text-zinc-500" strokeWidth={1.75} />
            <span className="font-medium">72°F</span>
            <span className="text-zinc-400">Clear</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center bg-zinc-100 rounded-lg p-1">
            {viewOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeView === option.key;
              return (
                <button
                  key={option.key}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                    isActive ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              );
            })}
          </div>
          <button className="mm-icon-btn" title="Toggle theme">
            <Moon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}

function bookingAccent(type: BookingType): { tint: string; bar: string; dot: string } {
  switch (type) {
    case "broadcast":
      return { tint: "rgba(239,68,68,0.08)", bar: "#ef4444", dot: "#ef4444" };
    case "production":
      return { tint: "rgba(99,102,241,0.08)", bar: "#6366f1", dot: "#6366f1" };
    case "rehearsal":
      return { tint: "rgba(168,85,247,0.08)", bar: "#a855f7", dot: "#a855f7" };
    case "maintenance":
      return { tint: "rgba(245,158,11,0.10)", bar: "#f59e0b", dot: "#f59e0b" };
  }
}

function BookingBlock({ booking }: { booking: Booking }) {
  const acc = bookingAccent(booking.type);
  return (
    <div className="mm-booking" style={{ background: acc.tint }}>
      <span aria-hidden style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:acc.bar, borderTopLeftRadius:10, borderBottomLeftRadius:10 }} />
      <div className="flex items-center gap-1.5 pr-12">
        <span className="mm-status-dot" style={{ background: acc.dot }}></span>
        <span className="mm-booking-title truncate">{booking.title}</span>
      </div>
      <div className="mm-booking-time">{booking.start} – {booking.end}</div>
      <span className="mm-booking-initials" title={booking.producerInitials}>{booking.producerInitials}</span>
    </div>
  );
}

function AlertsRow() {
  return (
    <div className="contents">
      <div className="mm-row-label flex items-center sticky left-0 z-20 w-[180px] min-w-[180px] max-w-[180px] overflow-hidden px-5" style={{ height: "92px" }}>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Facility Alerts</span>
      </div>

      {WEEK_DATES.map((d, i) => {
        const hasAlert = i === 5;
        return (
          <div
            key={i}
            className={cn("mm-grid-cell relative cursor-pointer transition-colors hover:bg-zinc-50", d.isWeekend ? "mm-day-cell-weekend" : "mm-day-cell")}
            style={{ height: "92px" }}
          >
            {hasAlert ? (
              <div className="flex flex-col h-full w-full p-2">
                <div className="mm-booking" style={{ background: "rgba(245,158,11,0.10)" }}>
                  <div className="flex items-center gap-1.5 pr-2">
                    <span className="mm-status-dot" style={{ background: "#f59e0b" }}></span>
                    <span className="mm-booking-title truncate">Power maintenance — facility-wide</span>
                  </div>
                  <div className="mm-booking-time">2:00 AM – 4:00 AM</div>
                  <span aria-hidden style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:"#f59e0b", borderTopLeftRadius:10, borderBottomLeftRadius:10 }} />
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
  const baseHeight = 56;
  const heightPerBooking = 56;
  const additional = Math.min(maxPerDay * heightPerBooking, 320);
  const rowHeight = baseHeight + additional;

  const dotColor =
    studio.status === "maintenance" ? "#a1a1aa"
    : studio.status === "in-use" ? "#3f3f46"
    : "#d4d4d8";

  const statusLabel =
    studio.status === "maintenance" ? "Maintenance"
    : studio.status === "in-use" ? "In use"
    : "Available";

  return (
    <div className="contents">
      <div
        className="mm-row-label flex items-center sticky left-0 z-20 w-[180px] min-w-[180px] max-w-[180px] overflow-hidden px-5"
        style={{ height: `${rowHeight}px` }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-semibold text-zinc-900 truncate">{studio.name}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="mm-status-dot" style={{ background: dotColor }}></span>
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
              "mm-grid-cell flex flex-col p-2 cursor-pointer transition-colors hover:bg-zinc-50/60 overflow-y-auto",
              d.isWeekend ? "mm-day-cell-weekend" : "mm-day-cell"
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
    <div className="overflow-auto h-full px-8 pb-8 pt-2">
      <div className="mm-card overflow-hidden min-w-[1000px]">
        <div className="grid grid-cols-[180px_repeat(7,1fr)] sticky top-0 z-30 bg-white border-b mm-hairline">
          <div className="h-24 border-r mm-hairline bg-white"></div>
          {WEEK_DATES.map((d, i) => (
            <div
              key={i}
              className={cn(
                "h-24 border-r mm-hairline text-center flex flex-col items-center justify-center gap-1.5 p-2",
                d.isWeekend ? "mm-day-cell-weekend" : "mm-day-cell",
                d.isToday && "mm-day-cell-today"
              )}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{d.day}</div>
              <div>
                {d.isToday ? (
                  <span className="mm-day-cell-today-pill">{d.date}</span>
                ) : (
                  <span className="text-xl font-semibold text-zinc-900">{d.date}</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1 text-[11px] text-zinc-500">
                {i % 3 === 0 ? (
                  <Sun className="h-3 w-3" strokeWidth={1.75} />
                ) : (
                  <Cloud className="h-3 w-3" strokeWidth={1.75} />
                )}
                <span>{68 + i}°</span>
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="grid grid-cols-[180px_repeat(7,1fr)]">
            <AlertsRow />
            <div className="col-span-8 h-2 bg-zinc-50 border-b mm-hairline"></div>
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
      className="fixed z-40 flex items-center gap-2 rounded-full shadow-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-all bottom-8 right-8 px-5 py-3"
      aria-label="Create new booking"
      style={{ boxShadow: "0 6px 16px rgba(99,102,241,.30)" }}
    >
      <Plus className="h-4 w-4" strokeWidth={2} />
      <span className="font-semibold text-sm">New Booking</span>
    </button>
  );
}

export default function ModernMinimal() {
  return (
    <div className="mm-root min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: MM_STYLES }} />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 bg-zinc-50">
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
