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
  console.log("=== DEBUGGING SENDGRID API ERROR ===");
  
  // Test basic email first
  const basicEmail = {
    to: 'obedconference@tbn.tv',
    from: process.env.SENDGRID_VERIFIED_SENDER || 'alerts@obedtv.com',
    subject: 'Test Email',
    text: 'This is a test email to verify SendGrid configuration.',
    html: '<p>This is a test email to verify SendGrid configuration.</p>'
  };
  
  try {
    console.log("Testing basic email...");
    await mailService.send(basicEmail);
    console.log("✓ Basic email sent successfully");
  } catch (error) {
    console.error("✗ Basic email failed:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    if (error.response && error.response.body && error.response.body.errors) {
      console.error("SendGrid specific errors:");
      error.response.body.errors.forEach((err, index) => {
        console.error(`Error ${index + 1}:`, JSON.stringify(err, null, 2));
      });
    }
    return;
  }
  
  // Test the actual problematic template
  const complexTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BookStud.io - Studio Booking Created</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
                color: #334155;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content">
                <h2 class="booking-title">test 38</h2>
                <div class="booking-details">
                    <div class="detail-row">
                        <span class="label">Studio:</span>
                        <span class="value">Studio Y</span>
                    </div>
                </div>
                <p class="message-text">A booking has been created in your facility.</p>
            </div>
        </div>
    </body>
    </html>
  `;
  
  const complexEmail = {
    to: 'obedconference@tbn.tv',
    from: process.env.SENDGRID_VERIFIED_SENDER || 'alerts@obedtv.com',
    subject: 'BookStud.io - Studio Booking Created',
    html: complexTemplate
  };
  
  try {
    console.log("Testing complex HTML template...");
    await mailService.send(complexEmail);
    console.log("✓ Complex email sent successfully");
  } catch (error) {
    console.error("✗ Complex email failed:");
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    
    if (error.response && error.response.body && error.response.body.errors) {
      console.error("SendGrid specific errors:");
      error.response.body.errors.forEach((err, index) => {
        console.error(`Error ${index + 1}:`, JSON.stringify(err, null, 2));
      });
    }
  }
}

testSendGridError().catch(console.error);