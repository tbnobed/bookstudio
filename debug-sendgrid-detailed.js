/**
 * Debug script to get detailed SendGrid API error information
 */

import { MailService } from '@sendgrid/mail';

const mailService = new MailService();

if (!process.env.SENDGRID_API_KEY) {
  console.error("SENDGRID_API_KEY not found");
  process.exit(1);
}

mailService.setApiKey(process.env.SENDGRID_API_KEY);

async function debugSendGridError() {
  console.log("=== DEBUGGING DETAILED SENDGRID ERROR ===");
  
  // Test the exact email template causing issues
  const problematicEmail = {
    to: 'obedconference@tbn.tv',
    from: process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@bookstudio.com',
    subject: 'BookStud.io - Studio Booking Created',
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: #333;">Studio Booking Created</h2>
        <p style="margin: 0; color: #666;">A booking has been created in your facility</p>
      </div>
      
      <div style="background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">test 38</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-weight: bold; color: #333;">Studio:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f3f4; color: #666;">Studio Y</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-weight: bold; color: #333;">Start Time:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f3f4; color: #666;">Saturday, June 14, 2025 at 11:00 AM CDT</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f3f4; font-weight: bold; color: #333;">End Time:</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #f1f3f4; color: #666;">Saturday, June 14, 2025 at 12:00 PM CDT</td>
          </tr>
        </table>
        
        <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">This notification has been sent to your notification group.</p>
      </div>
    </div>
    `
  };
  
  try {
    console.log("Testing exact problematic email template...");
    console.log("From:", problematicEmail.from);
    console.log("To:", problematicEmail.to);
    console.log("Subject:", problematicEmail.subject);
    
    await mailService.send(problematicEmail);
    console.log("✓ Email sent successfully - this means the template is not the issue");
  } catch (error) {
    console.error("✗ Email failed with detailed error:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    if (error.response && error.response.body && error.response.body.errors) {
      console.error("SendGrid specific errors:");
      error.response.body.errors.forEach((err, index) => {
        console.error(`Error ${index + 1}:`, JSON.stringify(err, null, 2));
      });
    }
    
    // Test if it's a sender verification issue
    try {
      console.log("\n--- Testing with different sender ---");
      const testWithDifferentSender = {
        ...problematicEmail,
        from: 'test@example.com'
      };
      await mailService.send(testWithDifferentSender);
      console.log("✓ Different sender worked - sender verification issue");
    } catch (senderError) {
      console.error("✗ Different sender also failed - not a sender issue");
    }
  }
}

debugSendGridError().catch(console.error);