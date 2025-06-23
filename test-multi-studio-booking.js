/**
 * Test script to verify multi-studio booking creation
 */

const fetch = require('node-fetch');

async function testMultiStudioBooking() {
  try {
    // Test data with multiple studios
    const bookingData = {
      title: "Multi-Studio Test",
      description: "Testing multi-studio creation from script",
      studioId: 1,
      studioIds: [1, 2, 3], // Multiple studios
      start: "2025-06-23T16:00:00.000Z",
      end: "2025-06-23T17:00:00.000Z",
      type: "production",
      status: "confirmed",
      templateId: null,
      userId: 1
    };
    
    console.log("Testing multi-studio booking creation...");
    console.log("Booking data:", JSON.stringify(bookingData, null, 2));
    
    // Since we can't authenticate easily, let's directly test the storage function
    const { storage } = await import('./server/storage.js');
    
    // Create the booking
    const booking = await storage.createBooking(bookingData);
    console.log("Created booking:", booking);
    
    // Create studio links
    if (bookingData.studioIds && bookingData.studioIds.length > 0) {
      const links = await storage.createBookingStudioLinks(booking.id, bookingData.studioIds);
      console.log("Created studio links:", links);
      
      // Verify the links were created
      const fetchedLinks = await storage.getBookingStudioLinks(booking.id);
      console.log("Fetched studio links:", fetchedLinks);
      
      const studiosForBooking = await storage.getStudiosForBooking(booking.id);
      console.log("Studios for booking:", studiosForBooking);
    }
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testMultiStudioBooking();