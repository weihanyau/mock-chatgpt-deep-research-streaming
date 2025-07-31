// migrate-db.js - Run this script if you have existing data with userId field
import { connect, getMessagesCollection } from './db.js';

async function migrateData() {
  try {
    await connect();
    console.log('✅ Connected to MongoDB');
    
    const messagesCollection = getMessagesCollection();
    
    // Update all documents that have userId but not researchId
    const result = await messagesCollection.updateMany(
      { 
        userId: { $exists: true }, 
        researchId: { $exists: false } 
      },
      { 
        $rename: { userId: 'researchId' } 
      }
    );
    
    console.log(`✅ Migrated ${result.modifiedCount} documents from userId to researchId`);
    
    // Optional: Remove any remaining userId fields
    await messagesCollection.updateMany(
      { userId: { $exists: true } },
      { $unset: { userId: 1 } }
    );
    
    console.log('✅ Migration completed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
