#!/usr/bin/env node

/**
 * BookStud.io - Fix Booking User Ownership
 * 
 * This script fixes the data integrity issue where many bookings incorrectly
 * show user_id = 1 (admin) instead of the actual creator.
 * 
 * PROBLEM: 93.6% of bookings (117 out of 125) have user_id = 1 due to
 * migration scripts that defaulted user_id to admin when fields were null.
 * 
 * SOLUTION: Use intelligent pattern matching to identify likely creators
 * based on booking titles, descriptions, and user patterns.
 * 
 * Usage: node scripts/fix-booking-user-ownership.js [--dry-run] [--force]
 */

import { db } from '../server/db.js';

const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');

console.log('🔧 BookStud.io - Booking User Ownership Fix');
console.log('============================================');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE REPAIR'}`);
console.log('');

async function main() {
  try {
    console.log('📊 Analyzing current data integrity...');
    
    // Get corruption statistics
    const corruptionStats = await db.execute(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN user_id = 1 THEN 1 END) as admin_bookings,
        COUNT(CASE WHEN user_id != 1 THEN 1 END) as other_user_bookings,
        ROUND(COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as admin_percentage
      FROM bookings
    `);
    
    const stats = corruptionStats[0];
    console.log(`Total bookings: ${stats.total_bookings}`);
    console.log(`Admin bookings: ${stats.admin_bookings} (${stats.admin_percentage}%)`);
    console.log(`Other user bookings: ${stats.other_user_bookings}`);
    console.log('');
    
    if (stats.admin_percentage < 50) {
      console.log('✅ Data appears healthy (less than 50% admin ownership)');
      return;
    }
    
    console.log('🚨 DATA CORRUPTION DETECTED');
    console.log('More than 50% of bookings show admin ownership - this indicates corruption');
    console.log('');
    
    // Get all users for pattern matching
    const users = await db.execute('SELECT id, username, name FROM users ORDER BY id');
    
    console.log('👥 Available users for pattern matching:');
    users.forEach(user => {
      console.log(`  - ${user.id}: ${user.username} (${user.name})`);
    });
    console.log('');
    
    // Get corrupted bookings (those with user_id = 1 that might not belong to admin)
    const corruptedBookings = await db.execute(`
      SELECT id, title, description, user_id, created_at
      FROM bookings 
      WHERE user_id = 1
      ORDER BY created_at DESC
    `);
    
    console.log(`🔍 Analyzing ${corruptedBookings.length} potentially corrupted bookings...`);
    
    const repairs = [];
    
    for (const booking of corruptedBookings) {
      const suggestedUserId = findLikelyCreator(booking, users);
      
      if (suggestedUserId && suggestedUserId !== 1) {
        const user = users.find(u => u.id === suggestedUserId);
        repairs.push({
          bookingId: booking.id,
          title: booking.title,
          currentUserId: booking.user_id,
          suggestedUserId: suggestedUserId,
          suggestedUser: user,
          reason: getMatchReason(booking, user)
        });
      }
    }
    
    console.log(`\n📋 Found ${repairs.length} potential repairs:`);
    console.log('========================================');
    
    repairs.forEach((repair, index) => {
      console.log(`${index + 1}. Booking #${repair.bookingId}: "${repair.title}"`);
      console.log(`   Current: Admin (ID: 1)`);
      console.log(`   Suggested: ${repair.suggestedUser.username} (ID: ${repair.suggestedUserId})`);
      console.log(`   Reason: ${repair.reason}`);
      console.log('');
    });
    
    if (repairs.length === 0) {
      console.log('No clear patterns found for automatic repair.');
      console.log('Manual review may be required.');
      return;
    }
    
    if (isDryRun) {
      console.log('🔍 DRY RUN COMPLETE - No changes made');
      console.log(`Run without --dry-run to apply ${repairs.length} repairs`);
      return;
    }
    
    if (!isForce) {
      console.log('⚠️  To apply these changes, add --force flag');
      console.log('⚠️  BACKUP YOUR DATABASE FIRST!');
      return;
    }
    
    console.log('🔧 Applying repairs...');
    
    for (const repair of repairs) {
      try {
        await db.execute(
          'UPDATE bookings SET user_id = $1 WHERE id = $2',
          [repair.suggestedUserId, repair.bookingId]
        );
        console.log(`✅ Fixed booking #${repair.bookingId} → ${repair.suggestedUser.username}`);
      } catch (error) {
        console.error(`❌ Failed to fix booking #${repair.bookingId}:`, error.message);
      }
    }
    
    // Final statistics
    const finalStats = await db.execute(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN user_id = 1 THEN 1 END) as admin_bookings,
        ROUND(COUNT(CASE WHEN user_id = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as admin_percentage
      FROM bookings
    `);
    
    const final = finalStats[0];
    console.log('\n📊 Final statistics:');
    console.log(`Admin bookings: ${final.admin_bookings} (${final.admin_percentage}%)`);
    console.log(`Repaired: ${stats.admin_bookings - final.admin_bookings} bookings`);
    
    console.log('\n✅ Repair complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

/**
 * Attempt to identify the likely creator based on patterns
 */
function findLikelyCreator(booking, users) {
  const title = (booking.title || '').toLowerCase();
  const description = (booking.description || '').toLowerCase();
  const text = `${title} ${description}`;
  
  // Pattern 1: Direct username mentions
  for (const user of users) {
    if (user.id === 1) continue; // Skip admin
    
    const username = user.username.toLowerCase();
    const name = (user.name || '').toLowerCase();
    
    // Check for username in title/description
    if (text.includes(username) || text.includes(name.split(' ')[0])) {
      return user.id;
    }
  }
  
  // Pattern 2: Common naming patterns
  if (title.includes('osandoval') || text.includes('osandoval')) {
    const user = users.find(u => u.username.toLowerCase() === 'osandoval');
    if (user) return user.id;
  }
  
  if (title.includes('obedtest') || text.includes('obedtest')) {
    const user = users.find(u => u.username.toLowerCase().includes('obedtest'));
    if (user) return user.id;
  }
  
  // Pattern 3: Producer-specific content
  if (text.includes('trilogy') || text.includes('publishing') || text.includes('shoot:')) {
    // These likely belong to trilogy producers
    const trilogyUser = users.find(u => u.username.includes('sarajoyner') || u.username.includes('pmay'));
    if (trilogyUser) return trilogyUser.id;
  }
  
  // Pattern 4: Engineering/IT content
  if (text.includes('maintenance') || text.includes('system') || text.includes('network')) {
    const engineerUser = users.find(u => u.role === 'engineer' || u.role === 'it');
    if (engineerUser) return engineerUser.id;
  }
  
  return null; // No pattern found
}

/**
 * Get human-readable reason for the suggested match
 */
function getMatchReason(booking, user) {
  const title = (booking.title || '').toLowerCase();
  const description = (booking.description || '').toLowerCase();
  const text = `${title} ${description}`;
  
  if (text.includes(user.username.toLowerCase())) {
    return `Username "${user.username}" found in booking text`;
  }
  
  if (text.includes(user.name.toLowerCase().split(' ')[0])) {
    return `Name "${user.name}" found in booking text`;
  }
  
  if (text.includes('trilogy') && user.username.includes('trilogy')) {
    return 'Trilogy-related content matches trilogy user';
  }
  
  return 'Pattern-based match';
}

// Execute if run directly
main();