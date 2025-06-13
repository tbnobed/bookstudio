/**
 * Debug script to capture exact SendGrid error details
 */
import { storage } from './server/storage.ts';
import { sendBookingNotificationToGroups } from './server/services/notificationGroupService.ts';

async function debugExactError() {
  try {
    console.log('=== DEBUGGING EXACT SENDGRID ERROR ===');
    
    const booking = await storage.getBooking(95);
    const studio = await storage.getStudio(5);
    
    console.log('Test booking:', booking?.title);
    console.log('Test studio:', studio?.name);
    
    // Monkey patch the sendEmail function to capture exact parameters
    const originalSendEmail = await import('./server/services/emailService.ts');
    const originalSend = originalSendEmail.sendEmail;
    
    originalSendEmail.sendEmail = async function(params) {
      console.log('\n=== CAPTURED EMAIL PARAMETERS ===');
      console.log('To:', params.to);
      console.log('From:', params.from);
      console.log('Subject:', params.subject);
      console.log('Has text:', !!params.text);
      console.log('Has html:', !!params.html);
      
      if (params.html) {
        console.log('HTML length:', params.html.length);
        console.log('HTML preview (first 500 chars):', params.html.substring(0, 500));
      }
      
      console.log('Full params object keys:', Object.keys(params));
      console.log('Full params serialized:', JSON.stringify(params, null, 2));
      
      // Try to call original function to get exact error
      try {
        return await originalSend.call(this, params);
      } catch (error) {
        console.log('\n=== SENDGRID ERROR DETAILS ===');
        console.log('Error code:', error.code);
        console.log('Error message:', error.message);
        
        if (error.response && error.response.body && error.response.body.errors) {
          console.log('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
        }
        
        throw error;
      }
    };
    
    // Now test the notification
    await sendBookingNotificationToGroups(booking, studio, [8], 'created');
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugExactError();