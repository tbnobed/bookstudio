import { useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking } from "@shared/schema";
import { formatDateTimeRange } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BookingModal from "@/components/booking/BookingModal";
import { useAuth } from "@/hooks/useAuth";
import { format, isToday, isTomorrow, isThisWeek, startOfWeek, endOfWeek, addWeeks, isSameWeek, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  CalendarDays, Clock, MapPin, User, Users, Pencil, ChevronRight,
  CalendarClock, Building2, TrendingUp, Loader2, AlertCircle, CheckCircle2
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  production:  { bg: "bg-blue-500/15 border-blue-500/30",   text: "text-blue-400",   dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400",  dot: "bg-amber-400" },
  it_support:  { bg: "bg-red-500/15 border-red-500/30",     text: "text-red-400",    dot: "bg-red-400" },
  rehearsal:   { bg: "bg-purple-500/15 border-purple-500/30",text: "text-purple-400",dot: "bg-purple-400" },
  meeting:     { bg: "bg-teal-500/15 border-teal-500/30",   text: "text-teal-400",   dot: "bg-teal-400" },
  default:     { bg: "bg-gray-500/15 border-gray-500/30",   text: "text-gray-400",   dot: "bg-gray-400" },
};

const getTypeColor = (type: string) => TYPE_COLORS[type] ?? TYPE_COLORS.default;

const formatType = (type: string) =>
  type.replace("_", " ").split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

function getAccentColor(booking: any): string {
  if (booking.color) return booking.color;
  const map: Record<string, string> = {
    production: "#3b82f6", maintenance: "#f59e0b", it_support: "#ef4444",
    rehearsal: "#a855f7", meeting: "#14b8a6",
  };
  return map[booking.type] ?? "#6b7280";
}

// Group upcoming bookings into labeled date buckets
function groupBookings(bookings: Booking[]) {
  const now = new Date();
  const groups: { label: string; bookings: Booking[] }[] = [];

  const todayItems = bookings.filter(b => isToday(new Date(b.start)));
  const tomorrowItems = bookings.filter(b => isTomorrow(new Date(b.start)));
  const thisWeekItems = bookings.filter(b => {
    const d = new Date(b.start);
    return isThisWeek(d, { weekStartsOn: 0 }) && !isToday(d) && !isTomorrow(d);
  });
  const nextWeekItems = bookings.filter(b => {
    const d = new Date(b.start);
    return isSameWeek(d, addWeeks(now, 1), { weekStartsOn: 0 });
  });
  const laterItems = bookings.filter(b => {
    const d = new Date(b.start);
    return !isToday(d) && !isTomorrow(d) &&
      !isThisWeek(d, { weekStartsOn: 0 }) &&
      !isSameWeek(d, addWeeks(now, 1), { weekStartsOn: 0 });
  });

  if (todayItems.length)    groups.push({ label: "Today",     bookings: todayItems });
  if (tomorrowItems.length) groups.push({ label: "Tomorrow",  bookings: tomorrowItems });
  if (thisWeekItems.length) groups.push({ label: "This Week", bookings: thisWeekItems });
  if (nextWeekItems.length) groups.push({ label: "Next Week", bookings: nextWeekItems });
  if (laterItems.length)    groups.push({ label: "Later",     bookings: laterItems });

  return groups;
}

// ── Booking card ───────────────────────────────────────────────────────────────
function BookingCard({
  booking, getStudioName, getUserName, onEdit, isPast = false, creatorLabel
}: {
  booking: any; getStudioName: (id: number) => string; getUserName: (id: number) => string;
  onEdit: (id: number) => void; isPast?: boolean; creatorLabel?: string;
}) {
  const accent = getAccentColor(booking);
  const tc = getTypeColor(booking.type);
  const isCancelled = booking.status === "cancelled";
  const isTentative = booking.status === "tentative";
  const startDate = new Date(booking.start);

  return (
    <div
      className={cn(
        "group relative flex rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
        "bg-white dark:bg-neutral-800/80 border-gray-200 dark:border-neutral-700",
        isCancelled && "opacity-55",
        isPast && "opacity-70",
      )}
    >
      {/* Left accent bar */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: accent }} />

      {/* Date badge */}
      <div className="flex flex-col items-center justify-center px-3 py-3 border-r border-gray-100 dark:border-neutral-700 min-w-[52px]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {format(startDate, "EEE")}
        </span>
        <span className="text-2xl font-black leading-none text-neutral-800 dark:text-white">
          {format(startDate, "d")}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {format(startDate, "MMM")}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className={cn(
            "font-semibold text-sm text-neutral-900 dark:text-white leading-tight line-clamp-2",
            isCancelled && "line-through text-red-500"
          )}>
            {booking.title}
          </h3>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap",
              tc.bg, tc.text
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", tc.dot)} />
              {formatType(booking.type)}
            </span>
            {isCancelled && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400">
                Cancelled
              </span>
            )}
            {isTentative && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
                Tentative
              </span>
            )}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{formatDateTimeRange(booking.start, booking.end)}</span>
          </div>
          {booking.studioId && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Building2 className="h-3 w-3 shrink-0" />
              <span>{getStudioName(booking.studioId)}</span>
            </div>
          )}
          {creatorLabel && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <User className="h-3 w-3 shrink-0" />
              <span>{creatorLabel}</span>
            </div>
          )}
          {booking.description && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic line-clamp-1 mt-1">
              {booking.description}
            </p>
          )}
        </div>

        <div className="flex justify-end mt-2">
          <button
            onClick={() => onEdit(booking.id)}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 px-4 py-3">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Grouped booking list ───────────────────────────────────────────────────────
