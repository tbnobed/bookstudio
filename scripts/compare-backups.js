#!/usr/bin/env node

/**
 * BookStud.io - Backup Comparison Tool
 * 
 * Compares the July 31st backup (before corruption) with the August 3rd backup
 * to identify exactly when and how the user_id corruption occurred.
 * 
 * Usage: node scripts/compare-backups.js
 */

import fs from 'fs';

const BACKUP_BEFORE = 'attached_assets/backup_20250731_040001_1754262486866.sql';
const BACKUP_AFTER = 'attached_assets/backup_20250803_225634_1754261804239.sql';

console.log('🔍 BookStud.io - Backup Comparison Analysis');
console.log('==========================================');

function extractBookingsFromBackup(backupFile) {
  console.log(`📄 Reading backup: ${backupFile}`);
  const content = fs.readFileSync(backupFile, 'utf8');
  
  const bookingsMatch = content.match(/COPY public\.bookings.*?FROM stdin;\n([\s\S]*?)\n\\\./);
  if (!bookingsMatch) {
    throw new Error(`Could not find bookings data in ${backupFile}`);
  }
  
  const bookings = [];
  const lines = bookingsMatch[1].trim().split('\n');
  
  lines.forEach(line => {
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
  
  return bookings;
}

async function compareBackups() {
  try {
    console.log('📊 Extracting booking data from both backups...');
    
    const bookingsBefore = extractBookingsFromBackup(BACKUP_BEFORE);
    const bookingsAfter = extractBookingsFromBackup(BACKUP_AFTER);
    
    console.log(`\n📈 Backup Statistics:`);
    console.log(`Before (July 31): ${bookingsBefore.length} bookings`);
    console.log(`After (August 3): ${bookingsAfter.length} bookings`);
    console.log(`New bookings added: ${bookingsAfter.length - bookingsBefore.length}`);
    
    // Analyze user_id distribution in both backups
    const analyzeUserDistribution = (bookings, label) => {
      const userCounts = {};
      bookings.forEach(booking => {
        userCounts[booking.user_id] = (userCounts[booking.user_id] || 0) + 1;
      });
      
      const adminCount = userCounts[1] || 0;
      const adminPercentage = ((adminCount / bookings.length) * 100).toFixed(1);
      
      console.log(`\n${label}:`);
      console.log(`  Total bookings: ${bookings.length}`);
      console.log(`  Admin bookings: ${adminCount} (${adminPercentage}%)`);
      console.log(`  User distribution:`);
      
      Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([userId, count]) => {
          const percentage = ((count / bookings.length) * 100).toFixed(1);
          console.log(`    User ${userId}: ${count} bookings (${percentage}%)`);
        });
    };
    
    analyzeUserDistribution(bookingsBefore, '📅 BEFORE (July 31)');
    analyzeUserDistribution(bookingsAfter, '📅 AFTER (August 3)');
    
    // Find bookings that changed user_id
    console.log('\n🔄 BOOKINGS WITH CHANGED USER_ID:');
    console.log('================================');
    
    const changedBookings = [];
    const beforeMap = new Map(bookingsBefore.map(b => [b.id, b]));
    
    bookingsAfter.forEach(afterBooking => {
      const beforeBooking = beforeMap.get(afterBooking.id);
      if (beforeBooking && beforeBooking.user_id !== afterBooking.user_id) {
        changedBookings.push({
          id: afterBooking.id,
          title: afterBooking.title,
          beforeUserId: beforeBooking.user_id,
          afterUserId: afterBooking.user_id
        });
      }
    });
    
    if (changedBookings.length === 0) {
      console.log('✅ No existing bookings had user_id changes');
    } else {
      console.log(`⚠️  ${changedBookings.length} bookings had user_id changes:`);
      changedBookings.forEach(booking => {
        console.log(`  #${booking.id}: "${booking.title}"`);
        console.log(`    Before: user_id = ${booking.beforeUserId}`);
        console.log(`    After:  user_id = ${booking.afterUserId}`);
        console.log('');
      });
    }
    
    // Find new bookings added between backups
    console.log('\n➕ NEW BOOKINGS ADDED:');
    console.log('======================');
    
    const newBookings = bookingsAfter.filter(afterBooking => 
      !beforeMap.has(afterBooking.id)
    );
    
    if (newBookings.length === 0) {
      console.log('No new bookings added');
    } else {
      console.log(`${newBookings.length} new bookings added:`);
      
      const newByUser = {};
      newBookings.forEach(booking => {
        newByUser[booking.user_id] = (newByUser[booking.user_id] || 0) + 1;
      });
      
      console.log('\nNew bookings by user:');
      Object.entries(newByUser)
        .sort(([,a], [,b]) => b - a)
        .forEach(([userId, count]) => {
          console.log(`  User ${userId}: ${count} new bookings`);
        });
      
      // Show some examples of new admin bookings (potential corruption source)
      const newAdminBookings = newBookings.filter(b => b.user_id === 1);
      if (newAdminBookings.length > 0) {
        console.log(`\n⚠️  ${newAdminBookings.length} new bookings assigned to admin:`);
        newAdminBookings.slice(0, 5).forEach(booking => {
          console.log(`  #${booking.id}: "${booking.title}" (${booking.type})`);
        });
        if (newAdminBookings.length > 5) {
          console.log(`  ... and ${newAdminBookings.length - 5} more`);
        }
      }
    }
    
    // Timeline analysis
    console.log('\n📅 CORRUPTION TIMELINE ANALYSIS:');
    console.log('================================');
    
    const beforeAdminCount = bookingsBefore.filter(b => b.user_id === 1).length;
    const afterAdminCount = bookingsAfter.filter(b => b.user_id === 1).length;
    const beforeAdminPercent = ((beforeAdminCount / bookingsBefore.length) * 100).toFixed(1);
    const afterAdminPercent = ((afterAdminCount / bookingsAfter.length) * 100).toFixed(1);
    
    console.log(`Before July 31: ${beforeAdminCount}/${bookingsBefore.length} admin bookings (${beforeAdminPercent}%)`);
    console.log(`After August 3: ${afterAdminCount}/${bookingsAfter.length} admin bookings (${afterAdminPercent}%)`);
    
    if (parseFloat(afterAdminPercent) > parseFloat(beforeAdminPercent) + 10) {
      console.log('🚨 SIGNIFICANT INCREASE in admin ownership detected!');
      console.log('This confirms corruption occurred between July 31 and August 3');
    } else if (changedBookings.length > 0) {
      console.log('⚠️  Some user_id changes detected - investigate individual changes');
    } else {
      console.log('ℹ️  No major corruption detected in existing bookings');
      console.log('   Corruption may be limited to new bookings created with wrong user_id');
    }
    
    // Generate summary report
    console.log('\n📋 SUMMARY REPORT:');
    console.log('==================');
    console.log(`• Time period: July 31 → August 3, 2025`);
    console.log(`• Total bookings before: ${bookingsBefore.length}`);
    console.log(`• Total bookings after: ${bookingsAfter.length}`);
    console.log(`• New bookings added: ${newBookings.length}`);
    console.log(`• Existing bookings changed: ${changedBookings.length}`);
    console.log(`• Admin ownership change: ${beforeAdminPercent}% → ${afterAdminPercent}%`);
    
    if (parseFloat(afterAdminPercent) > 50) {
      console.log(`• CORRUPTION STATUS: 🚨 CRITICAL - ${afterAdminPercent}% admin ownership`);
    } else if (parseFloat(afterAdminPercent) > 30) {
      console.log(`• CORRUPTION STATUS: ⚠️  WARNING - ${afterAdminPercent}% admin ownership`);
    } else {
      console.log(`• CORRUPTION STATUS: ✅ HEALTHY - ${afterAdminPercent}% admin ownership`);
    }
    
  } catch (error) {
    console.error('❌ Error comparing backups:', error.message);
  }
}

// Execute comparison
compareBackups();