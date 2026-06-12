---
name: Studio status timezone quirk
description: useStudioStatus computes "today" in browser-local time despite the facility-timezone requirement
---

`client/src/hooks/use-studio-status.tsx` (`getStudioStatus`) determines the
upcoming/"next booking today" window with `new Date()` + `setHours(0,0,0,0)` /
`setHours(23,59,59,999)`, i.e. **browser-local** day boundaries — not the
facility timezone the rest of the app requires.

**Why:** replit.md mandates ALL date/time logic use the facility timezone
(`VITE_FACILITY_TIMEZONE`). This hook predates/ignores that for its day-window,
so for users in a different timezone than the facility, status color and
"Next up" can be wrong near facility midnight. Code review flags this whenever
a feature surfaces `currentBooking`/`nextBooking` from this hook.

**How to apply:** It's a pre-existing, app-wide gotcha (calendar, signage,
studios, facility map all consume it). Don't silently expand a small feature's
scope to refactor it — fixing it touches shared status logic with broad
regression risk. Use `isSameDay(date, now)` from `@/lib/dateUtils` (which IS
facility-tz aware) for any NEW per-day filtering you write, as FacilityMap's
`selectedTodaySchedule` does. A real fix to the hook should be its own task.
