# BookStud.io - Corruption Prevention Guide

## Problem Summary

A critical data integrity issue occurred where 62.8% of bookings (194 out of 309) were incorrectly assigned to admin (user_id = 1) instead of their actual creators. 

**CRITICAL DISCOVERY**: Backup comparison reveals this corruption existed since at least July 31st, 2025 (63.4% admin ownership), indicating it occurred during initial system setup or early migration work, not recent changes. This is a **legacy corruption issue** that needs immediate remediation.

## Root Cause

Migration scripts containing lines like:
```sql
UPDATE bookings SET user_id = 1 WHERE user_id IS NULL
```

This approach corrupted the ownership data, making it impossible for users to see their actual bookings and breaking the audit trail.

## Prevention Measures Implemented

### 1. Database Constraints (`scripts/prevent-user-corruption.sql`)

- **NOT NULL constraint** on user_id column
- **Foreign key constraint** ensuring valid user references  
- **Audit triggers** logging all user_id changes
- **Protection triggers** blocking mass admin assignments
- **Monitoring views** for ongoing health checks

### 2. Migration Best Practices

**DO:**
- Always preserve existing user_id values during schema changes
- Use explicit user context when creating bookings programmatically
- Test migrations on production data copies first
- Create database backups before any schema changes

**DON'T:**
- Never default user_id to 1 (admin) in migration scripts
- Never use `UPDATE ... SET user_id = 1 WHERE user_id IS NULL`
- Never assume admin should own orphaned records

### 3. Code-Level Safeguards

#### Backend API Protection

```javascript
// In booking creation APIs - always require authenticated user
app.post('/api/bookings', requireAuth, async (req, res) => {
  // NEVER default to admin
  const booking = {
    ...req.body,
    user_id: req.user.id, // Always use authenticated user
    created_at: new Date()
  };
  
  // Validate user_id is not admin unless explicitly admin action
  if (booking.user_id === 1 && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'Invalid user assignment' });
  }
  
  await storage.createBooking(booking);
});
```

#### Frontend Validation

```javascript
// In booking forms - validate user context
const createBooking = async (bookingData) => {
  // Ensure user is authenticated
  if (!user || !user.id) {
    throw new Error('User must be authenticated to create bookings');
  }
  
  // Never allow frontend to override user_id
  const safeBookingData = {
    ...bookingData,
    user_id: user.id // Always use current user
  };
  
  return apiRequest('POST', '/api/bookings', safeBookingData);
};
```

### 4. Monitoring & Detection

#### Daily Health Checks

```sql
-- Run this daily to monitor system health
SELECT * FROM daily_booking_health_check();
```

Expected output for healthy system:
- Admin percentage: < 20%
- Status: HEALTHY  
- No recent admin assignments for non-admin actions

#### Alert Thresholds

- **WARNING**: Admin owns > 30% of bookings
- **CRITICAL**: Admin owns > 50% of bookings
- **BLOCKED**: Prevents admin ownership > 60%

### 5. Recovery Process

If corruption is detected again:

1. **Immediate Response**
   ```sql
   -- Check corruption extent
   SELECT * FROM booking_ownership_health;
   ```

2. **Create Backup**
   ```bash
   pg_dump $DATABASE_URL > corruption_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Run Analysis**
   ```bash
   node scripts/analyze-production-backup.js
   ```

4. **Apply Fixes**
   ```sql
   -- Review and run generated repair script
   \i scripts/repair-booking-ownership.sql
   ```

### 6. Team Training

#### For Developers

- **Never hardcode user_id = 1** in any booking creation code
- **Always use req.user.id** from authenticated sessions
- **Test with multiple user accounts** to verify ownership
- **Review migration scripts** for potential user_id defaults

#### For Database Administrators

- **Always backup before migrations**
- **Never mass-update user_id** without explicit business justification
- **Monitor audit logs** for suspicious user_id changes
- **Run health checks** after any schema changes

### 7. Deployment Checklist

Before any production deployment involving user data:

- [ ] Database backup created
- [ ] Migration scripts reviewed for user_id defaults
- [ ] Health check baseline recorded
- [ ] Audit logging enabled
- [ ] Protection triggers active
- [ ] Rollback plan documented

### 8. Ongoing Maintenance

#### Weekly Tasks
- Review `booking_ownership_health` view
- Check audit logs for unusual patterns
- Monitor admin booking percentage trends

#### Monthly Tasks  
- Analyze user booking distribution
- Review and test backup/restore procedures
- Update corruption detection thresholds if needed

#### Quarterly Tasks
- Full data integrity audit
- Review and update prevention measures
- Team training refresh on best practices

## Emergency Contacts

If corruption is detected:
1. **Immediate**: Stop all booking creation/modification
2. **Create backup**: Preserve current state for analysis  
3. **Run diagnostics**: Use provided analysis scripts
4. **Contact team**: Alert development and database teams
5. **Execute repair**: Only after thorough review and testing

This prevention system ensures the booking ownership corruption cannot happen again while maintaining full auditability and system health monitoring.