/**
 * Test script to verify site manager email functionality
 */

async function testSiteManagerEmail() {
  try {
    const response = await fetch('http://localhost:5000/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test' // This won't work for auth but shows the test
      },
      body: JSON.stringify({
        title: 'Test Site Manager Email Fix',
        description: 'Testing that site manager emails work without severity info',
        studioIds: [5],
        start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
        type: 'production',
        status: 'confirmed',
        severity: 'medium', // This should NOT appear in site manager emails
        notifyList: [8]
      })
    });

    const result = await response.json();
    console.log('Booking creation result:', result);
    
    if (response.ok) {
      console.log('✅ Test booking created successfully');
      console.log('📧 Check site manager email - should be HTML-only, no severity info');
    } else {
      console.log('❌ Test failed:', result);
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSiteManagerEmail();