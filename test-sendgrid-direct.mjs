import { MailService } from '@sendgrid/mail';

async function testDirectSendGrid() {
  const mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);

  console.log('Testing direct SendGrid API call...');
  console.log('API Key present:', !!process.env.SENDGRID_API_KEY);
  console.log('Verified sender:', process.env.SENDGRID_VERIFIED_SENDER);

  try {
    const emailData = {
      to: 'test@example.com',
      from: process.env.SENDGRID_VERIFIED_SENDER,
      subject: 'BookStud.io Email System Test',
      text: 'This is a test email from BookStud.io email system.',
      html: '<p>This is a test email from BookStud.io email system.</p>'
    };

    console.log('Sending test email...');
    await mailService.send(emailData);
    console.log('✓ Email sent successfully!');
    return true;
  } catch (error) {
    console.error('✗ Email failed:', error.message);
    if (error.response?.body?.errors) {
      console.error('SendGrid errors:', JSON.stringify(error.response.body.errors, null, 2));
    }
    return false;
  }
}

testDirectSendGrid().then(result => {
  console.log('Test result:', result ? 'SUCCESS' : 'FAILED');
  process.exit(result ? 0 : 1);
});
