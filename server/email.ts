import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { passwordResetTokens, inviteTokens } from '../shared/schema';
import { sendEmail } from './services/emailService';

/**
 * Get the application URL for email links
 */
export function getApplicationUrl(): string {
  // Check for production domain first (clean domain without port)
  if (process.env.APP_DOMAIN) {
    return `https://${process.env.APP_DOMAIN}`;
  }
  
  // For Replit development, use the Replit domain
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) {
    return `https://${replitDomain}`;
  }
  
  // Fallback to localhost for local development
  return 'http://localhost:5000';
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
  // Use production-safe domain resolution
  const getApplicationUrl = () => {
    if (process.env.APP_DOMAIN) return process.env.APP_DOMAIN;
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',').map(d => d.trim());
      return `https://${domains[0]}`;
    }
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    return `http://localhost:${process.env.PORT || 5000}`;
  };
  const origin = clientOrigin || getApplicationUrl();
  
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
    
    // Get logo URL using consistent domain resolution
    const getApplicationUrl = () => {
      // Prioritize custom production domain first - clean domain without ports
      if (process.env.APP_DOMAIN) {
        return process.env.APP_DOMAIN;
      }
      if (process.env.REPLIT_DOMAINS) {
        const domains = process.env.REPLIT_DOMAINS.split(',').map(d => d.trim());
        return `https://${domains[0]}`;
      }
      if (process.env.REPLIT_DEV_DOMAIN) {
        return `https://${process.env.REPLIT_DEV_DOMAIN}`;
      }
      // Fallback for local development only
      const port = process.env.PORT || 5000;
      return `http://localhost:${port}`;
    };
    const logoUrl = `${getApplicationUrl()}/assets/logo.png`;
    
    // Create modern HTML content for invitation
    const htmlContent = `
                    <tr>
                        <td style="padding: 32px 24px; text-align: center;">
                            <div style="width: 100px; height: 100px; margin: 0 auto 24px auto; background-color: #ffffff; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(0,0,0,0.3);">
                                <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto;" />
                            </div>
                            <a href="${fullInviteLink}" style="display: inline-block; background-color: #ffffff; color: #1f2937; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">Accept Invitation</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <h2 style="color: #1f2937; font-size: 24px; font-weight: 700; margin: 0 0 20px 0;">You're invited to join BookStud.io</h2>
                            
                            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">${adminName} has invited you to join BookStud.io as a <strong>${displayRole}</strong>.</p>
                            
                            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <p style="color: #1f2937; font-size: 14px; margin: 0 0 12px 0;"><strong>Role:</strong> ${displayRole}</p>
                                <p style="color: #1f2937; font-size: 14px; margin: 0 0 12px 0;"><strong>Invited by:</strong> ${adminName}</p>
                                <p style="color: #1f2937; font-size: 14px; margin: 0;"><strong>Valid for:</strong> 7 days</p>
                            </div>
                            
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${fullInviteLink}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; border: 2px solid #1d4ed8;">Accept Invitation & Create Account</a>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">If you can't click the button above, copy and paste this link into your browser: ${fullInviteLink}</p>
                            <p style="color: #6b7280; font-size: 14px; margin: 20px 0;">This invitation will expire in 7 days for security purposes.</p>
                        </td>
                    </tr>`;

  const text = `
    You have been invited to join BookStud.io!
    
    ${adminName} has invited you to join BookStud.io as a ${role}.
    
    BookStud.io is a comprehensive studio booking platform for broadcast facilities.
    
    Please click this link to accept your invitation and create your account:
    ${fullInviteLink}
    
    This invitation will expire in 7 days for security purposes.
    
    If you believe this was sent in error, you can safely ignore this email.
    
    Thank you,
    BookStud.io Team
  `;

  const msg = {
    to: to,
    from: senderEmail,
    subject: 'You\'re invited to join BookStud.io',
    text,
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
                    ${htmlContent}
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
</html>`,
  };
    
    try {
      const emailSent = await sendEmail(msg.from, {
        to: msg.to,
        from: msg.from,
        subject: msg.subject,
        text: msg.text,
        html: msg.html
      });
      
      if (emailSent) {
        console.log('Invitation email sent successfully');
        return true;
      } else {
        throw new Error('Email service returned false');
      }
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
  // Use production-safe domain resolution
  const getApplicationUrl = () => {
    if (process.env.APP_DOMAIN) return process.env.APP_DOMAIN;
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',').map(d => d.trim());
      return `https://${domains[0]}`;
    }
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    return `http://localhost:${process.env.PORT || 5000}`;
  };
  const origin = clientOrigin || getApplicationUrl();
  
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
    
    // Get logo URL using consistent domain resolution
    const logoUrl = `${origin}/assets/logo.png`;
    
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
                        <td style="padding: 32px 24px; text-align: center;">
                            <img src="${logoUrl}" alt="BookStud.io Logo" style="height: 128px; width: auto; margin-bottom: 24px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">You requested a password reset for your BookStud.io account.</p>
                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${fullResetLink}" style="display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Reset Password</a>
                            </div>
                            <p style="font-size: 16px; line-height: 1.7; color: #374151; margin: 0 0 24px 0;">This link is valid for 30 minutes.</p>
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
      const emailSent = await sendEmail(msg.from, {
        to: msg.to,
        from: msg.from,
        subject: msg.subject,
        text: msg.text,
        html: msg.html
      });
      
      if (emailSent) {
        console.log('Password reset email sent successfully');
        return true;
      } else {
        throw new Error('Email service returned false');
      }
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