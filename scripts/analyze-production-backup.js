#!/usr/bin/env node

/**
 * BookStud.io - Production Backup Analysis
 * 
 * Analyzes the production backup to identify booking user_id corruption
 * and generates repair SQL statements based on real data patterns.
 * 
 * Usage: node scripts/analyze-production-backup.js
 */

import fs from 'fs';
import path from 'path';

const BACKUP_FILE = 'attached_assets/backup_20250803_225634_1754261804239.sql';

console.log('🔍 BookStud.io - Production Backup Analysis');
console.log('===========================================');

async function analyzeBackup() {
  try {
    console.log(`📄 Reading backup file: ${BACKUP_FILE}`);
    const backupContent = fs.readFileSync(BACKUP_FILE, 'utf8');
    
    // Extract users data
    const usersMatch = backupContent.match(/COPY public\.users.*?FROM stdin;\n([\s\S]*?)\n\\\./);
    if (!usersMatch) {
      throw new Error('Could not find users data in backup');
    }
    
    const users = [];
    const userLines = usersMatch[1].trim().split('\n');
    
    userLines.forEach(line => {
      if (line.trim()) {
        const parts = line.split('\t');
        users.push({
          id: parseInt(parts[0]),
          username: parts[1],
          email: parts[3],
          name: parts[4],
          role: parts[5]
        });
      }
    });
    
    console.log(`👥 Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`  - ${user.id}: ${user.username} (${user.name}) [${user.role}]`);
    });
    console.log('');
    
    // Extract bookings data
    const bookingsMatch = backupContent.match(/COPY public\.bookings.*?FROM stdin;\n([\s\S]*?)\n\\\./);
    if (!bookingsMatch) {
      throw new Error('Could not find bookings data in backup');
    }
    
    const bookings = [];
    const bookingLines = bookingsMatch[1].trim().split('\n');
    
    bookingLines.forEach(line => {
      if (line.trim()) {
        const parts = line.split('\t');
        bookings.push({
          id: parseInt(parts[0]),
          title: parts[1],
          description: parts[2] || '',
          studio_id: parts[3] === '\\N' ? null : parseInt(parts[3]),
          user_id: parseInt(parts[4]),
          start: parts[5],
          end: parts[6],
          type: parts[7],
          created_at: parts[11]
        });
      }
    });
    
    console.log(`📅 Found ${bookings.length} bookings`);
    
    // Analyze corruption
    const adminBookings = bookings.filter(b => b.user_id === 1);
    const otherBookings = bookings.filter(b => b.user_id !== 1);
    
    console.log(`\n📊 Corruption Analysis:`);
    console.log(`Total bookings: ${bookings.length}`);
    console.log(`Admin bookings (user_id = 1): ${adminBookings.length} (${((adminBookings.length / bookings.length) * 100).toFixed(1)}%)`);
    console.log(`Other user bookings: ${otherBookings.length} (${((otherBookings.length / bookings.length) * 100).toFixed(1)}%)`);
    console.log('');
    
    // Analyze patterns for potential fixes
    console.log('🔍 Pattern Analysis for Potential Fixes:');
    console.log('=======================================');
    
    const repairs = [];
    
    adminBookings.forEach(booking => {
      const suggestedUser = analyzebookingOwnership(booking, users);
      if (suggestedUser && suggestedUser.id !== 1) {
        repairs.push({
          booking,
          suggestedUser,
          reason: getRepairReason(booking, suggestedUser)
        });
      }
    });
    
    console.log(`\n📋 Potential Repairs (${repairs.length} bookings):`);
    console.log('===============================================');
    
    repairs.forEach((repair, index) => {
      console.log(`${index + 1}. Booking #${repair.booking.id}: "${repair.booking.title}"`);
      console.log(`   Current: Admin (user_id = 1)`);
      console.log(`   Suggested: ${repair.suggestedUser.username} (user_id = ${repair.suggestedUser.id})`);
      console.log(`   Reason: ${repair.reason}`);
      console.log('');
    });
    
    // Generate SQL repair script
    if (repairs.length > 0) {
      const sqlScript = generateRepairSQL(repairs);
      const scriptPath = 'scripts/repair-booking-ownership.sql';
      fs.writeFileSync(scriptPath, sqlScript);
      console.log(`📄 Generated SQL repair script: ${scriptPath}`);
      console.log(`⚠️  IMPORTANT: Review the script carefully before executing!`);
      console.log(`⚠️  BACKUP your database before applying any changes!`);
    }
    
    // Show examples of correctly assigned bookings
    console.log('\n✅ Examples of Correctly Assigned Bookings:');
    console.log('==========================================');
    otherBookings.slice(0, 10).forEach(booking => {
      const user = users.find(u => u.id === booking.user_id);
      console.log(`- #${booking.id}: "${booking.title}" → ${user ? user.username : 'Unknown'} (user_id = ${booking.user_id})`);
    });
    
  } catch (error) {
    console.error('❌ Error analyzing backup:', error.message);
  }
}

