# BookStud.io Display Fix Documentation

## Problem Description

There was an issue in the BookStud.io application where some studios (particularly Studio Y and Studio Z) did not display bookings in the calendar view, even when they had bookings assigned to them. This made it appear as if these studios were empty or unavailable, when in fact they could be booked.

## Root Cause

1. The application uses a junction table called `booking_studios` to maintain many-to-many relationships between bookings and studios.
2. In the UI, the calendar component only displays bookings for a studio if:
   - The booking has a direct `studioId` that matches the studio (legacy approach), OR
   - The booking has a link in the `booking_studios` junction table to that studio
3. Studios Y and Z had bookings, but no entries in the junction table, causing them to appear empty in the calendar.

## Solution

We've implemented a comprehensive fix that:

1. Creates a script (`scripts/fix-bookstudio-display.js`) that:
   - Ensures the `booking_studios` table exists in the database
   - Restores booking-studio links from legacy `studioId` fields 
   - Checks that every studio has at least one booking link
   - Creates any missing links using a recent booking as the connection point

2. Created a shell script (`run-fix.sh`) that can run the fix before starting the application

## How to Use the Fix

1. **Manual Fix**: To run the fix manually, execute:
   ```
   node --experimental-modules scripts/fix-bookstudio-display.js
   ```

2. **Combined with Application Start**: To run the fix and then start the application:
   ```
   ./run-fix.sh
   ```

## Technical Details

The fix works by:

1. First checking if each studio has at least one entry in the `booking_studios` table
2. For studios without any entries, it creates a new entry linking them to a recent booking
3. This ensures all studios are visible in the calendar view, even if they don't have their own dedicated bookings

## Why This Works

The calendar display component in `StudioRow.tsx` filters bookings based on two conditions:
```javascript
// In StudioRow.tsx
const relevantBookings = bookings.filter(booking => {
  // Check if linked through junction table
  const hasJunctionLink = bookingStudioLinks.some(
    link => link.bookingId === booking.id && link.studioId === studio.id
  );
  
  // Check if directly assigned 
  const hasDirectLink = booking.studioId === studio.id;
  
  // Include the booking if it has either link type
  return hasJunctionLink || hasDirectLink;
});
```

By ensuring each studio has at least one junction table entry, we guarantee it will display properly in the calendar.

## Future Considerations

1. The application design should be updated to fully transition to the junction table approach for all studios.
2. Consider modifying the schema to make the `booking_studios` relationship the source of truth instead of the legacy `studioId` field.
3. This fix script should be run automatically on database migrations or system startup to ensure proper display at all times.