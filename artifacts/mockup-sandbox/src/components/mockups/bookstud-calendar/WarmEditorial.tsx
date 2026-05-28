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

const WARM_STYLES = `
.we-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #2b1d12; background: #faf7f2; }
.we-serif { font-family: Georgia, 'Playfair Display', 'Times New Roman', serif; }
.we-italic { font-family: Georgia, 'Playfair Display', serif; font-style: italic; }
.we-small-caps { font-variant: small-caps; letter-spacing: 0.12em; }
.we-tabular { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }

.we-sidebar { background: linear-gradient(180deg, #fbf6ec 0%, #f6efe0 100%); border-right: 1px solid #e8e2d6; }
.we-sidebar-logo { background: linear-gradient(135deg, #9f1239 0%, #6b0f2a 100%); color: #fbf6ec; box-shadow: 0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 14px rgba(159,18,57,0.25); }
.we-divider { height: 1px; background: linear-gradient(90deg, transparent 0%, #c9b896 50%, transparent 100%); margin: 8px 4px; }
.we-divider::before, .we-divider::after { content: ""; }

.we-nav-item { display:flex; align-items:center; gap:.75rem; padding:.55rem .75rem; font-size:.8125rem; border-radius:.375rem; color:#5a4a36; transition:all .15s; position:relative; }
.we-nav-item:hover { background:#f1e8d6; color:#3a2a18; }
.we-nav-item-active { color:#9f1239; background:#fdf3e8; font-weight:600; }
.we-nav-item-active::before { content:""; position:absolute; left:6px; right:6px; bottom:2px; height:2px; background:#9f1239; border-radius:1px; }
.we-section-label { font-family: Georgia, serif; font-size:.7rem; color:#8a7456; font-variant: small-caps; letter-spacing:.18em; padding:.5rem .75rem; display:flex; align-items:center; justify-content:space-between; width:100%; }

.we-header { background: #fffdf8; border-bottom: 1px solid #9f1239; box-shadow: 0 1px 0 #e8e2d6; }
.we-rule-thin { border-bottom: 1px solid #e8e2d6; }
.we-date-display { font-family: Georgia, 'Playfair Display', serif; font-size: 1rem; color: #2b1d12; letter-spacing: 0.01em; }
.we-week-label { font-family: Georgia, serif; font-style: italic; color: #8a6a3d; }

.we-btn-ghost { background:#fffdf8; border:1px solid #e8e2d6; color:#5a4a36; border-radius:.375rem; transition:all .15s; }
.we-btn-ghost:hover { background:#f6efe0; border-color:#c9b896; color:#2b1d12; }
.we-iconbtn { background:#fffdf8; border:1px solid #e8e2d6; transition:all .15s; }
.we-iconbtn:hover { background:#f6efe0; border-color:#c9b896; }

.we-view-toggle { background:#f6efe0; border:1px solid #e8e2d6; border-radius:.5rem; padding:3px; }
.we-view-btn-active { background:#fffdf8; color:#9f1239; box-shadow: 0 1px 2px rgba(60,30,10,0.08); border-radius:.375rem; }
.we-view-btn-inactive { color:#8a7456; }
.we-view-btn-inactive:hover { color:#3a2a18; }

.we-pill { display:inline-flex; align-items:center; gap:.4rem; padding:.25rem .65rem; border-radius:9999px; background:#fffdf8; border:1px solid #e8e2d6; font-size:.7rem; color:#5a4a36; }
.we-pill-num { font-family: Georgia, serif; font-weight:600; color:#2b1d12; font-variant-numeric: tabular-nums; }

.we-grid-cell { border-bottom: 1px solid #e8e2d6; border-right: 1px solid #e8e2d6; }
.we-row-label { background: linear-gradient(90deg, #faf7f2 0%, #fffdf8 100%); border-bottom:1px solid #e8e2d6; border-right:1px solid #d9cdb4; }
.we-day-cell { background: linear-gradient(180deg, #fffdf8 0%, #faf7f2 100%); border-bottom:1px solid #e8e2d6; border-right:1px solid #ece4d3; transition: background .15s; }
.we-day-cell:hover { background: #f6efe0; }
.we-day-weekend { background: linear-gradient(180deg, #f6efe0 0%, #efe6d2 100%); }
.we-day-today { background: linear-gradient(180deg, #fef3e2 0%, #fce6c4 100%); border-right:1px solid #d97706; border-bottom:1px solid #d97706; }

.we-day-header { background:#fffdf8; border-bottom:1px solid #e8e2d6; }
.we-day-header-weekend { background:#f6efe0; }
.we-day-header-today { background: linear-gradient(180deg, #fef3e2 0%, #fce6c4 100%); border-bottom: 2px solid #d97706; }
.we-today-pill { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9999px; background:#9f1239; color:#fbf6ec; font-family: Georgia, serif; font-weight:600; box-shadow: 0 2px 8px rgba(159,18,57,0.3); }
.we-day-num { font-family: Georgia, 'Playfair Display', serif; font-size:1.25rem; color:#2b1d12; }

.we-separator-band { background: repeating-linear-gradient(45deg, #e8e2d6 0 6px, #d9cdb4 6px 12px); height: 6px; border-top:1px solid #c9b896; border-bottom:1px solid #c9b896; }

.we-booking { border-radius: 6px; padding: 6px 8px; margin-bottom: 4px; font-size: 11px; cursor:pointer; position:relative; overflow:hidden; color:#451a03; transition: all .2s ease-out; border:1px solid; }
.we-booking:hover { transform: translateY(-1px); box-shadow: 0 6px 14px -4px rgba(60,30,10,0.18); }
.we-booking::before { content:""; position:absolute; top:0; left:0; right:0; height:2px; }
.we-book-broadcast { background:#fbe4e6; border-color:#f1c6cc; }
.we-book-broadcast::before { background:#9f1239; }
.we-book-production { background:#e3ecf2; border-color:#c5d7e2; }
.we-book-production::before { background:#3b6b8e; }
.we-book-rehearsal { background:#e6ecdf; border-color:#cad7bf; }
.we-book-rehearsal::before { background:#5a7a3d; }
.we-book-maintenance { background:#f5e8d3; border-color:#e5d3b1; }
.we-book-maintenance::before { background:#d97706; }
.we-book-title { font-weight: 600; font-family: 'Inter', sans-serif; color:#451a03; }
.we-book-time { font-family: Georgia, serif; font-size: 10.5px; color: #6b3a10; font-style: italic; font-variant-numeric: tabular-nums; margin-top:1px; }
.we-book-initials { position:absolute; top:4px; right:5px; font-size:9px; font-family: Georgia, serif; font-weight:700; color:#451a03; background:#fffdf8; border:1px solid rgba(69,26,3,0.15); padding: 1px 5px; border-radius:9999px; line-height:1.1; }

.we-alert { background:#fdf0d8; border:1px solid #d97706; border-radius:6px; padding:8px 10px; color:#451a03; box-shadow: 0 2px 6px -2px rgba(217,119,6,0.25); position:relative; }
.we-alert::before { content:""; position:absolute; top:0; left:0; right:0; height:2px; background:#d97706; border-radius:6px 6px 0 0; }
.we-alerts-label { background: linear-gradient(90deg, #faf7f2 0%, #fffdf8 100%); border-bottom:1px solid #e8e2d6; border-right:1px solid #d9cdb4; }

.we-fab { background: linear-gradient(135deg, #9f1239 0%, #d97706 100%); color:#fffdf8; border:1px solid rgba(255,253,248,0.3); box-shadow: 0 10px 25px -5px rgba(159,18,57,0.45), 0 6px 12px -4px rgba(217,119,6,0.3); transition: all .25s; }
.we-fab:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 14px 32px -6px rgba(159,18,57,0.55), 0 8px 16px -4px rgba(217,119,6,0.4); }

.we-status-dot-in-use { background:#9f1239; box-shadow: 0 0 0 2px #fbe4e6; }
.we-status-dot-available { background:#5a7a3d; box-shadow: 0 0 0 2px #e6ecdf; }
.we-status-dot-maintenance { background:#d97706; box-shadow: 0 0 0 2px #f5e8d3; }

@keyframes weFade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
.we-animate-fade { animation: weFade .2s ease-out; }
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
      <circle cx="18.5" cy="7.5" r="1.6" fill="#9f1239" stroke="none"/>
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
        "we-nav-item w-full text-left",
        isActive && "we-nav-item-active"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate we-small-caps">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide" style={{ background:'#fdf0d8', color:'#9a5b08', border:'1px solid #e5c997', fontFamily:'Georgia, serif', fontVariant:'small-caps' }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function NavSection({
  title,
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
      <button className="we-section-label">
        <span>{title}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")} style={{ color:'#8a7456' }} />
      </button>
      {open && <div className="space-y-0.5 we-animate-fade">{children}</div>}
    </div>
  );
}

function Sidebar() {
  const iconSize = "h-[18px] w-[18px]";
  return (
    <aside className="we-sidebar w-72 shrink-0 flex flex-col">
      <div className="flex-shrink-0 p-6">
        <div className="flex flex-col items-center">
          <div className="we-sidebar-logo h-16 w-16 rounded-xl flex items-center justify-center text-2xl we-serif" style={{ fontWeight: 600 }}>
            BS
          </div>
          <h1 className="we-serif mt-3 text-xl" style={{ color: '#2b1d12', fontWeight: 600, letterSpacing: '0.01em' }}>{SITE_NAME}</h1>
          <div className="we-italic text-[11px] mt-1" style={{ color: '#8a6a3d' }}>since · twenty twenty-four</div>
        </div>
      </div>

      <div className="we-divider" />

      <nav className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="space-y-0.5">
          <NavItem icon={<IconCalendar className={iconSize} />} label="Calendar" isActive />
          <NavItem icon={<IconMyBookings className={iconSize} />} label="My Bookings" />
          <NavItem icon={<IconTemplates className={iconSize} />} label="Templates" />
          <NavItem icon={<IconReports className={iconSize} />} label="Reports" />
          <NavItem icon={<IconAssets className={iconSize} />} label="Assets" badge="Beta" />
          <NavItem icon={<UserPlus className={iconSize} />} label="Crew" badge="New" />
        </div>

        <div className="we-divider" />

        <NavSection title="Administration">
          <NavItem icon={<Users className={iconSize} />} label="User Management" />
          <NavItem icon={<ClipboardList className={iconSize} />} label="Booking Ownership" />
          <NavItem icon={<Database className={iconSize} />} label="Database Health" />
        </NavSection>

        <div className="we-divider" />

        <NavSection title="Management">
          <NavItem icon={<UsersRound className={iconSize} />} label="Teams" />
          <NavItem icon={<FileCheck2 className={iconSize} />} label="Audit Logs" />
        </NavSection>

        <div className="we-divider" />

        <div className="pt-1">
          <NavItem icon={<IconSettings className={iconSize} />} label="Settings" />
        </div>
      </nav>

      <div className="flex-shrink-0 p-4" style={{ borderTop: '1px solid #e8e2d6', background: '#f1e8d6' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center we-serif text-base" style={{ background: '#9f1239', color: '#fbf6ec', fontWeight: 600, boxShadow: '0 2px 6px rgba(159,18,57,0.3)' }}>
            {USER.initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="we-serif text-sm truncate" style={{ color: '#2b1d12', fontWeight: 600 }}>{USER.name}</p>
            <p className="we-italic text-xs" style={{ color: '#8a6a3d' }}>{USER.role}</p>
          </div>
          <button className="p-2 rounded-md transition-colors" style={{ color: '#8a7456' }} title="Sign out">
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
    <header className="we-header">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 lg:px-6 min-h-[76px] gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="we-iconbtn hidden lg:flex shrink-0 items-center justify-center h-9 w-9 rounded-md"
            title="Hide sidebar"
          >
            <Menu className="h-4 w-4" style={{ color: '#5a4a36' }} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center rounded-md shrink-0" style={{ background:'#fffdf8', border:'1px solid #e8e2d6' }}>
              <button className="p-2 rounded-l-md transition-colors hover:bg-[#f6efe0]">
                <ChevronLeft className="h-4 w-4" style={{ color: '#9f1239' }} />
              </button>
              <button className="px-4 py-1.5 min-w-[140px] lg:min-w-[210px] text-center transition-colors hover:bg-[#f6efe0] flex flex-col items-center justify-center" style={{ borderLeft:'1px solid #e8e2d6', borderRight:'1px solid #e8e2d6' }}>
                <span className="we-date-display">May 25 – 31, 2026</span>
                <span className="we-week-label text-[10px] mt-0.5">week twenty-two</span>
              </button>
              <button className="p-2 rounded-r-md transition-colors hover:bg-[#f6efe0]">
                <ChevronRight className="h-4 w-4" style={{ color: '#9f1239' }} />
              </button>
            </div>

            <button className="we-btn-ghost hidden md:inline-flex items-center justify-center text-sm h-9 px-4 we-small-caps shrink-0" style={{ fontFamily: 'Georgia, serif' }}>
              Today
            </button>

            <button className="we-btn-ghost inline-flex items-center justify-center text-sm h-9 px-3 gap-1.5 shrink-0">
              <Filter className="h-4 w-4" />
              <span className="hidden lg:inline we-small-caps" style={{ fontFamily: 'Georgia, serif' }}>Studios</span>
            </button>
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <span className="we-pill"><span className="w-2 h-2 rounded-full we-status-dot-available"></span><span className="we-pill-num">3</span><span className="we-small-caps" style={{ fontFamily:'Georgia, serif' }}>Avail</span></span>
            <span className="we-pill"><span className="w-2 h-2 rounded-full we-status-dot-in-use"></span><span className="we-pill-num">2</span><span className="we-small-caps" style={{ fontFamily:'Georgia, serif' }}>In Use</span></span>
            <span className="we-pill"><span className="w-2 h-2 rounded-full we-status-dot-maintenance"></span><span className="we-pill-num">1</span><span className="we-small-caps" style={{ fontFamily:'Georgia, serif' }}>Maint</span></span>
          </div>
          <div className="hidden xl:flex items-center gap-2 text-xs" style={{ color: '#8a6a3d' }}>
            <Sun className="h-4 w-4" style={{ color: '#d97706' }} />
            <span className="we-pill-num">72°F</span>
            <span className="we-italic">Clear, Dallas</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 lg:gap-3">
          <div className="we-view-toggle hidden lg:flex items-center">
            {viewOptions.map((option) => {
              const Icon = option.icon;
              const isActive = activeView === option.key;
              return (
                <button
                  key={option.key}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 text-xs transition-all we-small-caps",
                    isActive ? "we-view-btn-active" : "we-view-btn-inactive"
                  )}
                  style={{ fontFamily: 'Georgia, serif', fontWeight: isActive ? 600 : 500 }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">{option.label}</span>
                </button>
              );
            })}
          </div>

          <button className="we-iconbtn h-9 w-9 rounded-md flex items-center justify-center" title="Toggle theme">
            <Moon className="h-4 w-4" style={{ color: '#5a4a36' }} />
          </button>
        </div>
      </div>
    </header>
  );
}

function bookingTypeClass(type: BookingType): string {
  switch (type) {
    case "broadcast": return "we-book-broadcast";
    case "production": return "we-book-production";
    case "rehearsal": return "we-book-rehearsal";
    case "maintenance": return "we-book-maintenance";
  }
}

function BookingBlock({ booking }: { booking: Booking }) {
  return (
    <div
      className={cn("we-booking", bookingTypeClass(booking.type))}
      style={{ minHeight: "40px" }}
    >
      <div className="flex items-center w-full">
        <span className="we-book-title inline-block w-full overflow-hidden text-ellipsis whitespace-nowrap pr-7">
          {booking.title}
        </span>
        <span className="we-book-initials" title={booking.producerInitials}>
          {booking.producerInitials}
        </span>
      </div>
      <div className="we-book-time whitespace-nowrap">
        {booking.start} – {booking.end}
      </div>
    </div>
  );
}

function AlertsRow() {
  return (
    <div className="contents">
      <div
        className="we-alerts-label flex items-center sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden"
        style={{ height: "92px" }}
      >
        <div className="text-center w-full px-2">
          <span className="we-serif we-small-caps text-xs" style={{ color: '#9f1239', fontWeight: 600 }}>Facility Alerts</span>
          <div className="we-italic text-[10px] mt-0.5" style={{ color: '#8a6a3d' }}>this week</div>
        </div>
      </div>

      {WEEK_DATES.map((d, i) => {
        const hasAlert = i === 5;
        return (
          <div
            key={i}
            className={cn(
              "we-day-cell relative cursor-pointer",
              d.isWeekend && "we-day-weekend"
            )}
            style={{ height: "92px" }}
          >
            {hasAlert ? (
              <div className="flex flex-col h-full w-full p-1.5 overflow-y-auto">
                <div className="we-alert">
                  <div className="flex items-center w-full">
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0" style={{ background:'#d97706' }}></span>
                    <span className="we-book-title text-[11px] inline-block w-full overflow-hidden text-ellipsis">
                      Power maintenance — facility-wide
                    </span>
                  </div>
                  <div className="we-book-time pl-3">2:00 AM – 4:00 AM</div>
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
  const baseHeight = 44;
  const heightPerBooking = 34;
  const additional = Math.min(maxPerDay * heightPerBooking, 320);
  const rowHeight = baseHeight + additional;

  const statusClass =
    studio.status === "maintenance"
      ? "we-status-dot-maintenance"
      : studio.status === "in-use"
      ? "we-status-dot-in-use"
      : "we-status-dot-available";

  return (
    <div className="contents">
      <div
        className="we-row-label flex items-center px-4 sticky left-0 z-20 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden"
        style={{ height: `${rowHeight}px` }}
      >
        <div className={cn("w-2 h-2 rounded-full mr-2.5 flex-shrink-0", statusClass)}></div>
        <span className="we-serif text-sm truncate flex-1 min-w-0" style={{ color: '#2b1d12', fontWeight: 600 }}>
          {studio.name}
        </span>
      </div>

      {WEEK_DATES.map((d, i) => {
        const dayBookings = studioBookings.filter((b) => b.dayIndex === i);
        return (
          <div
            key={i}
            className={cn(
              "we-day-cell flex flex-col p-1.5 cursor-pointer overflow-y-auto",
              d.isWeekend && "we-day-weekend",
              d.isToday && "we-day-today"
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
    <div className="overflow-auto h-full" style={{ background: '#faf7f2' }}>
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-[160px_repeat(7,1fr)] sticky top-0 z-30">
          <div className="h-24 we-row-label" style={{ borderBottom: '2px solid #9f1239' }}>
            <div className="h-full flex flex-col items-center justify-center px-2">
              <span className="we-italic text-[11px]" style={{ color: '#8a6a3d' }}>spring · vol. xxvi</span>
              <span className="we-serif text-xs we-small-caps mt-1" style={{ color: '#9f1239', fontWeight: 600 }}>Studios</span>
            </div>
          </div>
          {WEEK_DATES.map((d, i) => (
            <div
              key={i}
              className={cn(
                "h-24 text-center flex flex-col items-center justify-center p-1 we-day-header",
                d.isWeekend && "we-day-header-weekend",
                d.isToday && "we-day-header-today"
              )}
              style={{ borderRight: '1px solid #ece4d3' }}
            >
              <div className="we-small-caps text-[11px] we-serif" style={{ color: d.isToday ? '#9a5b08' : '#8a6a3d', fontWeight: 600 }}>{d.day}</div>
              <div className="my-0.5">
                {d.isToday ? (
                  <div className="we-today-pill we-tabular">{d.date}</div>
                ) : (
                  <div className="we-day-num we-tabular">{d.date}</div>
                )}
              </div>
              <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5" style={{ color: '#8a6a3d' }}>
                {i % 3 === 0 ? (
                  <Sun className="h-3 w-3" style={{ color: '#d97706' }} />
                ) : (
                  <Cloud className="h-3 w-3" style={{ color: '#7a93a8' }} />
                )}
                <span className="we-tabular we-serif" style={{ fontWeight: 600 }}>{68 + i}°</span>
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <div className="grid grid-cols-[160px_repeat(7,1fr)]">
            <AlertsRow />
            <div className="col-span-8 we-separator-band"></div>
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
      className={cn(
        "we-fab fixed z-40 flex items-center gap-2 rounded-full",
        "bottom-8 right-8 px-6 py-3.5"
      )}
      aria-label="Create new booking"
    >
      <Plus className="flex-shrink-0 h-5 w-5" />
      <span className="we-serif text-sm whitespace-nowrap" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>New Booking</span>
    </button>
  );
}

export default function WarmEditorial() {
  return (
    <div className="we-root min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: WARM_STYLES }} />
      <div className="flex h-screen" style={{ background: '#faf7f2' }}>
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
