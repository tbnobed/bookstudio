import React, { useState } from 'react';
import {
  Search,
  Bell,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Video,
  ListTodo,
  Users,
  Box,
  FileText,
  Settings,
  Plus,
  MoreVertical,
  Clock,
  Eye,
  Edit,
  FileSymlink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function WarmEditorial() {
  const [search, setSearch] = useState("");

  return (
    <div className="flex h-screen w-full font-['IBM_Plex_Sans'] bg-[#fcfbf9] text-[#1a1c20] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] flex flex-col border-r border-[#e8e4dc] bg-[#f8f6f0] flex-shrink-0">
        <div className="p-6">
          <h1 className="font-['Playfair_Display'] font-semibold text-2xl tracking-tight text-[#2b2522]">
            BookStud.io
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
          <SidebarItem icon={CalendarIcon} label="Calendar" />
          <SidebarItem icon={Video} label="Studios" />
          <SidebarItem icon={ListTodo} label="Bookings" />
          <SidebarItem icon={Users} label="Crew" />
          <SidebarItem icon={Box} label="Assets" />
          <SidebarItem icon={FileText} label="Templates" />
        </nav>

        <div className="p-4 mt-auto">
          <Separator className="mb-4 bg-[#e8e4dc]" />
          <SidebarItem icon={Settings} label="Settings" />
          <div className="mt-4 flex items-center gap-3 px-2">
            <Avatar className="h-9 w-9 border border-[#e8e4dc]">
              <AvatarFallback className="bg-[#dcd4c6] text-[#2b2522]">SC</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#2b2522]">Sarah Chen</span>
              <span className="text-xs text-[#6e6862]">Producer</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-[72px] px-8 flex items-center justify-between border-b border-[#e8e4dc] bg-[#fcfbf9]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-['Playfair_Display'] text-xl font-medium text-[#2b2522]">
              Thursday, May 28, 2026
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#8a837a]" />
              <Input
                placeholder="Search bookings, crew..."
                className="pl-9 bg-[#f4f1ea] border-transparent focus-visible:ring-[#c8b39c] text-sm h-9 rounded-full placeholder:text-[#8a837a]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="relative text-[#6e6862] hover:text-[#2b2522] transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c96f53] text-[10px] font-medium text-white ring-2 ring-[#fcfbf9]">
                3
              </span>
            </button>
            <Button className="bg-[#2b2522] hover:bg-[#433b37] text-white rounded-full px-5 h-9 font-medium shadow-sm transition-all">
              <Plus className="h-4 w-4 mr-1.5" />
              New Booking
            </Button>
          </div>
        </header>

        <div className="p-8 max-w-[1200px] mx-auto w-full space-y-10">
          {/* Studios Status Grid */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-['Playfair_Display'] text-2xl font-semibold text-[#2b2522]">Live Studios</h3>
              <Button variant="link" className="text-[#6e6862] hover:text-[#2b2522]">View All</Button>
            </div>
            <div className="grid grid-cols-3 gap-5">
              <StudioCard
                name="Studio A"
                status="On-Air"
                current="Morning News — until 11:00 AM"
                next="11:30 AM: Tech Talk Live"
                color="bg-[#c96f53]" // terracotta
              />
              <StudioCard
                name="Studio B"
                status="In Use"
                current="Weekly Roundtable — Prep"
                next="1:00 PM: Recording"
                color="bg-[#d2a265]" // ochre
              />
              <StudioCard
                name="Studio C"
                status="Available"
                current="—"
                next="2:00 PM: Sports Wrap"
                color="bg-[#7b9c8b]" // sage
              />
              <StudioCard
                name="PCR 1"
                status="On-Air"
                current="Controlling Studio A"
                next="Controlling Studio B"
                color="bg-[#c96f53]" // terracotta
              />
              <StudioCard
                name="PCR 2"
                status="Maintenance"
                current="Audio Desk Calibration"
                next="Available Tomorrow"
                color="bg-[#8b9cb0]" // dusty blue
              />
              <StudioCard
                name="Edit Bay"
                status="In Use"
                current="Election Night Special — Rough Cut"
                next="4:00 PM: Marcus Williams"
                color="bg-[#d2a265]" // ochre
              />
            </div>
          </section>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 space-y-10">
              {/* Today's Schedule Timeline */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-['Playfair_Display'] text-2xl font-semibold text-[#2b2522]">Today's Run</h3>
                  <Button variant="outline" size="sm" className="h-8 border-[#e8e4dc] rounded-full text-xs font-medium">Filter</Button>
                </div>
                <div className="space-y-4">
                  <ScheduleItem time="09:00 AM - 11:00 AM" title="Morning News" studio="Studio A" producer="Priya Patel" crew={12} status="Confirmed" />
                  <ScheduleItem time="11:30 AM - 12:30 PM" title="Tech Talk Live" studio="Studio A" producer="Marcus Williams" crew={8} status="Confirmed" />
                  <ScheduleItem time="01:00 PM - 03:00 PM" title="Weekly Roundtable" studio="Studio B" producer="Sarah Chen" crew={15} status="Confirmed" />
                  <ScheduleItem time="04:00 PM - 05:00 PM" title="Sports Wrap" studio="Studio C" producer="James Okafor" crew={6} status="Tentative" />
                </div>
              </section>

              {/* Mini Calendar */}
              <section>
                <h3 className="font-['Playfair_Display'] text-2xl font-semibold text-[#2b2522] mb-5">This Week</h3>
                <div className="bg-white border border-[#e8e4dc] rounded-2xl p-6 shadow-sm">
                  <div className="grid grid-cols-7 gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                      <div key={day} className="text-center pb-2 border-b border-[#e8e4dc]">
                        <span className="text-xs font-medium text-[#6e6862] uppercase tracking-wider">{day}</span>
                      </div>
                    ))}
                    
                    {/* Mon */}
                    <div className="col-span-1 space-y-1 pt-2">
                      <div className="bg-[#f0eadd] text-[#5c5346] text-xs p-1.5 rounded-md truncate font-medium">Morning News</div>
                      <div className="bg-[#e4ece8] text-[#4a6b5a] text-xs p-1.5 rounded-md truncate font-medium">Sports Wrap</div>
                    </div>
                    {/* Tue */}
                    <div className="col-span-1 space-y-1 pt-2">
                      <div className="bg-[#f0eadd] text-[#5c5346] text-xs p-1.5 rounded-md truncate font-medium">Morning News</div>
                      <div className="bg-[#f2e6e3] text-[#8a4b36] text-xs p-1.5 rounded-md truncate font-medium">Tech Talk Live</div>
                    </div>
                    {/* Wed */}
                    <div className="col-span-1 space-y-1 pt-2">
                      <div className="bg-[#f0eadd] text-[#5c5346] text-xs p-1.5 rounded-md truncate font-medium">Morning News</div>
                      <div className="bg-[#e6eaf0] text-[#4b5c73] text-xs p-1.5 rounded-md truncate font-medium">Maintenance</div>
                    </div>
                    {/* Thu (Today) */}
                    <div className="col-span-1 space-y-1 pt-2 bg-[#fcfbf9] -mx-1 px-1 rounded-lg pb-4 relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#c96f53]"></div>
                      <div className="bg-[#f0eadd] text-[#5c5346] text-xs p-1.5 rounded-md truncate font-medium mt-2 shadow-sm border border-[#e8e4dc]">Morning News</div>
                      <div className="bg-[#f2e6e3] text-[#8a4b36] text-xs p-1.5 rounded-md truncate font-medium shadow-sm border border-[#e8e4dc]">Tech Talk Live</div>
                      <div className="bg-[#e4ece8] text-[#4a6b5a] text-xs p-1.5 rounded-md truncate font-medium shadow-sm border border-[#e8e4dc]">Sports Wrap</div>
                    </div>
                    {/* Fri */}
                    <div className="col-span-1 space-y-1 pt-2">
                      <div className="bg-[#f0eadd] text-[#5c5346] text-xs p-1.5 rounded-md truncate font-medium">Morning News</div>
                      <div className="bg-[#f6ebd9] text-[#8a6536] text-xs p-1.5 rounded-md truncate font-medium">Weekly Roundtable</div>
                    </div>
                    {/* Sat */}
                    <div className="col-span-1 space-y-1 pt-2">
                      <div className="bg-[#e4ece8] text-[#4a6b5a] text-xs p-1.5 rounded-md truncate font-medium">Sports Wrap</div>
                    </div>
                    {/* Sun */}
                    <div className="col-span-1 space-y-1 pt-2">
                      <div className="bg-[#f2e6e3] text-[#8a4b36] text-xs p-1.5 rounded-md truncate font-medium border border-[#c96f53]/20">Election Night</div>
                    </div>

                  </div>
                </div>
              </section>
            </div>

            <div className="col-span-4">
              {/* Up Next Panel */}
              <section className="bg-white border border-[#e8e4dc] rounded-2xl shadow-sm overflow-hidden sticky top-8">
                <div className="p-5 border-b border-[#e8e4dc] bg-[#fcfbf9]/50">
                  <h3 className="font-['Playfair_Display'] text-xl font-semibold text-[#2b2522]">Up Next</h3>
                  <p className="text-sm text-[#8a837a] mt-1">Approaching calls</p>
                </div>
                <div className="divide-y divide-[#e8e4dc]">
                  <UpNextItem time="11:30 AM" title="Tech Talk Live" location="Studio A" countdown="In 30 mins" />
                  <UpNextItem time="01:00 PM" title="Weekly Roundtable" location="Studio B" countdown="In 2 hrs" />
                  <UpNextItem time="04:00 PM" title="Sports Wrap" location="Studio C" countdown="In 5 hrs" />
                </div>
                <div className="p-4 bg-[#f8f6f0] flex justify-center">
                  <Button variant="ghost" size="sm" className="text-[#6e6862] hover:text-[#2b2522] hover:bg-transparent">
                    View Full Day
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <a
      href="#"
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active 
          ? 'bg-[#efebe1] text-[#2b2522]' 
          : 'text-[#6e6862] hover:bg-[#f0eadd] hover:text-[#2b2522]'
      }`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-[#c96f53]' : 'text-[#8a837a]'}`} />
      {label}
    </a>
  );
}

function StudioCard({ name, status, current, next, color }: { name: string, status: string, current: string, next: string, color: string }) {
  return (
    <Card className="border-[#e8e4dc] shadow-sm hover:shadow-md transition-shadow bg-white rounded-2xl overflow-hidden group">
      <div className={`h-1.5 w-full ${color}`} />
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="flex justify-between items-start">
          <CardTitle className="font-['Playfair_Display'] text-xl font-medium text-[#2b2522]">{name}</CardTitle>
          <Badge 
            variant="outline" 
            className={`font-medium border-0 rounded-full text-xs px-2.5 py-0.5 ${
              status === 'On-Air' ? 'bg-[#f2e6e3] text-[#8a4b36]' :
              status === 'In Use' ? 'bg-[#f6ebd9] text-[#8a6536]' :
              status === 'Maintenance' ? 'bg-[#e6eaf0] text-[#4b5c73]' :
              'bg-[#e4ece8] text-[#4a6b5a]'
            }`}
          >
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-[#8a837a] mb-1">Current</p>
            <p className="text-sm font-medium text-[#2b2522] truncate">{current}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-[#8a837a] mb-1">Next</p>
            <p className="text-sm text-[#6e6862] truncate">{next}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleItem({ time, title, studio, producer, crew, status }: { time: string, title: string, studio: string, producer: string, crew: number, status: string }) {
  return (
    <div className="group flex items-stretch bg-white border border-[#e8e4dc] rounded-2xl hover:border-[#dcd4c6] hover:shadow-sm transition-all overflow-hidden cursor-pointer">
      <div className="w-48 p-4 border-r border-[#e8e4dc] bg-[#fcfbf9] flex flex-col justify-center shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8a837a] mb-1">Time</span>
        <span className="text-sm font-medium text-[#2b2522]">{time}</span>
      </div>
      <div className="flex-1 p-4 flex items-center justify-between">
        <div>
          <h4 className="font-['Playfair_Display'] text-lg font-medium text-[#2b2522] mb-1">{title}</h4>
          <div className="flex items-center gap-3 text-sm text-[#6e6862]">
            <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-[#8a837a]" /> {studio}</span>
            <span className="text-[#dcd4c6]">•</span>
            <span className="flex items-center gap-1.5"><Avatar className="w-4 h-4"><AvatarFallback className="text-[8px] bg-[#efebe1] text-[#2b2522]">{producer[0]}</AvatarFallback></Avatar> {producer}</span>
            <span className="text-[#dcd4c6]">•</span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#8a837a]" /> {crew} Crew</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className={`rounded-full bg-[#f8f6f0] text-[#6e6862] border border-[#e8e4dc] font-medium hover:bg-[#efebe1] ${status === 'Tentative' ? 'opacity-70 border-dashed' : ''}`}>
            {status}
          </Badge>
          <Button variant="ghost" size="icon" className="text-[#8a837a] opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function UpNextItem({ time, title, location, countdown }: { time: string, title: string, location: string, countdown: string }) {
  return (
    <div className="p-5 hover:bg-[#fcfbf9] transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#c96f53] bg-[#f2e6e3] px-2 py-0.5 rounded-md inline-block mb-2">{countdown}</span>
          <h4 className="font-['Playfair_Display'] text-lg font-medium text-[#2b2522]">{title}</h4>
        </div>
        <span className="text-sm font-medium text-[#2b2522] bg-[#f8f6f0] px-2 py-1 rounded-md border border-[#e8e4dc] flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[#8a837a]" />
          {time}
        </span>
      </div>
      <div className="flex items-center text-sm text-[#6e6862] mb-4">
        <Video className="w-3.5 h-3.5 mr-1.5 text-[#8a837a]" />
        {location}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 flex-1 rounded-lg border-[#e8e4dc] text-[#2b2522] hover:bg-[#f0eadd] text-xs font-medium">
          <Eye className="w-3.5 h-3.5 mr-1.5 text-[#8a837a]" />
          View
        </Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 rounded-lg border-[#e8e4dc] text-[#2b2522] hover:bg-[#f0eadd] text-xs font-medium">
          <Edit className="w-3.5 h-3.5 mr-1.5 text-[#8a837a]" />
          Edit
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-lg border-[#e8e4dc] text-[#2b2522] hover:bg-[#f0eadd]">
          <FileSymlink className="w-3.5 h-3.5 text-[#8a837a]" />
        </Button>
      </div>
    </div>
  );
}
