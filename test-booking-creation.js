import { db } from './server/db.js';
import { sendSiteManagerNotification } from './server/services/emailService.js';

async function testBookingEmailSystem() {
  console.log('Testing complete email notification system...');
  
  // Create a mock booking object
  const testBooking = {
    id: 999,
    title: 'Email System Test Booking',
    description: 'Testing the complete email notification pipeline',
    type: 'production',
    status: 'confirmed',
    start: new Date(),
    end: new Date(Date.now() + 3600000),
    userId: 1
  };
  
  const testStudio = {
    id: 1,
    name: 'Test Studio'
  };
  
  const testUser = {
    id: 1,
    username: 'admin',
    email: 'obedtest@tbn.tv'
  };
  
  console.log('Sending site manager notification...');
  try {
    const result = await sendSiteManagerNotification(testBooking, [testStudio], testUser, 'created');
    console.log('Site manager notification result:', result);
  } catch (error) {
    console.error('Site manager notification error:', error);
  }
}

testBookingEmailSystem().then(() => {
  console.log('Email system test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
