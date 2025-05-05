# BookStud.io Email System

This document explains how the email system in BookStud.io works, particularly for user invitations and password resets.

## Overview

BookStud.io uses SendGrid for sending transactional emails. There are two primary types of emails sent:

1. **User Invitation Emails**: Sent when an admin invites a new user to join the system
2. **Password Reset Emails**: Sent when a user requests to reset their password

## Implementation Details

### Configuration

The email system uses the following environment variables:

- `SENDGRID_API_KEY`: API key for SendGrid service
- `SENDGRID_VERIFIED_SENDER`: Verified sender email address recognized by SendGrid

### Token Generation

Both invitation and password reset flows use secure tokens:

1. **Invitation Tokens**:
   - Generated with `generateInviteToken(role, email, createdBy)`
   - Stored in database with expiration date (default: 7 days)
   - Include user role and email information

2. **Password Reset Tokens**:
   - Generated with `generatePasswordResetToken(userId)`
   - Stored in database with expiration date (default: 30 minutes)
   - Associated with specific user account

### Email Delivery

Email delivery is handled in the `server/email.ts` module with these key functions:

- `sendInviteEmail(to, role, invitePath, adminName)`: Sends invitation emails
- `sendPasswordResetEmail(to, resetPath)`: Sends password reset emails

Both functions include fallback mechanisms that log the generated links to the console if email delivery fails, making it possible to test the system even when email delivery is unavailable.

### Token Verification & Security

- Tokens are verified using `verifyInviteToken(token)` and `verifyPasswordResetToken(token)`
- Both verification functions check that the token:
  - Exists in the database
  - Has not been used previously
  - Has not expired
- After a token is used, it's marked as such in the database using `invalidateInviteToken(token)` or `invalidatePasswordResetToken(token)`

### Error Handling

The email system includes robust error handling:

- Detailed error logging for SendGrid API errors
- Fallback console output of links when email delivery fails
- Clear user feedback in the UI for both successful and failed operations

## Testing

Two test scripts are available to verify email functionality:

1. `server/test-invite.ts`: Tests invitation email generation and delivery
2. `server/test-reset.ts`: Tests password reset email generation and delivery

Run these scripts with:
```bash
npx tsx server/test-invite.ts
npx tsx server/test-reset.ts
```

## Troubleshooting

If emails are not being delivered:

1. Check that `SENDGRID_API_KEY` is set correctly
2. Verify that `SENDGRID_VERIFIED_SENDER` contains an email that's verified in the SendGrid account
3. Look for detailed error messages in the console logs
4. Use the fallback links printed to the console for testing even when email delivery fails