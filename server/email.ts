import { MailService } from '@sendgrid/mail';
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { passwordResetTokens, inviteTokens } from '../shared/schema';

// Initialize SendGrid
const mailService = new MailService();

// Check if SendGrid API key is available
if (!process.env.SENDGRID_API_KEY) {
  console.warn("WARNING: SENDGRID_API_KEY not found. Email functionality will not work properly.");
} else {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid email service initialized");
}

/**
 * Generate a password reset token
 * @param userId The user ID to associate with the token
 * @param expiresInMinutes How long the token is valid for (default: 30 minutes)
 * @returns The generated token
 */
export async function generatePasswordResetToken(userId: number, expiresInMinutes = 30): Promise<string> {
  // Generate a random token
  const token = randomBytes(32).toString('hex');
  
  // Calculate expiration date
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + expiresInMinutes);
  
  // Store the token in the database
  await db.insert(passwordResetTokens).values({
    token,
    userId,
    expires,
    used: false,
  });
  
  return token;
}

/**
 * Verify and retrieve user ID for a password reset token
 * @param token The token to verify
 * @returns The user ID if the token is valid, null otherwise
 */
export async function verifyPasswordResetToken(token: string): Promise<number | null> {
  // Find the token in the database
  const [tokenData] = await db.select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.used, false)
      )
    );
  
  // Check if token exists
  if (!tokenData) {
    return null;
  }
  
  // Check if token is expired
  if (new Date() > tokenData.expires) {
    // Mark the token as used (expired)
    await db.update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
    return null;
  }
  
  return tokenData.userId;
}

/**
 * Invalidate a password reset token after it's been used
 * @param token The token to invalidate
 */
export async function invalidatePasswordResetToken(token: string): Promise<void> {
  await db.update(passwordResetTokens)
    .set({ used: true })
    .where(eq(passwordResetTokens.token, token));
}

/**
 * Generate a user invitation token
 * @param role The role for the invited user
 * @param email The email address being invited
 * @param createdBy The user ID of the admin creating the invitation
 * @param expiresInDays How long the token is valid for (default: 7 days)
 * @returns The generated token
 */
export async function generateInviteToken(role: string, email: string, createdBy: number, expiresInDays = 7): Promise<string> {
  const token = randomBytes(32).toString('hex');
  
  // Calculate expiration date
  const expires = new Date();
  expires.setDate(expires.getDate() + expiresInDays);
  
  // Store the token in the database
  await db.insert(inviteTokens).values({
    token,
    role,
    email,
    expires,
    createdBy,
    used: false,
  });
  
  return token;
}

/**
 * Verify and retrieve information from an invitation token
 * @param token The token to verify
 * @returns The invitation details if the token is valid, null otherwise
 */
export async function verifyInviteToken(token: string): Promise<{ role: string, email: string } | null> {
  // Find the token in the database
  const [tokenData] = await db.select()
    .from(inviteTokens)
    .where(
      and(
        eq(inviteTokens.token, token),
        eq(inviteTokens.used, false)
      )
    );
  
  // Check if token exists
  if (!tokenData) {
    return null;
  }
  
  // Check if token is expired
  if (new Date() > tokenData.expires) {
    // Mark the token as used (expired)
    await db.update(inviteTokens)
      .set({ used: true })
      .where(eq(inviteTokens.token, token));
    return null;
  }
  
  return { 
    role: tokenData.role,
    email: tokenData.email
  };
}

/**
 * Invalidate an invitation token after it's been used
 * @param token The token to invalidate
 */
export async function invalidateInviteToken(token: string): Promise<void> {
  await db.update(inviteTokens)
    .set({ used: true })
    .where(eq(inviteTokens.token, token));
}

/**
 * Send a user invitation email
 * @param to The recipient's email address
 * @param role The role assigned to the user
 * @param invitePath The invitation path (e.g., /invite/token)
 * @param adminName Name of the admin sending the invitation
 * @param clientOrigin The origin provided by the client (optional)
 * @returns A promise that resolves when the email is sent
 */
