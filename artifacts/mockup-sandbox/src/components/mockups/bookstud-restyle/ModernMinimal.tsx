import React from "react";
import {
  Calendar,
  LayoutDashboard,
  Video,
  BookOpen,
  Users,
  HardDrive,
  LayoutTemplate,
  Settings,
  Search,
  Bell,
  Plus,
  ChevronRight,
  MoreHorizontal,
  Clock,
  Video as VideoIcon,
  User as UserIcon,
} from "lucide-react";

export function ModernMinimal() {
  return (
    <div className="flex h-screen w-full bg-[#FCFCFC] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex-shrink-0 border-r border-slate-200 flex flex-col justify-between bg-white">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <span className="font-semibold tracking-tight text-sm">BookStud.io</span>
          </div>
          <nav className="p-4 space-y-1">
            <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" active />
            <NavItem icon={<Calendar size={16} />} label="Calendar" />
            <NavItem icon={<Video size={16} />} label="Studios" />
            <NavItem icon={<BookOpen size={16} />} label="Bookings" />
            <NavItem icon={<Users size={16} />} label="Crew" />
            <NavItem icon={<HardDrive size={16} />} label="Assets" />
            <NavItem icon={<LayoutTemplate size={16} />} label="Templates" />
          </nav>
        </div>
        <div className="p-4">
          <nav className="space-y-1 mb-4">
            <NavItem icon={<Settings size={16} />} label="Settings" />
          </nav>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-xs font-medium">
              SC
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium leading-none">Sarah Chen</span>
              <span className="text-[10px] text-slate-500 mt-1">Producer</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 flex-shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-8">
          <div className="text-sm font-medium text-slate-600">Thursday, May 28, 2026</div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search bookings, crew..."
                className="pl-8 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 w-64 transition-all"
              />
            </div>
            <button className="relative text-slate-500 hover:text-slate-900 transition-colors">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-slate-900 rounded-full"></span>
            </button>
            <button className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors">
              <Plus size={16} />
              New Booking
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-auto p-8 flex gap-8">
          {/* Left Column (Main) */}
          <div className="flex-1 flex flex-col gap-10 min-w-0">
            {/* Studios Status Grid */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-tight">Studios Status</h2>
                <button className="text-xs font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors">
                  View All <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <StudioCard name="Studio A" status="On-Air" booking="Evening News" until="7:00 PM" next="Tech Talk Live at 8:00 PM" />
                <StudioCard name="Studio B" status="In Use" booking="Weekly Roundtable" until="4:30 PM" next="Available until 6:00 PM" />
                <StudioCard name="Studio C" status="Available" booking="--" until="--" next="Morning News prep at 5:00 AM" />
                <StudioCard name="PCR 1" status="On-Air" booking="Evening News" until="7:00 PM" next="Tech Talk Live at 8:00 PM" />
                <StudioCard name="PCR 2" status="Available" booking="--" until="--" next="Sports Wrap at 9:00 PM" />
                <StudioCard name="Edit Bay" status="Maintenance" booking="Audio Calibration" until="Tomorrow" next="Available Friday 9:00 AM" />
              </div>
            </section>

            {/* Today's Schedule */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-tight">Today's Schedule</h2>
              </div>
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div className="divide-y divide-slate-100">
                  <ScheduleRow time="14:00 - 16:30" title="Weekly Roundtable" studio="Studio B" producer="Marcus Williams" crew={12} status="Confirmed" />
                  <ScheduleRow time="17:00 - 19:00" title="Evening News" studio="Studio A & PCR 1" producer="Sarah Chen" crew={24} status="Confirmed" />
                  <ScheduleRow time="19:30 - 20:30" title="Election Night Special Prep" studio="Studio C" producer="James Okafor" crew={8} status="Tentative" />
                  <ScheduleRow time="20:00 - 21:00" title="Tech Talk Live" studio="Studio A" producer="Priya Patel" crew={14} status="Confirmed" />
                  <ScheduleRow time="21:00 - 22:30" title="Sports Wrap" studio="Studio B & PCR 2" producer="Marcus Williams" crew={18} status="Confirmed" />
                </div>
              </div>
            </section>

            {/* This Week Mini-calendar */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-tight">This Week Overview</h2>
              </div>
              <div className="border border-slate-200 rounded-lg bg-white p-4">
                <div className="grid grid-cols-7 gap-4">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                    <div key={day} className="flex flex-col gap-2">
                      <div className={`text-xs font-medium ${i === 3 ? 'text-slate-900' : 'text-slate-500'} border-b border-slate-100 pb-2 mb-2`}>
                        {day} {25 + i}
                      </div>
                      <CalendarBlock title="Morning News" time="5a-9a" color="bg-slate-100 text-slate-700" />
                      {i === 1 && <CalendarBlock title="Tech Talk Live" time="8p-9p" color="bg-slate-800 text-white" />}
                      {i === 3 && (
                        <>
                          <CalendarBlock title="Weekly Roundtable" time="2p-4p" color="bg-slate-100 text-slate-700" />
                          <CalendarBlock title="Evening News" time="5p-7p" color="bg-slate-800 text-white" />
                        </>
                      )}
                      {i === 5 && <CalendarBlock title="Studio Maintenance" time="All Day" color="bg-slate-50 text-slate-400 border border-slate-200 border-dashed" />}
                      {i === 6 && <CalendarBlock title="Election Night Special" time="6p-12a" color="bg-slate-800 text-white" />}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Rail */}
          <aside className="w-[300px] flex-shrink-0 flex flex-col gap-6">
            <section className="bg-white border border-slate-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold tracking-tight mb-4">Up Next</h2>
              <div className="space-y-5">
                <UpNextItem time="17:00 (In 2h 15m)" title="Evening News" studio="Studio A" type="Live Broadcast" />
                <UpNextItem time="19:30 (In 4h 45m)" title="Election Night Special Prep" studio="Studio C" type="Rehearsal" />
                <UpNextItem time="20:00 (In 5h 15m)" title="Tech Talk Live" studio="Studio A" type="Live Broadcast" />
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <a
      href="#"
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

function StudioCard({ name, status, booking, until, next }: { name: string; status: string; booking: string; until: string; next: string }) {
  const isAvailable = status === "Available";
  const isOnAir = status === "On-Air";
  const isMaintenance = status === "Maintenance";

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold">{name}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnAir ? "bg-red-500" : isMaintenance ? "bg-amber-500" : isAvailable ? "bg-emerald-500" : "bg-slate-400"
            }`}
          ></span>
          <span className="text-xs font-medium text-slate-600">{status}</span>
        </div>
      </div>
      <div className="flex-1">
        {!isAvailable ? (
          <div>
            <div className="text-sm font-medium text-slate-900 truncate">{booking}</div>
            <div className="text-xs text-slate-500 mt-1">Until {until}</div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 italic">No current booking</div>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Next Up</div>
        <div className="text-xs font-medium text-slate-600 truncate">{next}</div>
      </div>
    </div>
  );
}

function ScheduleRow({ time, title, studio, producer, crew, status }: { time: string; title: string; studio: string; producer: string; crew: number; status: string }) {
  return (
    <div className="flex items-center px-4 py-3 hover:bg-slate-50 transition-colors group">
      <div className="w-32 flex-shrink-0 text-xs font-medium text-slate-500 flex items-center gap-2">
        <Clock size={14} className="text-slate-400" />
        {time}
      </div>
      <div className="w-48 flex-shrink-0 pr-4">
        <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
      </div>
      <div className="w-32 flex-shrink-0 text-xs text-slate-600 flex items-center gap-1.5">
        <VideoIcon size={14} className="text-slate-400" />
        <span className="truncate">{studio}</span>
      </div>
      <div className="w-40 flex-shrink-0 text-xs text-slate-600 flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-[9px] font-bold">
          {producer.split(' ').map(n => n[0]).join('')}
        </div>
        <span className="truncate">{producer}</span>
      </div>
      <div className="w-20 flex-shrink-0 text-xs text-slate-500 flex items-center gap-1.5">
        <UserIcon size={14} className="text-slate-400" />
        {crew}
      </div>
      <div className="flex-1 flex justify-end">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'Confirmed' ? 'bg-slate-900' : 'bg-slate-300'}`}></span>
          <span className="text-xs font-medium text-slate-600">{status}</span>
        </div>
      </div>
    </div>
  );
}

function CalendarBlock({ title, time, color }: { title: string; time: string; color: string }) {
  return (
    <div className={`rounded p-2 ${color} text-left`}>
      <div className="text-[10px] font-medium opacity-80 mb-0.5">{time}</div>
      <div className="text-xs font-semibold leading-tight">{title}</div>
    </div>
  );
}

function UpNextItem({ time, title, studio, type }: { time: string; title: string; studio: string; type: string }) {
  return (
    <div className="flex flex-col gap-2 pb-5 border-b border-slate-100 last:border-0 last:pb-0">
      <div className="flex justify-between items-start">
        <div className="text-xs font-semibold text-slate-500 tracking-tight">{time}</div>
        <button className="text-slate-400 hover:text-slate-900">
          <MoreHorizontal size={16} />
        </button>
      </div>
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="text-xs text-slate-600 mt-1">{studio} · {type}</div>
      </div>
      <div className="flex gap-2 mt-2">
        <button className="flex-1 px-2 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors">
          View
        </button>
        <button className="flex-1 px-2 py-1.5 text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition-colors">
          Edit
        </button>
        <button className="flex-1 px-2 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded transition-colors">
          Call Sheet
        </button>
      </div>
    </div>
  );
}
