/**
 * Apply migration 027 - Update graphic types constraint
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🔧 Applying migration 027: Update graphic types constraint\n');

  try {
    // Step 1: Drop old constraint
    console.log('1️⃣ Dropping old CHECK constraint...');
    const { error: dropError } = await admin.rpc('exec_sql', {
      sql: 'ALTER TABLE public.course_graphics DROP CONSTRAINT IF EXISTS course_graphics_graphic_type_check;'
    });

    if (dropError) {
      console.error('❌ Error dropping constraint:', dropError.message);
      // Continue anyway - constraint might not exist
    } else {
      console.log('   ✅ Old constraint dropped\n');
    }

    // Step 2: Add new constraint with all V2 types
    console.log('2️⃣ Adding new CHECK constraint with V2 types...');

    const newConstraint = `
      ALTER TABLE public.course_graphics
      ADD CONSTRAINT course_graphics_graphic_type_check CHECK (graphic_type IN (
        'supply_demand_curve',
        'equilibrium_graph',
        'surplus_graph',
        'elasticity_graph',
        'shift_graph',
        'histogram',
        'pie_chart',
        'line_chart',
        'scatter_plot',
        'flow_diagram',
        'tree_diagram',
        'venn_diagram',
        'table',
        'formula_visual',
        'concept_map',
        'timeline',
        'other',
        'courbe_offre_demande',
        'diagramme_flux',
        'organigramme',
        'tableau',
        'autre'
      ));
    `;

    const { error: addError } = await admin.rpc('exec_sql', { sql: newConstraint });

    if (addError) {
      console.error('❌ Error adding constraint:', addError.message);
      throw addError;
    }

    console.log('   ✅ New constraint added\n');

    console.log('✅ Migration 027 applied successfully!\n');
    console.log('📝 You can now re-run the graphics analysis with V2 types.\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n📝 Manual fix required:');
    console.log('\nRun this SQL in Supabase SQL Editor:');
    console.log('─'.repeat(79));
    console.log(readFileSync('database/migrations/027_update_graphic_types.sql', 'utf-8'));
    console.log('─'.repeat(79));
    process.exit(1);
  }
}

applyMigration();
