/**
 * Verify that your IStorage interface in server/storage.ts
 * includes this method definition:
 */

// In the IStorage interface
copyBookingToMultipleDates(bookingId: number, dates: Date[]): Promise<Booking[]>;

/**
 * Also make sure your DatabaseStorage implementation includes this method:
 */

// Copy a booking to multiple dates
async copyBookingToMultipleDates(bookingId: number, dates: Date[]): Promise<Booking[]> {
  try {
    // Get the original booking
    const originalBooking = await this.getBooking(bookingId);
    if (!originalBooking) {
      console.error(`Original booking with ID ${bookingId} not found`);
      return [];
    }
    
    console.log(`Copying booking ${bookingId} (${originalBooking.title}) to ${dates.length} dates`);
    
    // Get the studios linked to this booking
    const linkedStudios = await this.getStudiosForBooking(bookingId);
    const studioIds = linkedStudios.map(studio => studio.id);
    
    // Calculate duration of the original booking in milliseconds
    const origStart = new Date(originalBooking.start);
    const origEnd = new Date(originalBooking.end);
    const durationMs = origEnd.getTime() - origStart.getTime();
    
    // For each target date, create a new booking
    const newBookings: Booking[] = [];
    
    for (const targetDate of dates) {
      // Skip if the target date is the same as the original booking's date
      const origStartDay = new Date(origStart);
      origStartDay.setHours(0, 0, 0, 0);
      
      const targetDay = new Date(targetDate);
      targetDay.setHours(0, 0, 0, 0);
      
      if (origStartDay.getTime() === targetDay.getTime()) {
        console.log(`Skipping date ${targetDate.toISOString()} as it's the same as the original booking's date`);
        continue;
      }
      
      // Create a new start time with the same time of day but on the target date
      const newStart = new Date(targetDate);
      newStart.setHours(
        origStart.getHours(),
        origStart.getMinutes(),
        origStart.getSeconds(),
        origStart.getMilliseconds()
      );
      
      // Create a new end time based on the duration
      const newEnd = new Date(newStart.getTime() + durationMs);
      
      // Create a new booking based on the original
      const newBookingData: InsertBooking = {
        title: originalBooking.title,
        description: originalBooking.description,
        type: originalBooking.type,
        userId: originalBooking.userId,
        start: newStart,
        end: newEnd,
        studioId: originalBooking.studioId,
        pcrRoomId: originalBooking.pcrRoomId,
        templateId: originalBooking.templateId,
        notifyList: originalBooking.notifyList,
        severity: originalBooking.severity
      };
      
      // Create the new booking
      const newBooking = await this.createBooking(newBookingData);
      
      // Link the new booking to the same studios as the original
      if (studioIds.length > 0) {
        await this.createBookingStudioLinks(newBooking.id, studioIds);
      }
      
      newBookings.push(newBooking);
      console.log(`Created new booking with ID ${newBooking.id} for date ${targetDate.toISOString()}`);
    }
    
    return newBookings;
  } catch (error) {
    console.error(`Error copying booking ID ${bookingId} to multiple dates:`, error);
    return [];
  }
}