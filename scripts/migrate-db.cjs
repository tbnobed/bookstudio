// CommonJS version for database migrations in Docker environment
const { db } = require('./db.cjs');

async function migrateDb() {
  console.log('Running database migrations...');
  
  try {
    // Check if notification_groups table exists already
    const notificationGroupsExist = await checkTableExists('notification_groups');
    
    if (!notificationGroupsExist) {
      console.log('Creating notification groups...');
      
      // Create default notification groups
      const defaultGroups = [
        {
          name: 'Engineering Alerts',
          email: 'engineering@bookstud.io',
          groupType: 'engineering',
          description: 'Technical alerts for engineering team',
          enabled: true
        },
        {
          name: 'Producer Notifications',
          email: 'producers@bookstud.io',
          groupType: 'producer',
          description: 'Booking updates for production team',
          enabled: true
        },
        {
          name: 'IT Support',
          email: 'it@bookstud.io',
          groupType: 'support',
          description: 'IT support notifications',
          enabled: true
        },
        {
          name: 'All Users',
          email: 'users@bookstud.io',
          groupType: 'all',
          description: 'Announcements for all users',
          enabled: true
        }
      ];
      
      for (const group of defaultGroups) {
        await db.insert(db.notificationGroups).values(group);
      }
      
      console.log('Default notification groups created successfully');
    } else {
      console.log('Notification groups table already exists, skipping creation');
    }
    
    console.log('Database migrations completed successfully');
  } catch (err) {
    console.error('Error during database migrations:', err);
    process.exit(1);
  }
}

// Helper function to check if a table exists
async function checkTableExists(tableName) {
  try {
    // Using raw SQL query to check if table exists
    const result = await db.execute(
      `SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = $1
      )`,
      [tableName]
    );
    
    return result[0].exists;
  } catch (err) {
    console.error(`Error checking if table ${tableName} exists:`, err);
    return false;
  }
}

// Run the migrations
migrateDb()
  .then(() => {
    console.log('Database migrations completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database migrations failed:', err);
    process.exit(1);
  });