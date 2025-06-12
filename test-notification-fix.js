import { sendBookingNotificationToGroups } from './server/services/notificationGroupService.ts';
import { storage } from './server/storage.ts';

async function testNotificationFix() {
  console.log("=== TESTING NOTIFICATION GROUP EMAIL SYSTEM ===");
  
  try {
    // Get the test 38 booking from database
    const booking = await storage.getBooking(94);
    if (!booking) {
      console.error("Booking 94 not found");
      return;
    }
    
    console.log("Retrieved booking:", booking.title, "with notifyList:", booking.notifyList);
    
    // Get the studio
    const studio = await storage.getStudio(booking.studioId);
    console.log("Studio:", studio ? studio.name : 'Not found');
    
    // Get notification group 8
    const notificationGroup = await storage.getNotificationGroup(8);
    console.log("Notification group 8:", notificationGroup ? `${notificationGroup.name} (${notificationGroup.email})` : 'Not found');
    
    // Test sending notification group email
    console.log("Attempting to send notification group email...");
    const result = await sendBookingNotificationToGroups(
      booking,
      studio,
      [8],
      'created'
    );
    
    console.log("Notification result:", result);
    console.log("=== TEST COMPLETED ===");
    
  } catch (error) {
    console.error("Error during notification test:", error);
  }
}

testNotificationFix();