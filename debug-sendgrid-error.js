/**
 * Debug script to identify the exact SendGrid API error
 */

import { MailService } from '@sendgrid/mail';

const mailService = new MailService();

if (!process.env.SENDGRID_API_KEY) {
  console.error("SENDGRID_API_KEY not found");
  process.exit(1);
}

mailService.setApiKey(process.env.SENDGRID_API_KEY);

async function testSendGridError() {
  console.log("=== DEBUGGING SENDGRID ERROR ===");
  
  // Test simple email first
  const simpleEmail = {
    to: 'obedconference@tbn.tv',
    from: process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@bookstudio.com',
    subject: 'Test Simple Email',
    text: 'This is a simple test email',
    html: '<p>This is a simple test email</p>'
  };
  
  try {
    console.log("Testing simple email...");
    await mailService.send(simpleEmail);
    console.log("✓ Simple email sent successfully");
  } catch (error) {
    console.error("✗ Simple email failed:");
    console.error("Error code:", error.code);
    console.error("Error response:", JSON.stringify(error.response?.body, null, 2));
    return;
  }
  
  // Test complex HTML email
  const complexEmail = {
    to: 'obedconference@tbn.tv',
    from: process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@bookstudio.com',
    subject: 'Studio Booking Created',
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
    console.log("Testing complex HTML email...");
    await mailService.send(complexEmail);
    console.log("✓ Complex HTML email sent successfully");
  } catch (error) {
    console.error("✗ Complex HTML email failed:");
    console.error("Error code:", error.code);
    console.error("Error response:", JSON.stringify(error.response?.body, null, 2));
  }
}

testSendGridError().catch(console.error);