import { MailService } from '@sendgrid/mail';
import { randomBytes } from 'crypto';

// Initialize SendGrid
const mailService = new MailService();

// Check if SendGrid API key is available
if (!process.env.SENDGRID_API_KEY) {
  console.warn("WARNING: SENDGRID_API_KEY not found. Email functionality will not work properly.");
} else {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid email service initialized");
}

// In-memory store for password reset tokens (consider moving to the database in production)
const passwordResetTokens = new Map<string, { userId: number, expires: Date }>();

// In-memory store for user invitation tokens
const inviteTokens = new Map<string, { role: string, email: string, expires: Date, createdBy: number }>();

/**
 * Generate a password reset token
 * @param userId The user ID to associate with the token
 * @param expiresInMinutes How long the token is valid for (default: 30 minutes)
 * @returns The generated token
 */
export function generatePasswordResetToken(userId: number, expiresInMinutes = 30): string {
  // Generate a random token
  const token = randomBytes(32).toString('hex');
  
  // Calculate expiration date
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + expiresInMinutes);
  
  // Store the token
  passwordResetTokens.set(token, { userId, expires });
  
  return token;
}

/**
 * Verify and retrieve user ID for a password reset token
 * @param token The token to verify
 * @returns The user ID if the token is valid, null otherwise
 */
export function verifyPasswordResetToken(token: string): number | null {
  const tokenData = passwordResetTokens.get(token);
  
  // Check if token exists and is not expired
  if (!tokenData) {
    return null;
  }
  
  if (new Date() > tokenData.expires) {
    // Token has expired, remove it
    passwordResetTokens.delete(token);
    return null;
  }
  
  return tokenData.userId;
}

/**
 * Invalidate a password reset token after it's been used
 * @param token The token to invalidate
 */
export function invalidatePasswordResetToken(token: string): void {
  passwordResetTokens.delete(token);
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