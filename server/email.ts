import { MailService } from '@sendgrid/mail';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
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
      eq(passwordResetTokens.token, token) && 
      eq(passwordResetTokens.used, false)
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
      eq(inviteTokens.token, token) && 
      eq(inviteTokens.used, false)
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
    const msg = {
      to,
      from: 'alerts@obedtv.com',
      subject: `You're invited to join BookStud.io as a ${displayRole}`,
      text: `${adminName} has invited you to join BookStud.io as a ${displayRole}. Please click the following link to create your account (valid for 7 days): ${fullInviteLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You're invited to join BookStud.io</h2>
          <p>${adminName} has invited you to join BookStud.io as a <strong>${displayRole}</strong>.</p>
          <p>BookStud.io is a comprehensive studio booking platform for broadcast facilities.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${fullInviteLink}" style="background-color: #4a7aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Create Your Account</a>
          </div>
          <p>This invitation will expire in 7 days. If you believe this was sent in error, you can safely ignore this email.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #777; font-size: 12px;">BookStud.io - Studio Management System</p>
        </div>
      `,
    };
    
    await mailService.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending invitation email:', error);
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
    
    // In production, we would use SendGrid
    const msg = {
      to,
      from: 'alerts@obedtv.com', // This should be a verified sender in your SendGrid account
      subject: 'Reset your BookStud.io password',
      text: `You requested a password reset for your BookStud.io account. Please click the following link to reset your password (valid for 30 minutes): ${fullResetLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">BookStud.io Password Reset</h2>
          <p>You requested a password reset for your BookStud.io account.</p>
          <p>Please click the button below to reset your password. This link is valid for 30 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${fullResetLink}" style="background-color: #4a7aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you didn't request this password reset, you can safely ignore this email.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #777; font-size: 12px;">BookStud.io - Studio Management System</p>
        </div>
      `,
    };
    
    await mailService.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}