function GroupedBookingList({ bookings, getStudioName, getUserName, onEdit, showCreator }: {
  bookings: Booking[]; getStudioName: (id: number) => string; getUserName: (id: number) => string;
  onEdit: (id: number) => void; showCreator?: boolean;
}) {
  const groups = useMemo(() => groupBookings(bookings), [bookings]);

  if (groups.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarDays className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-gray-500 dark:text-gray-400 font-medium">No upcoming bookings</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Your future bookings will appear here</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.label}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-bold text-neutral-700 dark:text-gray-200">{group.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
              {group.bookings.length}
            </span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-700/60" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.bookings.map(b => (
              <BookingCard
                key={b.id}
                booking={b}
                getStudioName={getStudioName}
                getUserName={getUserName}
                onEdit={onEdit}
                creatorLabel={showCreator ? getUserName(b.userId) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Flat booking list (past / admin) ───────────────────────────────────────────
function FlatBookingList({ bookings, getStudioName, getUserName, onEdit, isPast, showCreator }: {
  bookings: Booking[]; getStudioName: (id: number) => string; getUserName: (id: number) => string;
  onEdit: (id: number) => void; isPast?: boolean; showCreator?: boolean;
}) {
  if (bookings.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarDays className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-gray-500 dark:text-gray-400 font-medium">No bookings found</p>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {bookings.map(b => (
        <BookingCard
          key={b.id}
          booking={b}
          getStudioName={getStudioName}
          getUserName={getUserName}
          onEdit={onEdit}
          isPast={isPast}
          creatorLabel={showCreator ? getUserName(b.userId) : undefined}
        />
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function MyBookingsPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [teamCurrentPage, setTeamCurrentPage] = useState(1);
  const [adminUpcomingPage, setAdminUpcomingPage] = useState(1);
  const [adminPastPage, setAdminPastPage] = useState(1);
  const [editBookingId, setEditBookingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "team" | "admin">("personal");
  const [personalSubTab, setPersonalSubTab] = useState<"upcoming" | "past">("upcoming");
  const [adminSubTab, setAdminSubTab] = useState<"upcoming" | "past">("upcoming");
  const ITEMS_PER_PAGE = 50;

  const { data: userBookingsData, isLoading } = useQuery<{ bookings: Booking[]; total: number; hasMore: boolean }>({
    queryKey: ["/api/bookings/user", { fromToday: true, page: currentPage, limit: 50 }],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/user?fromToday=true&page=${currentPage}&limit=50`);
      if (!res.ok) throw new Error("Failed to fetch user bookings");
      return res.json();
    },
    refetchOnWindowFocus: true, staleTime: 30000,
  });

  const { data: teamBookingsData, isLoading: teamLoading } = useQuery<{ bookings: Booking[]; total: number; hasMore: boolean }>({
    queryKey: ["/api/bookings/team", { fromToday: true, page: teamCurrentPage, limit: 50 }],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/team?fromToday=true&page=${teamCurrentPage}&limit=50`);
      if (!res.ok) return { bookings: [], total: 0, hasMore: false };
      return res.json();
    },
    refetchOnWindowFocus: true, staleTime: 30000,
  });

  const isAdminOrSiteManager = user?.role === "admin" || user?.role === "site_manager";

  const { data: allBookingsData, isLoading: allBookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: isAdminOrSiteManager,
    refetchOnWindowFocus: true, staleTime: 30000,
  });

  const { data: studios = [] } = useQuery<Studio[]>({ queryKey: ["/api/studios"] });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users/names"],
    queryFn: async () => {
      const res = await fetch("/api/users/names");
      if (!res.ok) throw new Error("Failed to fetch user names");
      return res.json();
    },
  });

  const getStudioName = (id: number) => studios.find(s => s.id === id)?.name ?? `Studio ${id}`;
  const getUserName   = (id: number) => (allUsers as any[]).find(u => u.id === id)?.name ?? `User ${id}`;

  const userBookings    = userBookingsData?.bookings ?? [];
  const totalBookings   = userBookingsData?.total ?? 0;
  const allBookings     = allBookingsData ?? [];
  const now             = new Date();

  const upcomingBookings = userBookings.filter(b => new Date(b.end) >= now);
  const pastBookings     = userBookings.filter(b => new Date(b.end) < now);

  const allUpcoming = allBookings.filter(b => new Date(b.end) >= now);
  const allPast     = allBookings.filter(b => new Date(b.end) < now);

  const upcomingAllPaged = allUpcoming.slice((adminUpcomingPage - 1) * ITEMS_PER_PAGE, adminUpcomingPage * ITEMS_PER_PAGE);
  const pastAllPaged     = allPast.slice((adminPastPage - 1) * ITEMS_PER_PAGE, adminPastPage * ITEMS_PER_PAGE);
  const totalUpcomingPages = Math.ceil(allUpcoming.length / ITEMS_PER_PAGE);
  const totalPastPages     = Math.ceil(allPast.length / ITEMS_PER_PAGE);

  // Next booking info
  const nextBooking = upcomingBookings[0];
  const thisWeekCount = upcomingBookings.filter(b => isThisWeek(new Date(b.start), { weekStartsOn: 0 })).length;

  const bookingToEdit = (() => {
    if (!editBookingId) return undefined;
    return userBookings.find(b => b.id === editBookingId)
      ?? (teamBookingsData?.bookings ?? []).find(b => b.id === editBookingId)
      ?? allBookings.find(b => b.id === editBookingId);
  })();

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs = [
    { key: "personal" as const, label: "My Bookings", count: totalBookings },
    { key: "team"     as const, label: "Team Bookings", count: teamBookingsData?.total ?? 0 },
    ...(isAdminOrSiteManager ? [{ key: "admin" as const, label: "All Bookings", count: allBookings.length }] : []),
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-black">
      <Header
        currentDate={new Date()} onDateChange={() => {}} view="week" onViewChange={() => {}}
        title="My Bookings" showViewToggle={false} hideNavigation={true}
      />

      <div className="flex-1 overflow-auto w-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 pb-16 space-y-6">

        {/* ── Page title + stats ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">My Bookings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Your studio schedule"}
            </p>
          </div>

          {/* Stats row */}
          {activeTab === "personal" && !isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={CalendarClock}
                label="Upcoming"
                value={upcomingBookings.length}
                color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              />
              <StatCard
                icon={TrendingUp}
                label="This Week"
                value={thisWeekCount}
                color="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
              />
              {nextBooking ? (
                <StatCard
                  icon={CheckCircle2}
                  label="Next booking"
                  value={isToday(new Date(nextBooking.start)) ? "Today" : isTomorrow(new Date(nextBooking.start)) ? "Tomorrow" : format(new Date(nextBooking.start), "EEE, MMM d")}
                  color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                />
              ) : (
                <StatCard
                  icon={CalendarDays}
                  label="Past bookings"
                  value={pastBookings.length}
                  color="bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400"
                />
              )}
            </div>
          )}
        </div>

        {/* ── Main tabs ─────────────────────────────────────────────────── */}
        <div className="border-b border-gray-200 dark:border-neutral-700">
          <nav className="flex gap-1 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-gray-300 hover:border-gray-300"
                )}
              >
                {tab.label}
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                  activeTab === tab.key
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── Personal tab ──────────────────────────────────────────────── */}
        {activeTab === "personal" && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-2">
              {(["upcoming", "past"] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => setPersonalSubTab(sub)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                    personalSubTab === sub
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                      : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
                  )}
                >
                  {sub.charAt(0).toUpperCase() + sub.slice(1)}
                  <span className="ml-1.5 text-xs opacity-70">
                    {sub === "upcoming" ? upcomingBookings.length : pastBookings.length}
                  </span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : personalSubTab === "upcoming" ? (
              <GroupedBookingList
                bookings={upcomingBookings}
                getStudioName={getStudioName}
                getUserName={getUserName}
                onEdit={setEditBookingId}
              />
            ) : (
              <FlatBookingList
                bookings={pastBookings}
                getStudioName={getStudioName}
                getUserName={getUserName}
                onEdit={setEditBookingId}
                isPast
              />
            )}
          </div>
        )}

        {/* ── Team tab ──────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div>
            {teamLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (teamBookingsData?.bookings ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No team bookings</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Join a team to see your teammates' bookings here
                </p>
              </div>
            ) : (
              <GroupedBookingList
                bookings={teamBookingsData?.bookings ?? []}
                getStudioName={getStudioName}
                getUserName={getUserName}
                onEdit={setEditBookingId}
                showCreator
              />
            )}
          </div>
        )}

        {/* ── Admin tab ─────────────────────────────────────────────────── */}
        {activeTab === "admin" && isAdminOrSiteManager && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(["upcoming", "past"] as const).map(sub => (
                  <button
                    key={sub}
                    onClick={() => setAdminSubTab(sub)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                      adminSubTab === sub
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                        : "bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700"
                    )}
                  >
                    {sub.charAt(0).toUpperCase() + sub.slice(1)}
                    <span className="ml-1.5 text-xs opacity-70">
                      {sub === "upcoming" ? allUpcoming.length : allPast.length}
                    </span>
                  </button>
                ))}
              </div>
              {/* Pagination info */}
              {adminSubTab === "upcoming" && totalUpcomingPages > 1 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Page {adminUpcomingPage} of {totalUpcomingPages}</span>
                  <button disabled={adminUpcomingPage <= 1} onClick={() => setAdminUpcomingPage(p => p - 1)}
                    className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">←</button>
                  <button disabled={adminUpcomingPage >= totalUpcomingPages} onClick={() => setAdminUpcomingPage(p => p + 1)}
                    className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">→</button>
                </div>
              )}
              {adminSubTab === "past" && totalPastPages > 1 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Page {adminPastPage} of {totalPastPages}</span>
                  <button disabled={adminPastPage <= 1} onClick={() => setAdminPastPage(p => p - 1)}
                    className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">←</button>
                  <button disabled={adminPastPage >= totalPastPages} onClick={() => setAdminPastPage(p => p + 1)}
                    className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">→</button>
                </div>
              )}
            </div>

            {allBookingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : adminSubTab === "upcoming" ? (
              <FlatBookingList
                bookings={upcomingAllPaged}
                getStudioName={getStudioName}
                getUserName={getUserName}
                onEdit={setEditBookingId}
                showCreator
              />
            ) : (
              <FlatBookingList
                bookings={pastAllPaged}
                getStudioName={getStudioName}
                getUserName={getUserName}
                onEdit={setEditBookingId}
                isPast showCreator
              />
            )}
          </div>
        )}
      </div>

      {/* Booking edit modal */}
      {editBookingId && bookingToEdit && (
        <BookingModal
          isOpen={!!editBookingId}
          onClose={() => setEditBookingId(null)}
          booking={bookingToEdit}
          studios={studios}
          onSave={() => setEditBookingId(null)}
        />
      )}
    </div>
  );
}
