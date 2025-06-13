/**
 * Test exact SendGrid error details
 */
import { MailService } from '@sendgrid/mail';

async function testSendGridError() {
  const mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);

  // Test the exact email parameters being sent by the notification system
  const testParams = {
    to: 'obedconference@tbn.tv',
    from: 'alerts@obedtv.com',
    subject: 'BookStud.io - Studio Booking Created',
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookStud.io Notification</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
        .booking-card { padding: 24px; border-left: 4px solid #667eea; margin: 16px 0; background: #f8fafc; }
        .details-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .details-table td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>BookStud.io</h1>
            <p>Studio Booking Notification</p>
        </div>
        <div class="booking-card">
            <h3>Test email </h3>
            <table class="details-table">
                <tr>
                    <td><strong>Studio:</strong></td>
                    <td>Studio W</td>
                </tr>
                <tr>
                    <td><strong>Date & Time:</strong></td>
                    <td>Wednesday, June 11, 2025 at 11:00 AM CDT - 12:00 PM CDT</td>
                </tr>
                <tr>
                    <td><strong>Action:</strong></td>
                    <td>Booking Created</td>
                </tr>
            </table>
        </div>
        <div class="footer">
            <p>This is an automated notification from BookStud.io</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`
  };

  try {
    await mailService.send(testParams);
    console.log('✓ Email sent successfully - notification system is working!');
  } catch (error) {
    console.log('✗ SendGrid error details:');
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    if (error.response?.body?.errors) {
      console.log('Specific errors:', JSON.stringify(error.response.body.errors, null, 2));
    }
  }
}

testSendGridError();