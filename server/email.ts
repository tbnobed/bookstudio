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
 * @param resetLink The password reset link
 * @returns A promise that resolves when the email is sent
 */
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  try {
    const msg = {
      to,
      from: 'no-reply@bookstud.io', // Update with your verified sender
      subject: 'Reset your BookStud.io password',
      text: `You requested a password reset for your BookStud.io account. Please click the following link to reset your password (valid for 30 minutes): ${resetLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">BookStud.io Password Reset</h2>
          <p>You requested a password reset for your BookStud.io account.</p>
          <p>Please click the button below to reset your password. This link is valid for 30 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4a7aff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
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