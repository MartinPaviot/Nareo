import { supabase } from './supabase';

/**
 * Track a visitor by adding them to the visitors table if they don't exist
 * @param userId - The user's UUID
 * @param email - The user's email address
 */
export async function trackVisitor(userId: string, email: string): Promise<void> {
  try {
    // Check if visitor already exists
    const { data: existingVisitor, error: selectError } = await supabase
      .from('visitors')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    // If visitor doesn't exist, insert them
    if (!existingVisitor && !selectError) {
      const { error: insertError } = await supabase
        .from('visitors')
        .insert([{
          user_id: userId,
          email: email,
        }]);

      if (insertError) {
        console.error('Error inserting visitor:', insertError);
      }
    }
  } catch (error) {
    console.error('Error tracking visitor:', error);
  }
}
