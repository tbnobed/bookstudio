import { generateInviteToken, sendInviteEmail } from './email';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test function to generate an invite token and send an invite email
async function testInviteEmail() {
  try {
    // Get or create an admin user
    const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    
    if (!adminUser) {
      console.error('No admin user found. Please create an admin user first.');
      return;
    }
    
    console.log('Using admin user:', adminUser.name, '(ID:', adminUser.id, ')');
    
    // Test email that you can use for testing
    const testEmail = 'test@example.com';
    
    // Role to assign
    const role = 'producer';
    
    // Generate a token
    console.log(`Generating invite token for ${testEmail} with role ${role}...`);
    const token = await generateInviteToken(role, testEmail, adminUser.id);
    console.log('Token generated:', token);
    
    // Create invite path
    const invitePath = `/invite/${token}`;
    
    // Send invite email
    console.log(`Sending invite email to ${testEmail}...`);
    const emailSent = await sendInviteEmail(
      testEmail, 
      role, 
      invitePath, 
      adminUser.name || 'Admin'
    );
    
    if (emailSent) {
      console.log('✅ Invite email sent successfully');
    } else {
      console.log('❌ Invite email failed to send, but token was generated');
      console.log('Manual invite link:');
      console.log(`http://localhost:5000/invite/${token}`);
    }
    
    // For testing in the browser, provide a direct link
    console.log('\nTo test in browser:');
    console.log(`http://localhost:5000/invite/${token}`);
    
  } catch (error) {
    console.error('Error in test invite function:', error);
  }
}

// Run the test
testInviteEmail().then(() => {
  console.log('Test completed.');
  process.exit(0);
}).catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});