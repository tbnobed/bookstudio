import { sendSiteManagerNotification } from './server/services/emailService.js';

async function testEmailVisibility() {
  console.log('Testing email link visibility...');
  
  const testBooking = {
    id: 9999,
    title: 'Link Visibility Test',
    description: 'Testing fixed email link visibility',
    type: 'production',
    status: 'confirmed',
    start: new Date(),
    end: new Date(Date.now() + 3600000),
    userId: 1
  };
  
  const testStudio = { id: 1, name: 'Test Studio' };
  const testUser = { id: 1, username: 'admin', email: 'obedtest@tbn.tv' };
  
  try {
    console.log('Sending test email with visible links...');
    const result = await sendSiteManagerNotification(testBooking, [testStudio], testUser, 'created');
    console.log('Email sent successfully:', result);
    console.log('Check your email - the links should now be clearly visible!');
  } catch (error) {
    console.error('Email test failed:', error);
  }
}

testEmailVisibility().then(() => {
  console.log('Email visibility test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