function analyzebookingOwnership(booking, users) {
  const title = booking.title.toLowerCase();
  const description = booking.description.toLowerCase();
  const text = `${title} ${description}`;
  
  // Skip legitimate admin bookings
  if (booking.type === 'maintenance' && 
      (text.includes('firewall') || text.includes('network') || text.includes('upgrade'))) {
    return null; // These are legitimately admin bookings
  }
  
  // Pattern 1: Trilogy-related bookings
  if (text.includes('trilogy') || text.includes('sara joyner') || text.includes('parke may')) {
    const trilogyUsers = users.filter(u => 
      u.username.includes('sarajoyner') || 
      u.username.includes('pmay') || 
      u.username.includes('ttucker') ||
      u.id === 22 || u.id === 23 || u.id === 24
    );
    if (trilogyUsers.length > 0) {
      // Prefer Sara Joyner for most Trilogy bookings
      return trilogyUsers.find(u => u.username.includes('sarajoyner')) || trilogyUsers[0];
    }
  }
  
  // Pattern 2: Stakelbeck Tonight - typically belongs to user 9 based on correct examples
  if (title.includes('stakelbeck tonight')) {
    const user9 = users.find(u => u.id === 9);
    if (user9) return user9;
  }
  
  // Pattern 3: Centerpoint News Updates - likely belongs to specific users
  if (title.includes('centerpoint news') || text.includes('blynda lane')) {
    const user8 = users.find(u => u.id === 8);
    if (user8) return user8;
  }
  
  // Pattern 4: Praise show - based on template data, likely user 9
  if (title.includes('praise') && booking.type === 'production') {
    const user9 = users.find(u => u.id === 9);
    if (user9) return user9;
  }
  
  // Pattern 5: Producer-specific content
  if (text.includes('shoot:') || text.includes('production company')) {
    const producers = users.filter(u => u.role === 'producer');
    if (producers.length > 0) {
      return producers[0]; // Return first available producer
    }
  }
  
  return null;
}

function getRepairReason(booking, user) {
  const title = booking.title.toLowerCase();
  const description = booking.description.toLowerCase();
  const text = `${title} ${description}`;
  
  if (text.includes('trilogy')) {
    return 'Trilogy-related booking should belong to Trilogy producer';
  }
  if (title.includes('stakelbeck tonight')) {
    return 'Stakelbeck Tonight typically belongs to this user based on correct examples';
  }
  if (title.includes('centerpoint news')) {
    return 'Centerpoint News Updates pattern match';
  }
  if (title.includes('praise')) {
    return 'Praise show booking pattern match';
  }
  if (text.includes('shoot:')) {
    return 'Production shoot should belong to producer';
  }
  
  return 'Pattern-based assignment';
}

function generateRepairSQL(repairs) {
  let sql = `-- BookStud.io Booking Ownership Repair Script
-- Generated: ${new Date().toISOString()}
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

`;

  repairs.forEach(repair => {
    sql += `-- Fix booking #${repair.booking.id}: "${repair.booking.title}"
-- Reason: ${repair.reason}
-- Current: user_id = 1 (admin) → New: user_id = ${repair.suggestedUser.id} (${repair.suggestedUser.username})
UPDATE bookings 
SET user_id = ${repair.suggestedUser.id} 
WHERE id = ${repair.booking.id} AND user_id = 1;

`;
  });

  sql += `-- Show final statistics after repair
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
`;

  return sql;
}

// Execute analysis
analyzeBackup();