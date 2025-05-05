import { generatePasswordResetToken, sendPasswordResetEmail } from './email';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Test function to generate a password reset token and send a reset email
async function testResetEmail() {
  try {
    // Get a user account
    const [user] = await db.select().from(users).limit(1);
    
    if (!user) {
      console.error('No user found in the database.');
      return;
    }
    
    console.log('Using user:', user.username, '(ID:', user.id, ')');
    
    // Email to send to
    const testEmail = 'test@example.com';
    
    // Generate a token
    console.log(`Generating password reset token for user ID ${user.id}...`);
    const token = await generatePasswordResetToken(user.id);
    console.log('Token generated:', token);
    
    // Create reset path
    const resetPath = `/reset-password/${token}`;
    
    // Send reset email
    console.log(`Sending password reset email to ${testEmail}...`);
    const emailSent = await sendPasswordResetEmail(
      testEmail, 
      resetPath
    );
    
    if (emailSent) {
      console.log('✅ Password reset email sent successfully');
    } else {
      console.log('❌ Password reset email failed to send, but token was generated');
      console.log('Manual reset link:');
      console.log(`http://localhost:5000/reset-password/${token}`);
    }
    
    // For testing in the browser, provide a direct link
    console.log('\nTo test in browser:');
    console.log(`http://localhost:5000/reset-password/${token}`);
    
  } catch (error) {
    console.error('Error in test reset function:', error);
  }
}

// Run the test
testResetEmail().then(() => {
  console.log('Test completed.');
  process.exit(0);
}).catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});