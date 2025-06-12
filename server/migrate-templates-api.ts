import { Request, Response } from 'express';
import { storage } from './storage';

/**
 * API endpoint to migrate production templates
 * This runs the migration logic through the web application
 */
export async function migrateTemplatesApi(req: Request, res: Response) {
  try {
    console.log('🔧 Starting template migration check...');
    
    // Get all current templates
    const templates = await storage.getAllTemplates();
    console.log(`📋 Found ${templates.length} templates to analyze`);
    
    let migratedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const template of templates) {
      console.log(`\n🔍 Analyzing template: ${template.name} (ID: ${template.id})`);
      
      // Check if template needs migration
      let needsUpdate = false;
      const updates: any = {};
      
      // Check studioIds format
      if (typeof template.studioIds === 'string') {
        try {
          const parsed = JSON.parse(template.studioIds);
          if (Array.isArray(parsed)) {
            updates.studioIds = parsed;
            needsUpdate = true;
            console.log(`  ✓ Converting studioIds from string to array: ${template.studioIds} -> ${JSON.stringify(parsed)}`);
          }
        } catch (e) {
          console.log(`  ⚠️ Could not parse studioIds: ${template.studioIds}`);
        }
      } else if (Array.isArray(template.studioIds)) {
        console.log(`  ✓ studioIds already correct: ${JSON.stringify(template.studioIds)}`);
      }
      
      // Ensure other fields are set
      if (!template.status) {
        updates.status = 'confirmed';
        needsUpdate = true;
        console.log(`  ✓ Setting default status: confirmed`);
      }
      
      if (!template.color) {
        updates.color = '#3259f5';
        needsUpdate = true;
        console.log(`  ✓ Setting default color: #3259f5`);
      }
      
      if (needsUpdate) {
        console.log(`  🔄 Updating template ${template.id}...`);
        await storage.updateTemplate(template.id, updates);
        migratedCount++;
        console.log(`  ✅ Template ${template.id} updated successfully`);
      } else {
        alreadyCorrectCount++;
        console.log(`  ✅ Template ${template.id} already properly formatted`);
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`  - Templates migrated: ${migratedCount}`);
    console.log(`  - Templates already correct: ${alreadyCorrectCount}`);
    console.log(`  - Total templates: ${templates.length}`);
    
    res.json({
      success: true,
      message: 'Template migration completed successfully',
      summary: {
        migrated: migratedCount,
        alreadyCorrect: alreadyCorrectCount,
        total: templates.length
      }
    });
    
  } catch (error) {
    console.error('❌ Template migration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Template migration failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}