export async function sendInviteEmail(
  to: string, 
  role: string, 
  invitePath: string, 
  adminName: string,
  clientOrigin?: string
): Promise<boolean> {
  // Get the appropriate origin (client-provided or fallback)
  const origin = clientOrigin || (process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
    : 'http://localhost:5000');
  
  const fullInviteLink = `${origin}${invitePath}`;
  
  // Format role for display (capitalize first letter)
  const displayRole = role.charAt(0).toUpperCase() + role.slice(1);
  
  // Always log the invite link for testing
  console.log('====== USER INVITATION LINK ======');
  console.log(`Email will be sent to: ${to}`);
  console.log(`Role: ${displayRole}`);
  console.log(`Using origin: ${origin}`);
  console.log(`Invite link: ${fullInviteLink}`);
  console.log(`Direct link to copy/paste: ${fullInviteLink}`);
  console.log('==================================');
  
  try {
    // Use a default verified SendGrid sender email if none is specified
    const senderEmail = process.env.SENDGRID_VERIFIED_SENDER || 'noreply@bookstud.io';
    console.log(`Using sender email: ${senderEmail}`);
    
    const msg = {
      to,
      from: senderEmail,
      subject: `You're invited to join BookStud.io as a ${displayRole}`,
      text: `${adminName} has invited you to join BookStud.io as a ${displayRole}. Please click the following link to create your account (valid for 7 days): ${fullInviteLink}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're invited to join BookStud.io</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 24px; text-align: center;">
                            <div style="width: 80px; height: 80px; margin: 0 auto 16px auto; background-color: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                                <img src="https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:3000'}/assets/logo.png" alt="BookStud.io Logo" style="height: 60px; width: auto;" />
                            </div>
                            <h1 style="background-color: rgba(0,0,0,0.3); color: #ffffff !important; font-size: 32px; font-weight: bold; margin: 0 0 8px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); -webkit-text-fill-color: #ffffff !important; mso-line-height-rule: exactly; padding: 8px 16px; border-radius: 4px; display: inline-block;">BookStud.io</h1>
                            <p style="background-color: rgba(0,0,0,0.2); color: #ffffff !important; font-size: 18px; margin: 0 0 16px 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.6); -webkit-text-fill-color: #ffffff !important; padding: 6px 12px; border-radius: 4px; display: inline-block;">You're Invited</p>
                            <a href="${fullInviteLink}" style="display: inline-block; background-color: #ffffff; color: #047857; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px;">Create Your Account</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;"><strong>${adminName}</strong> has invited you to join BookStud.io as a <strong>${displayRole}</strong>.</p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">BookStud.io is a comprehensive studio booking platform for broadcast facilities.</p>
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 24px 0;">
                                <p style="color: #15803d; font-size: 14px; margin: 0; font-weight: 500;">Role: ${displayRole}</p>
                            </div>
                            <p style="font-size: 14px; color: #6b7280; margin: 0;">This invitation will expire in 7 days. If you believe this was sent in error, you can safely ignore this email.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">This email was sent by BookStud.io &copy; ${new Date().getFullYear()} The Plex Studios</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `,
    };
    
    try {
      await mailService.send(msg);
      console.log('Invitation email sent successfully');
      return true;
    } catch (sendGridError: any) {
      console.error('SendGrid error sending invitation email:', sendGridError);
      
      // Log the detailed error information
      if (sendGridError.response) {
        console.error('SendGrid API error details:');
        console.error('Status code:', sendGridError.response.statusCode);
        console.error('Body:', sendGridError.response.body);
        console.error('Headers:', sendGridError.response.headers);
      }
      
      // Fallback to console for development, ensuring the link information is preserved
      console.log('\n===== FALLBACK EMAIL DELIVERY (EMAIL SERVICE ERROR) =====');
      console.log('Since email delivery failed, you can manually copy the invitation link:');
      console.log(`INVITATION LINK: ${fullInviteLink}`);
      console.log('==========================================================\n');
      
      return false;
    }
  } catch (error) {
    console.error('Error in sendInviteEmail function:', error);
    return false;
  }
}

