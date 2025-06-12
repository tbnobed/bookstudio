// Simple test to check notification group functionality
import { sendBookingNotificationToGroups } from './server/services/notificationGroupService.js';

async function testNotificationGroups() {
  console.log("Testing notification group email functionality...");
  
  const testBooking = {
    id: 93,
    title: "test 37",
    description: "",
    studioId: 7,
    userId: 1,
    start: "2025-06-13T16:00:00.000Z",
    end: "2025-06-13T17:00:00.000Z",
    type: "production",
    status: "confirmed",
    severity: "medium",
    notifyList: [8]
  };
  
  const testStudio = {
    id: 7,
    name: "Studio Y"
  };
  
  try {
    console.log("Sending test notification to groups:", testBooking.notifyList);
    const result = await sendBookingNotificationToGroups(
      testBooking,
      testStudio,
      [8],
      'created'
    );
    console.log("Notification result:", result);
  } catch (error) {
    console.error("Error during notification test:", error);
  }
}

testNotificationGroups();