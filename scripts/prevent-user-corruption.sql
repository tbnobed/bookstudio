-- BookStud.io - Database Constraints to Prevent User Corruption
-- 
-- This script adds database constraints and triggers to prevent the booking
-- user_id corruption from happening again in the future.
--
-- Run this AFTER fixing the existing corruption with repair-booking-ownership.sql

BEGIN;

-- 1. Add NOT NULL constraint to user_id column (if not already present)
-- This prevents NULL values that might get defaulted to admin
ALTER TABLE bookings 
ALTER COLUMN user_id SET NOT NULL;

-- 2. Add foreign key constraint to ensure user_id references valid users
-- This prevents invalid user IDs and ensures referential integrity
ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Create audit trigger to log all user_id changes
-- This helps track any future corruption or suspicious changes
CREATE OR REPLACE FUNCTION audit_booking_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log any changes to user_id in bookings
    IF OLD.user_id != NEW.user_id THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            details,
            user_id,
            created_at
        ) VALUES (
            'bookings',
            NEW.id,
            'user_id_change',
            json_build_object(
                'old_user_id', OLD.user_id,
                'new_user_id', NEW.user_id,
                'booking_title', NEW.title,
                'changed_at', NOW()
            ),
            NEW.user_id,
            NOW()
        );
        
        -- Log warning if changing to admin (user_id = 1)
        IF NEW.user_id = 1 AND OLD.user_id != 1 THEN
            INSERT INTO audit_logs (
                table_name,
                record_id,
                action,
                details,
                user_id,
                created_at
            ) VALUES (
                'bookings',
                NEW.id,
                'WARNING_admin_assignment',
                json_build_object(
                    'warning', 'Booking assigned to admin - potential corruption',
                    'previous_user_id', OLD.user_id,
                    'booking_title', NEW.title,
                    'flagged_at', NOW()
                ),
                NEW.user_id,
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS booking_user_audit_trigger ON bookings;
CREATE TRIGGER booking_user_audit_trigger
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION audit_booking_user_changes();

-- 4. Add check constraint to prevent mass assignment to admin
-- This constraint allows admin bookings but prevents bulk corruption
CREATE OR REPLACE FUNCTION check_admin_booking_limit()
RETURNS TRIGGER AS $$
DECLARE
    admin_booking_count INTEGER;
    total_booking_count INTEGER;
    admin_percentage DECIMAL;
BEGIN
    -- Only check if assigning to admin (user_id = 1)
    IF NEW.user_id = 1 THEN
        -- Get current statistics
        SELECT 
            COUNT(CASE WHEN user_id = 1 THEN 1 END),
            COUNT(*),
            ROUND(COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*), 2)
        INTO admin_booking_count, total_booking_count, admin_percentage
        FROM bookings;
        
        -- If admin already has more than 40% of bookings, raise warning
        -- (40% is chosen as threshold - legitimate admin bookings should be much lower)
        IF admin_percentage > 40 THEN
            RAISE WARNING 'HIGH ADMIN BOOKING PERCENTAGE: Admin owns %.2f%% of bookings. Potential corruption detected.', admin_percentage;
        END IF;
        
        -- If trying to exceed 60%, block the operation
        IF admin_percentage > 60 THEN
            RAISE EXCEPTION 'BLOCKED: Admin ownership would exceed 60%% (currently %.2f%%). This indicates data corruption. Contact system administrator.', admin_percentage;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the protection trigger
DROP TRIGGER IF EXISTS admin_booking_protection_trigger ON bookings;
CREATE TRIGGER admin_booking_protection_trigger
    BEFORE INSERT OR UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION check_admin_booking_limit();

-- 5. Create monitoring view for ongoing corruption detection
CREATE OR REPLACE VIEW booking_ownership_health AS
SELECT 
    COUNT(*) as total_bookings,
    COUNT(CASE WHEN user_id = 1 THEN 1 END) as admin_bookings,
    COUNT(CASE WHEN user_id != 1 THEN 1 END) as user_bookings,
    ROUND(COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as admin_percentage,
    CASE 
        WHEN COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*) > 50 THEN 'CRITICAL'
        WHEN COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*) > 30 THEN 'WARNING'
        ELSE 'HEALTHY'
    END as health_status,
    NOW() as checked_at
FROM bookings;

-- 6. Create daily monitoring function (can be called by cron job)
CREATE OR REPLACE FUNCTION daily_booking_health_check()
RETURNS TABLE(status TEXT, admin_percentage DECIMAL, recommendation TEXT) AS $$
DECLARE
    health_record RECORD;
BEGIN
    SELECT * INTO health_record FROM booking_ownership_health;
    
    status := health_record.health_status;
    admin_percentage := health_record.admin_percentage;
    
    IF health_record.health_status = 'CRITICAL' THEN
        recommendation := 'URGENT: Run corruption analysis script immediately. Admin owns ' || health_record.admin_percentage || '% of bookings.';
    ELSIF health_record.health_status = 'WARNING' THEN
        recommendation := 'Monitor closely. Admin owns ' || health_record.admin_percentage || '% of bookings - higher than expected.';
    ELSE
        recommendation := 'System healthy. Admin owns ' || health_record.admin_percentage || '% of bookings.';
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Show current health status after applying protections
SELECT * FROM booking_ownership_health;

-- Usage examples:
-- 
-- Check health manually:
-- SELECT * FROM daily_booking_health_check();
--
-- Monitor admin assignments over time:
-- SELECT * FROM audit_logs WHERE action LIKE '%admin%' ORDER BY created_at DESC LIMIT 10;
--
-- View recent user_id changes:
-- SELECT * FROM audit_logs WHERE action = 'user_id_change' ORDER BY created_at DESC LIMIT 20;