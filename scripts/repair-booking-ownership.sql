-- BookStud.io Booking Ownership Repair Script
-- Generated: 2025-08-03T23:01:42.089Z
-- 
-- This script fixes booking user_id corruption where bookings were
-- incorrectly assigned to admin (user_id = 1) instead of actual creators.
--
-- IMPORTANT: 
-- 1. BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT
-- 2. Review each UPDATE statement carefully
-- 3. Test on a copy of production data first
--

BEGIN;

-- Show current corruption statistics
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN user_id = 1 THEN 1 END) as admin_bookings,
  ROUND(COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as admin_percentage
FROM bookings;

-- Fix booking #218: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 218 AND user_id = 1;

-- Fix booking #492: "SHOOT: Team People Car Shoot"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 492 AND user_id = 1;

-- Fix booking #501: "Trilogy: TBN Eschatology Project"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 501 AND user_id = 1;

-- Fix booking #242: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 242 AND user_id = 1;

-- Fix booking #484: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 484 AND user_id = 1;

-- Fix booking #202: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 202 AND user_id = 1;

-- Fix booking #493: "SHOOT: Team People Car Shoot"
-- Reason: Production shoot should belong to producer
-- Current: user_id = 1 (admin) → New: user_id = 16 (Grace W)
UPDATE bookings 
SET user_id = 16 
WHERE id = 493 AND user_id = 1;

-- Fix booking #446: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 446 AND user_id = 1;

-- Fix booking #445: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 445 AND user_id = 1;

-- Fix booking #454: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 454 AND user_id = 1;

-- Fix booking #447: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 447 AND user_id = 1;

-- Fix booking #448: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 448 AND user_id = 1;

-- Fix booking #449: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 449 AND user_id = 1;

-- Fix booking #450: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 450 AND user_id = 1;

-- Fix booking #451: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 451 AND user_id = 1;

-- Fix booking #456: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 456 AND user_id = 1;

-- Fix booking #452: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 452 AND user_id = 1;

-- Fix booking #453: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 453 AND user_id = 1;

-- Fix booking #455: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 455 AND user_id = 1;

-- Fix booking #441: "Trilogy: RED Camera Event"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 441 AND user_id = 1;

-- Fix booking #503: "(TENT) Trilogy: Think Branded Media Shoot CAT"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 503 AND user_id = 1;

-- Fix booking #504: "(TENT) Trilogy: Think Branded Media Shoot CAT"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 504 AND user_id = 1;

-- Fix booking #461: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 461 AND user_id = 1;

-- Fix booking #462: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 462 AND user_id = 1;

-- Fix booking #463: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 463 AND user_id = 1;

-- Fix booking #464: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 464 AND user_id = 1;

-- Fix booking #487: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 487 AND user_id = 1;

-- Fix booking #373: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 373 AND user_id = 1;

-- Fix booking #465: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 465 AND user_id = 1;

-- Fix booking #466: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 466 AND user_id = 1;

-- Fix booking #372: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 372 AND user_id = 1;

-- Fix booking #467: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 467 AND user_id = 1;

-- Fix booking #468: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 468 AND user_id = 1;

-- Fix booking #469: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 469 AND user_id = 1;

-- Fix booking #470: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 470 AND user_id = 1;

-- Fix booking #471: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 471 AND user_id = 1;

-- Fix booking #472: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 472 AND user_id = 1;

-- Fix booking #473: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 473 AND user_id = 1;

-- Fix booking #474: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 474 AND user_id = 1;

-- Fix booking #475: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 475 AND user_id = 1;

-- Fix booking #476: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 476 AND user_id = 1;

-- Fix booking #512: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 512 AND user_id = 1;

-- Fix booking #53: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 53 AND user_id = 1;

-- Fix booking #436: "Trilogy Shoot: Psychia"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 436 AND user_id = 1;

-- Fix booking #437: "Trilogy Shoot: Psychia"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 437 AND user_id = 1;

-- Fix booking #477: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 477 AND user_id = 1;

-- Fix booking #478: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 478 AND user_id = 1;

-- Fix booking #479: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 479 AND user_id = 1;

-- Fix booking #438: "TRILOGY: FM Creator Camp"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 438 AND user_id = 1;

-- Fix booking #439: "Trilogy: RED Camera Prep Day"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 439 AND user_id = 1;

-- Fix booking #103: "Praise Test"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 103 AND user_id = 1;

-- Fix booking #398: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 398 AND user_id = 1;

-- Fix booking #399: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 399 AND user_id = 1;

-- Fix booking #498: "Trilogy: TBN Eschatology Project"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 498 AND user_id = 1;

-- Fix booking #217: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 217 AND user_id = 1;

-- Fix booking #204: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 204 AND user_id = 1;

-- Fix booking #433: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 433 AND user_id = 1;

-- Fix booking #214: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 214 AND user_id = 1;

-- Fix booking #206: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 206 AND user_id = 1;

-- Fix booking #211: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 211 AND user_id = 1;

-- Fix booking #219: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 219 AND user_id = 1;

-- Fix booking #243: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 243 AND user_id = 1;

-- Fix booking #246: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 246 AND user_id = 1;

-- Fix booking #237: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 237 AND user_id = 1;

-- Fix booking #240: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 240 AND user_id = 1;

-- Fix booking #247: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 247 AND user_id = 1;

-- Fix booking #221: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 221 AND user_id = 1;

-- Fix booking #222: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 222 AND user_id = 1;

-- Fix booking #239: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 239 AND user_id = 1;

-- Fix booking #245: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 245 AND user_id = 1;

-- Fix booking #241: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 241 AND user_id = 1;

-- Fix booking #248: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 248 AND user_id = 1;

-- Fix booking #215: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 215 AND user_id = 1;

-- Fix booking #223: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 223 AND user_id = 1;

-- Fix booking #216: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 216 AND user_id = 1;

-- Fix booking #226: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 226 AND user_id = 1;

-- Fix booking #249: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 249 AND user_id = 1;

-- Fix booking #205: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 205 AND user_id = 1;

-- Fix booking #224: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 224 AND user_id = 1;

-- Fix booking #210: "Centerpoint News Updates"
-- Reason: Centerpoint News Updates pattern match
-- Current: user_id = 1 (admin) → New: user_id = 8 (DHarvilla)
UPDATE bookings 
SET user_id = 8 
WHERE id = 210 AND user_id = 1;

-- Fix booking #244: "Stakelbeck Tonight"
-- Reason: Stakelbeck Tonight typically belongs to this user based on correct examples
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 244 AND user_id = 1;

-- Fix booking #442: "Trilogy Event: AAF + DPA Mixer"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 442 AND user_id = 1;

-- Fix booking #435: "Trilogy Shoot: Psychia"
-- Reason: Trilogy-related booking should belong to Trilogy producer
-- Current: user_id = 1 (admin) → New: user_id = 23 (sarajoyner66)
UPDATE bookings 
SET user_id = 23 
WHERE id = 435 AND user_id = 1;

-- Fix booking #181: "Praise"
-- Reason: Praise show booking pattern match
-- Current: user_id = 1 (admin) → New: user_id = 9 (LMercado@tbn.tv)
UPDATE bookings 
SET user_id = 9 
WHERE id = 181 AND user_id = 1;

-- Show final statistics after repair
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN user_id = 1 THEN 1 END) as admin_bookings,
  ROUND(COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as admin_percentage
FROM bookings;

-- Show bookings by user after repair
SELECT 
  u.username,
  u.name,
  COUNT(b.id) as booking_count
FROM users u
LEFT JOIN bookings b ON u.id = b.user_id
GROUP BY u.id, u.username, u.name
ORDER BY booking_count DESC;

COMMIT;

-- If you need to rollback, uncomment the line below:
-- ROLLBACK;