/**
 * Send a password reset email
 * @param to The recipient's email address
 * @param resetPath The password reset path (e.g., /reset-password/token)
 * @param clientOrigin The origin provided by the client (optional)
 * @returns A promise that resolves when the email is sent
 */
export async function sendPasswordResetEmail(to: string, resetPath: string, clientOrigin?: string): Promise<boolean> {
  // Log the reset link info regardless of environment
  // Get the appropriate origin (client-provided or fallback)
  const origin = clientOrigin || (process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
    : 'http://localhost:5000');
  
  const fullResetLink = `${origin}${resetPath}`;
  
  // Always log the reset link for testing
  console.log('====== PASSWORD RESET LINK ======');
  console.log(`Email will be sent to: ${to}`);
  console.log(`Using origin: ${origin}`);
  console.log(`Reset link: ${fullResetLink}`);
  console.log(`Direct link to copy/paste: ${fullResetLink}`);
  console.log('=================================');
  
  try {
    // Use a default verified SendGrid sender email if none is specified
    const senderEmail = process.env.SENDGRID_VERIFIED_SENDER || 'noreply@bookstud.io';
    console.log(`Using sender email for password reset: ${senderEmail}`);
    
    const msg = {
      to,
      from: senderEmail,
      subject: 'Reset your BookStud.io password',
      text: `You requested a password reset for your BookStud.io account. Please click the following link to reset your password (valid for 30 minutes): ${fullResetLink}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BookStud.io Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px;">
                    <tr>
                        <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 32px 24px; text-align: center;">
                            <div style="width: 80px; height: 80px; margin: 0 auto 16px auto; background-color: #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
                                <img src="https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:3000'}/assets/logo.png" alt="BookStud.io Logo" style="height: 60px; width: auto;" />
                            </div>
                            <h1 style="background-color: rgba(0,0,0,0.3); color: #ffffff !important; font-size: 32px; font-weight: bold; margin: 0 0 8px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); -webkit-text-fill-color: #ffffff !important; mso-line-height-rule: exactly; padding: 8px 16px; border-radius: 4px; display: inline-block;">BookStud.io</h1>
                            <p style="background-color: rgba(0,0,0,0.2); color: #ffffff !important; font-size: 18px; margin: 0 0 16px 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.6); -webkit-text-fill-color: #ffffff !important; padding: 6px 12px; border-radius: 4px; display: inline-block;">Password Reset</p>
                            <a href="${fullResetLink}" style="display: inline-block; background-color: #ffffff; color: #1f2937; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Password</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">You requested a password reset for your BookStud.io account.</p>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">Please click the button above to reset your password. This link is valid for 30 minutes.</p>
                            <p style="font-size: 14px; color: #6b7280; margin: 0;">If you didn't request this password reset, you can safely ignore this email.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">This email was sent by BookStud.io &copy; ${new Date().getFullYear()} The Plex Studios</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
      `,
    };
    
    try {
      await mailService.send(msg);
      console.log('Password reset email sent successfully');
      return true;
    } catch (sendGridError: any) {
      console.error('SendGrid error sending password reset email:', sendGridError);
      
      // Log the detailed error information
      if (sendGridError.response) {
        console.error('SendGrid API error details:');
        console.error('Status code:', sendGridError.response.statusCode);
        console.error('Body:', sendGridError.response.body);
        console.error('Headers:', sendGridError.response.headers);
      }
      
      // Fallback to console for development, ensuring the link information is preserved
      console.log('\n===== FALLBACK EMAIL DELIVERY (EMAIL SERVICE ERROR) =====');
      console.log('Since email delivery failed, you can manually copy the reset link:');
      console.log(`RESET LINK: ${fullResetLink}`);
      console.log('==========================================================\n');
      
      return false;
    }
  } catch (error) {
    console.error('Error in sendPasswordResetEmail function:', error);
    return false;
  }
}