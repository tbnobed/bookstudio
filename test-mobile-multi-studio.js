/**
 * Test script to verify mobile multi-studio booking creation
 * This simulates the exact data flow from mobile form to server
 */

import { createBookingStudioLinks } from './server/storage.js';

async function testMobileMultiStudioFlow() {
  console.log("=== TESTING MOBILE MULTI-STUDIO FLOW ===");
  
  // Simulate the exact data that would be sent from mobile form
  const mobileFormData = {
    title: "Mobile Multi-Studio Test",
    description: "Testing mobile multi-studio creation",
    studioId: 1,          // Primary studio
    studioIds: [1, 5],    // Multi-studio array
    start: "2025-06-23T16:00:00.000Z",
    end: "2025-06-23T17:00:00.000Z",
    type: "production",
    status: "confirmed",
    templateId: null,
    pcrRoomId: null,
    userId: 1
  };
  
  console.log("Mobile form data:", JSON.stringify(mobileFormData, null, 2));
  
  // Test the studioIds extraction logic (matches server code)
  const studioIds = mobileFormData.studioIds || [];
  const mainStudioId = typeof mobileFormData.studioId === 'string' ? 
    parseInt(mobileFormData.studioId) : mobileFormData.studioId;
  
  console.log("Extracted data:", {
    studioIds,
    mainStudioId,
    studioIdsType: typeof mobileFormData.studioIds,
    studioIdsLength: studioIds?.length
  });
  
  // Test the condition that should trigger multi-studio creation
  if (studioIds && studioIds.length > 0) {
    console.log("✅ Multi-studio condition PASSED");
    const parsedStudioIds = studioIds.map(id => typeof id === 'string' ? parseInt(id) : id);
    console.log("Parsed studio IDs:", parsedStudioIds);
    
    // Test the createBookingStudioLinks function directly
    try {
      const { storage } = await import('./server/storage.js');
      
      // Create a test booking first
      const testBooking = await storage.createBooking({
        ...mobileFormData,
        studioId: mainStudioId
      });
      
      console.log("Created test booking:", testBooking.id);
      
      // Now test the studio links creation
      const links = await storage.createBookingStudioLinks(testBooking.id, parsedStudioIds);
      console.log("Created studio links:", links);
      
      // Verify the links
      const verificationLinks = await storage.getBookingStudioLinks(testBooking.id);
      console.log("Verification - fetched links:", verificationLinks);
      
      if (verificationLinks.length === parsedStudioIds.length) {
        console.log("✅ MULTI-STUDIO CREATION SUCCESSFUL!");
      } else {
        console.log("❌ MULTI-STUDIO CREATION FAILED - Wrong number of links");
      }
      
    } catch (error) {
      console.error("❌ Error testing studio links:", error);
    }
    
  } else {
    console.log("❌ Multi-studio condition FAILED");
    console.log("Condition details:", {
      studioIds,
      hasStudioIds: !!studioIds,
      length: studioIds?.length,
      lengthGreaterThanZero: studioIds?.length > 0
    });
  }
}

testMobileMultiStudioFlow();