/**
 * Test script to verify the complete mobile booking flow
 * This simulates a booking creation with multiple studios
 */

// Simulate the data that should be sent from mobile form to server
const testBookingData = {
  title: "Complete Flow Test",
  description: "Testing complete mobile multi-studio booking flow",
  studioId: 1,
  studioIds: [1, 5], // This should create links for both studios
  start: "2025-06-23T20:00:00.000Z",
  end: "2025-06-23T21:00:00.000Z",
  type: "production",
  status: "confirmed",
  templateId: null,
  pcrRoomId: null,
  notifyList: [],
  color: "#3b82f6"
};

console.log("Testing mobile booking flow with data:");
console.log(JSON.stringify(testBookingData, null, 2));

// Test using curl to simulate the exact request
const curlCommand = `curl -X POST http://localhost:5000/api/bookings \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testBookingData)}'`;

console.log("\nTo test manually, run this curl command:");
console.log(curlCommand);

console.log("\nExpected behavior:");
console.log("1. Server should log [MULTI-STUDIO DEBUG] messages");
console.log("2. Booking should be created with ID");
console.log("3. Studio links should be created for studios 1 and 5");
console.log("4. Verification should show 2 studio links for the booking");