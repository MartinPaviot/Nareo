import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.acacia' as any,
});

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Get user's subscription info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, subscription_tier, subscription_expires_at')
      .eq('user_id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 });
    }

    // Cancel the subscription at period end (user keeps access until expiry)
    const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update profile to reflect cancellation is pending
    await supabase
      .from('profiles')
      .update({
        subscription_cancel_at_period_end: true,
      })
      .eq('user_id', auth.user.id);

    return NextResponse.json({
      success: true,
      cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : profile.subscription_expires_at,
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
