# BookStud.io Deployment on Replit

This guide provides step-by-step instructions for deploying BookStud.io directly on Replit.

## 1. Preparing for Deployment

### Check Your Project

Before deployment, make sure:

- All your code changes are saved
- Your database is properly configured and working
- The application runs correctly in the Replit environment
- Your public calendar routing configuration is complete if needed

### Fix Any Errors

Run the application with the "Start application" workflow and verify there are no errors in the console.

## 2. Database Preparation

Ensure your database schema is ready for production:

1. Make sure your database is created and connected:

```bash
bash -c 'echo "SELECT current_database();" | psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE'
```

2. If needed, run the database migration scripts:

```bash
node scripts/fix-db-all.js
```

## 3. Configure Environment Variables

Check that all necessary environment variables are set in Replit's Secrets tab:

1. Required secrets:
   - `DATABASE_URL` (should be set automatically by Replit)
   - `PGUSER` (should be set automatically by Replit)
   - `PGPASSWORD` (should be set automatically by Replit)
   - `PGDATABASE` (should be set automatically by Replit)
   - `PGHOST` (should be set automatically by Replit)
   - `PGPORT` (should be set automatically by Replit)

2. Additional secrets if using email functionality:
   - `SENDGRID_API_KEY` (your SendGrid API key)
   - `SENDGRID_VERIFIED_SENDER` (your verified sender email)

3. Optional configuration:
   - `SESSION_SECRET` (for secure sessions)
   - `TZ=America/Chicago` (timezone setting)
   - `FACILITY_TIMEZONE=America/Chicago` (facility timezone setting)

## 4. Build Your Application

While Replit handles most of this automatically, if needed, you can manually build:

```bash
npm run build
```

## 5. Deploy on Replit

1. Click the "Deploy" button at the top of your Replit workspace

2. In the deployment settings:
   - Set a custom domain if you have one
   - Configure any deployment-specific settings
   - Review your environment variables

3. Click "Deploy" to start the deployment process

4. Replit will:
   - Build your application
   - Configure networking
   - Start your app in production mode

## 6. After Deployment

Once your application is deployed:

1. Test all major functionality:
   - Log in using an admin account
   - Create and edit bookings
   - Check the public calendar
   - Verify studio status display

2. Check that mobile redirection works correctly:
   - Access /public-calendar from mobile and desktop devices
   - Verify each redirects to the appropriate version

3. Set up any additional monitoring if needed

## 7. Troubleshooting Common Issues

If you encounter issues with your deployment:

### Application Not Loading

- Check the deployment logs for errors
- Verify the database connection is working
- Make sure all necessary environment variables are set

### Database Errors

- Run the database repair script:
  ```bash
  node scripts/fix-db-all.js
  ```

### Mobile Redirection Not Working

- Check browser console for any JavaScript errors
- Verify that the redirection logic in PublicCalendarPage.tsx is correct
- Make sure the mobile detection is working in the useDevice hook

### Missing Environment Variables

- Add any missing variables in the Replit Secrets tab
- Restart your application after adding new secrets

## 8. Updating Your Deployment

To update your deployment after making changes:

1. Make and test your changes in the development environment
2. Commit your changes (if using version control)
3. Click the "Deploy" button again to redeploy with your changes

## 9. Additional Resources

- [Replit Deployment Documentation](https://docs.replit.com/hosting/deployments/about-deployments)
- [PostgreSQL on Replit](https://docs.replit.com/hosting/databases/postgresql-on-replit)
- [Environment Variables on Replit](https://docs.replit.com/programming-ide/storing-sensitive-information-environment-variables)

## 10. Support

For additional support, please contact the development team or open an issue in the project repository.