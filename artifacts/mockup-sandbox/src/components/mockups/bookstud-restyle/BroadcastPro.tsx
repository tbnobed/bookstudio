import React from "react";
import { 
  Bell, 
  Search, 
  Calendar, 
  LayoutDashboard, 
  Video, 
  BookOpen, 
  Users, 
  Package, 
  LayoutTemplate, 
  Settings,
  Plus,
  Eye,
  Edit2,
  FileText,
  Clock,
  MapPin,
  User,
  Radio
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BroadcastPro() {
  return (
    <div className="flex h-screen w-full bg-[#0a0c10] text-[#e2e8f0] font-sans selection:bg-[#2563eb] selection:text-white overflow-hidden">
      <style dangerouslySetInlineStyle={{__html: `
        :root {
          --broadcast-bg: #0a0c10;
          --broadcast-panel: #11151c;
          --broadcast-border: #2dd4bf20;
          --broadcast-accent: #2dd4bf;
          --broadcast-alert: #ef4444;
          --broadcast-warn: #eab308;
          --broadcast-text: #e2e8f0;
          --broadcast-muted: #94a3b8;
        }
      `}} />
      
      {/* Sidebar */}
      <aside className="w-[220px] bg-[var(--broadcast-panel)] border-r border-[var(--broadcast-border)] flex flex-col shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-[var(--broadcast-border)]">
          <div className="flex items-center gap-2 text-[var(--broadcast-accent)] font-bold text-lg tracking-tight">
            <Radio className="w-5 h-5" />
            BookStud.io
          </div>
        </div>

        <div className="p-4 border-b border-[var(--broadcast-border)] flex items-center gap-3">
          <Avatar className="w-9 h-9 rounded-none border border-[var(--broadcast-border)]">
            <AvatarFallback className="bg-[#1e293b] text-xs font-mono rounded-none">SC</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Sarah Chen</span>
            <span className="text-xs text-[var(--broadcast-muted)]">Producer</span>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <NavItem icon={<Calendar size={18} />} label="Calendar" />
          <NavItem icon={<Video size={18} />} label="Studios" />
          <NavItem icon={<BookOpen size={18} />} label="Bookings" />
          <NavItem icon={<Users size={18} />} label="Crew" />
          <NavItem icon={<Package size={18} />} label="Assets" />
          <NavItem icon={<LayoutTemplate size={18} />} label="Templates" />
          <NavItem icon={<Settings size={18} />} label="Settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-[var(--broadcast-panel)] border-b border-[var(--broadcast-border)] flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-6">
            <div className="font-mono text-sm tracking-wider text-[var(--broadcast-muted)]">
              THU MAY 28 2026 // <span className="text-white">14:42:05</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--broadcast-muted)]" />
              <input 
                type="text" 
                placeholder="SEARCH /" 
                className="w-full h-8 bg-[#1e293b] border-none text-sm text-white font-mono placeholder:text-[var(--broadcast-muted)] pl-8 pr-3 rounded-none focus:outline-none focus:ring-1 focus:ring-[var(--broadcast-accent)]"
              />
            </div>
            
            <button className="relative p-2 text-[var(--broadcast-muted)] hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--broadcast-alert)] rounded-full border border-[var(--broadcast-panel)]"></span>
            </button>
            
            <button className="h-8 px-4 bg-[var(--broadcast-accent)] hover:bg-teal-300 text-black font-semibold text-sm rounded-none flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" />
              NEW BOOKING
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Studios Grid */}
          <section>
            <h2 className="text-xs font-mono font-bold text-[var(--broadcast-muted)] mb-3 tracking-widest uppercase">Studio Status</h2>
            <div className="grid grid-cols-3 gap-4">
              <StudioCard name="Studio A" status="ON-AIR" show="Evening News" time="UNTIL 19:00" next="Election Special @ 20:00" />
              <StudioCard name="Studio B" status="IN USE" show="Tech Talk Live" time="UNTIL 16:00" next="Sports Wrap @ 16:30" />
              <StudioCard name="Studio C" status="AVAILABLE" show="—" time="—" next="Weekly Roundtable @ 18:00" />
              <StudioCard name="PCR 1" status="ON-AIR" show="Evening News" time="UNTIL 19:00" next="Election Special @ 20:00" />
              <StudioCard name="PCR 2" status="MAINTENANCE" show="Audio Routing Upgrade" time="UNTIL 18:00" next="Available @ 18:00" />
              <StudioCard name="Edit Bay" status="IN USE" show="Sports Wrap Promo" time="UNTIL 15:00" next="Available @ 15:00" />
            </div>
          </section>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              {/* Today's Schedule */}
              <section>
                <h2 className="text-xs font-mono font-bold text-[var(--broadcast-muted)] mb-3 tracking-widest uppercase">Today's Rundown</h2>
                <div className="bg-[var(--broadcast-panel)] border border-[var(--broadcast-border)]">
                  <table className="w-full text-sm">
                    <thead className="border-b border-[var(--broadcast-border)] bg-[#1e293b] font-mono text-[10px] text-[var(--broadcast-muted)]">
                      <tr>
                        <th className="py-2 px-4 text-left font-normal">TIME</th>
                        <th className="py-2 px-4 text-left font-normal">PROGRAM</th>
                        <th className="py-2 px-4 text-left font-normal">STUDIO</th>
                        <th className="py-2 px-4 text-left font-normal">PRODUCER</th>
                        <th className="py-2 px-4 text-left font-normal">CREW</th>
                        <th className="py-2 px-4 text-right font-normal">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--broadcast-border)]">
                      <ScheduleRow time="14:00 - 16:00" show="Tech Talk Live" studio="Studio B" prod="Marcus Williams" crew={12} status="CONFIRMED" />
                      <ScheduleRow time="16:30 - 17:30" show="Sports Wrap" studio="Studio B" prod="James Okafor" crew={8} status="CONFIRMED" />
                      <ScheduleRow time="18:00 - 19:00" show="Evening News" studio="Studio A" prod="Sarah Chen" crew={24} status="ON-AIR" highlight />
                      <ScheduleRow time="18:00 - 19:30" show="Weekly Roundtable" studio="Studio C" prod="Priya Patel" crew={10} status="TENTATIVE" />
                      <ScheduleRow time="20:00 - 23:00" show="Election Night Special" studio="Studio A" prod="Sarah Chen" crew={45} status="CONFIRMED" />
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Week Calendar */}
              <section>
                <h2 className="text-xs font-mono font-bold text-[var(--broadcast-muted)] mb-3 tracking-widest uppercase">Week Outlook</h2>
                <div className="bg-[var(--broadcast-panel)] border border-[var(--broadcast-border)] p-4">
                  <div className="grid grid-cols-7 gap-2">
                    {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                      <div key={day} className="flex flex-col">
                        <div className={`text-[10px] font-mono mb-2 ${i === 3 ? 'text-[var(--broadcast-accent)] font-bold' : 'text-[var(--broadcast-muted)]'}`}>{day}</div>
                        <div className="space-y-1">
                          {i === 3 && ( // Today (Thursday)
                            <>
                              <CalBlock show="Morning News" color="bg-[#1e293b]" />
                              <CalBlock show="Tech Talk Live" color="bg-[#1e293b]" />
                              <CalBlock show="Evening News" color="bg-[var(--broadcast-accent)] text-black font-bold" />
                              <CalBlock show="Election Spcl" color="bg-[#1e293b]" />
                            </>
                          )}
                          {i !== 3 && (
                            <>
                              <CalBlock show="Morning News" color="bg-[#1e293b]" />
                              {i % 2 === 0 && <CalBlock show="Maintenance" color="bg-[var(--broadcast-warn)] text-black" />}
                              <CalBlock show="Evening News" color="bg-[#1e293b]" />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* Right Rail */}
            <div className="col-span-1 space-y-6">
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-mono font-bold text-[var(--broadcast-muted)] tracking-widest uppercase">Up Next</h2>
                  <Badge variant="outline" className="rounded-none border-[var(--broadcast-accent)] text-[var(--broadcast-accent)] font-mono text-[10px] px-1">AUTO-SYNC</Badge>
                </div>
                <div className="space-y-3">
                  <UpNextCard time="16:30" show="Sports Wrap" studio="Studio B" />
                  <UpNextCard time="18:00" show="Weekly Roundtable" studio="Studio C" />
                  <UpNextCard time="20:00" show="Election Night Special" studio="Studio A" />
                </div>
              </section>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a href="#" className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-l-2 ${active ? 'bg-[#1e293b] text-white border-[var(--broadcast-accent)]' : 'text-[var(--broadcast-muted)] hover:bg-[#1e293b]/50 hover:text-white border-transparent'}`}>
      {icon}
      {label}
    </a>
  );
}

function StudioCard({ name, status, show, time, next }: { name: string, status: string, show: string, time: string, next: string }) {
  const isAlert = status === 'ON-AIR';
  const isWarn = status === 'MAINTENANCE';
  const isUse = status === 'IN USE';
  
  let statusColor = 'bg-slate-700 text-white';
  let indicatorColor = 'bg-slate-400';
  
  if (isAlert) {
    statusColor = 'bg-[var(--broadcast-alert)]/20 text-[var(--broadcast-alert)] border-[var(--broadcast-alert)]';
    indicatorColor = 'bg-[var(--broadcast-alert)] shadow-[0_0_8px_var(--broadcast-alert)]';
  } else if (isWarn) {
    statusColor = 'bg-[var(--broadcast-warn)]/20 text-[var(--broadcast-warn)] border-[var(--broadcast-warn)]';
    indicatorColor = 'bg-[var(--broadcast-warn)]';
  } else if (isUse) {
    statusColor = 'bg-[var(--broadcast-accent)]/20 text-[var(--broadcast-accent)] border-[var(--broadcast-accent)]';
    indicatorColor = 'bg-[var(--broadcast-accent)]';
  }

  return (
    <div className={`bg-[var(--broadcast-panel)] border ${isAlert ? 'border-[var(--broadcast-alert)]/50' : 'border-[var(--broadcast-border)]'} p-3 relative overflow-hidden flex flex-col justify-between h-28`}>
      <div className="flex justify-between items-start mb-2">
        <div className="font-bold text-sm tracking-wide">{name}</div>
        <div className={`text-[10px] font-mono px-1.5 py-0.5 border ${statusColor} flex items-center gap-1.5`}>
          <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
          {status}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="font-mono text-xs truncate" title={show}>{show}</div>
        <div className="font-mono text-[10px] text-[var(--broadcast-muted)]">{time}</div>
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--broadcast-border)] font-mono text-[9px] text-[var(--broadcast-muted)] truncate">
        NXT: {next}
      </div>
    </div>
  );
}

function ScheduleRow({ time, show, studio, prod, crew, status, highlight }: any) {
  const isAlert = status === 'ON-AIR';
  const isTen = status === 'TENTATIVE';
  
  return (
    <tr className={`hover:bg-[#1e293b]/50 transition-colors ${highlight ? 'bg-[#1e293b]/30' : ''}`}>
      <td className="py-2 px-4 font-mono text-xs">{time}</td>
      <td className="py-2 px-4 font-medium text-sm">{show}</td>
      <td className="py-2 px-4 font-mono text-xs text-[var(--broadcast-accent)]">{studio}</td>
      <td className="py-2 px-4 text-xs text-[var(--broadcast-muted)]">{prod}</td>
      <td className="py-2 px-4 font-mono text-xs">{crew}</td>
      <td className="py-2 px-4 text-right">
        <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
          isAlert ? 'bg-[var(--broadcast-alert)]/20 text-[var(--broadcast-alert)] border-[var(--broadcast-alert)]' : 
          isTen ? 'border-dashed border-[var(--broadcast-warn)] text-[var(--broadcast-warn)]' : 
          'border-[var(--broadcast-border)] text-[var(--broadcast-muted)]'
        }`}>
          {status}
        </span>
      </td>
    </tr>
  );
}

function CalBlock({ show, color }: { show: string, color: string }) {
  return (
    <div className={`text-[9px] p-1 truncate border border-[var(--broadcast-panel)] ${color}`}>
      {show}
    </div>
  );
}

function UpNextCard({ time, show, studio }: { time: string, show: string, studio: string }) {
  return (
    <div className="bg-[var(--broadcast-panel)] border border-[var(--broadcast-border)] p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-[#1e293b] px-2 py-1 font-mono text-xs font-bold text-[var(--broadcast-accent)]">{time}</div>
        <div className="flex-1 truncate">
          <div className="font-bold text-sm truncate">{show}</div>
          <div className="font-mono text-[10px] text-[var(--broadcast-muted)]">{studio}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 h-7 bg-[#1e293b] hover:bg-[#334155] text-xs font-mono transition-colors flex items-center justify-center gap-1.5">
          <Eye className="w-3 h-3" /> VIEW
        </button>
        <button className="flex-1 h-7 bg-[#1e293b] hover:bg-[#334155] text-xs font-mono transition-colors flex items-center justify-center gap-1.5">
          <Edit2 className="w-3 h-3" /> EDIT
        </button>
        <button className="w-8 h-7 bg-[#1e293b] hover:bg-[#334155] text-[var(--broadcast-accent)] transition-colors flex items-center justify-center shrink-0">
          <FileText className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
