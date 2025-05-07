/**
 * Verify that your route handler for /api/bookings/copy
 * matches this implementation in server/routes.ts
 */

// Copy a booking to multiple dates
app.post("/api/bookings/copy", isAuthenticated, async (req, res) => {
  try {
    const user = req.user as any;
    const { bookingId, dates, titleSuffix } = req.body;
    
    if (!bookingId || !dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ message: "Invalid request. Booking ID and at least one date required." });
    }
    
    // Fetch the original booking
    const originalBooking = await storage.getBooking(bookingId);
    if (!originalBooking) {
      return res.status(404).json({ message: "Original booking not found" });
    }
    
    // Check if user has permission to copy this booking
    const canCopy = 
      user.role === "admin" || 
      (user.role === "producer" && (originalBooking.userId === user.id || originalBooking.type === "production" || originalBooking.type === "rehearsal")) ||
      (user.role === "engineer" && (originalBooking.type === "maintenance")) ||
      (user.role === "it" && (originalBooking.type === "maintenance" || originalBooking.type === "it_support"));
    
    if (!canCopy) {
      return res.status(403).json({ message: "You don't have permission to copy this booking" });
    }
    
    console.log(`Copying booking ${bookingId} to ${dates.length} dates`);
    
    // Convert date strings to Date objects
    const datesToCopy = dates.map(dateStr => new Date(dateStr));
    
    // Use the storage method to copy the booking
    const newBookings = await storage.copyBookingToMultipleDates(bookingId, datesToCopy);
    
    // Apply title suffix if provided
    if (titleSuffix && newBookings.length > 0) {
      for (const newBooking of newBookings) {
        await storage.updateBooking(
          newBooking.id, 
          { title: `${newBooking.title} - ${titleSuffix}` }
        );
      }
    }
    
    // Format results in the expected format for the client
    const results = newBookings.map(booking => ({
      date: booking.start.toISOString().split('T')[0],
      success: true,
      booking
    }));
    
    // Add failed entries for dates that weren't processed
    // (This would happen if a date was the same as the original booking)
    const processedDates = new Set(newBookings.map(b => new Date(b.start).toDateString()));
    const failedResults = datesToCopy
      .filter(d => !processedDates.has(d.toDateString()))
      .map(d => ({
        date: d.toISOString().split('T')[0],
        success: false,
        error: "Date is the same as original booking or had a conflict"
      }));
    
    const allResults = [...results, ...failedResults];
    const successCount = results.length;
    const failCount = failedResults.length;
    
    res.status(201).json({ 
      success: successCount > 0,
      message: `Copied booking to ${successCount} dates${failCount > 0 ? ` (${failCount} failed)` : ''}`,
      results: allResults
    });
  } catch (error) {
    console.error("Error copying booking:", error);
    res.status(500).json({ message: "Failed to copy booking" });
  }
});