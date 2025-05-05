# Email System in BookStud.io

The BookStud.io application integrates email functionality for user invitations and password reset features using SendGrid.

## Configuration

Email functionality requires the following environment variables:

- `SENDGRID_API_KEY`: Your SendGrid API key
- `SENDGRID_VERIFIED_SENDER`: The verified sender email address (default: alerts@obedtv.com)

These values should be set in your `.env` file or environment configuration.

## Features

### User Invitations

- Administrators can invite new users to the platform by sending invitation emails
- Each invitation includes a unique, secure token linked to the specified email address
- Tokens expire after 7 days for security
- Users can create an account with the appropriate role by clicking the link in the email

### Password Reset

- Users can request a password reset email from the login page
- Reset emails contain a secure, time-limited token valid for 30 minutes
- The system prevents token reuse for security

## Database Schema

The email system uses two dedicated database tables to store tokens securely:

### Password Reset Tokens

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  expires TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used BOOLEAN DEFAULT FALSE
);
```

### Invitation Tokens

```sql
CREATE TABLE IF NOT EXISTS invite_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  expires TIMESTAMP NOT NULL,
  created_by INTEGER REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used BOOLEAN DEFAULT FALSE
);
```

## Docker Deployment

When deploying with Docker, the database schema for these tables is automatically created during the deployment process using the `scripts/migrate-db.ts` script.

To deploy with Docker Compose:

1. Ensure your `.env` file contains the necessary SendGrid variables:
   ```
   SENDGRID_API_KEY=your_sendgrid_key
   SENDGRID_VERIFIED_SENDER=alerts@obedtv.com
   ```

2. Run the standard Docker Compose commands:
   ```bash
   docker-compose build  # Build the images
   docker-compose up -d  # Start the containers in detached mode
   ```

3. The database initialization container will automatically:
   - Create the required database tables including token tables
   - Initialize default data
   - Exit once complete, allowing the main application to start

## Backing Up Token Data

To ensure token data is not lost during deployments, the Docker configuration uses a named volume (`postgres_data`) to persist database data between container restarts:

```yaml
volumes:
  postgres_data:
```

To manually backup the database including token tables:

```bash
docker-compose exec db pg_dump -U postgres bookstudio > backup.sql
```

## Testing

For testing and development, the system includes fallback behavior when SendGrid is not configured:

- Test scripts in the `server` directory allow manual testing of the invite and reset functionality
- When SendGrid is unavailable, the system logs the generated links to the console

## Implementation Details

The email system is implemented using the following components:

1. Token generation and verification functions in `server/email.ts`
2. Database tables for storing tokens securely
3. API endpoints for requesting and processing reset/invite links
4. Email templates for a professional user experience

## Error Handling

The system includes comprehensive error handling:

- Failed email deliveries are logged
- Invalid or expired tokens are rejected with appropriate error messages
- Rate limiting on token generation prevents abuse

## Testing Tools

Two test scripts are available to verify email functionality:

- `server/test-invite.ts`: Tests the invitation email process
- `server/test-reset.ts`: Tests the password reset email process

## Mobile Support

The email system is fully responsive and works seamlessly on mobile devices:
- Password reset flows are mobile-optimized
- Invitation acceptance works flawlessly on smaller screens 
- Email templates are responsive for various device sizes