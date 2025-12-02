import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.acacia' as any,
});

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
};

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { newPlan } = await request.json();

    if (!newPlan || !['monthly', 'annual'].includes(newPlan)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Get user's current subscription info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, subscription_tier, subscription_expires_at')
      .eq('user_id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 });
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

    if (subscription.status !== 'active') {
      return NextResponse.json({ error: 'L\'abonnement n\'est pas actif' }, { status: 400 });
    }

    // Get current price to determine current plan
    const currentPriceId = subscription.items.data[0]?.price.id;
    const newPriceId = PRICE_IDS[newPlan as keyof typeof PRICE_IDS];

    if (currentPriceId === newPriceId) {
      return NextResponse.json({ error: 'Tu es déjà sur ce plan' }, { status: 400 });
    }

    // Step 1: Cancel current subscription at period end
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Update profile to reflect pending cancellation
    await supabase
      .from('profiles')
      .update({
        subscription_cancel_at_period_end: true,
        pending_plan_change: newPlan, // Store the pending new plan
      })
      .eq('user_id', auth.user.id);

    // Step 2: Create a checkout session for the new plan
    // This will start billing after the current period ends
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: newPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/compte?plan_changed=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/compte?plan_changed=cancelled`,
      customer: profile.stripe_customer_id || undefined,
      customer_email: !profile.stripe_customer_id ? auth.user.email : undefined,
      subscription_data: {
        // Start billing after current subscription ends
        billing_cycle_anchor: currentPeriodEnd,
        metadata: {
          userId: auth.user.id,
          plan: newPlan,
          isPlanChange: 'true',
        },
      },
      metadata: {
        userId: auth.user.id,
        plan: newPlan,
        isPlanChange: 'true',
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    });
  } catch (error: any) {
    console.error('Error changing subscription plan:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du changement de plan' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch current plan details
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, subscription_tier, pending_plan_change')
      .eq('user_id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    if (!profile.stripe_subscription_id || profile.subscription_tier !== 'premium') {
      return NextResponse.json({ currentPlan: null });
    }

    // Get subscription from Stripe to determine current plan
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const currentPriceId = subscription.items.data[0]?.price.id;

    let currentPlan: 'monthly' | 'annual' | null = null;
    if (currentPriceId === PRICE_IDS.monthly) {
      currentPlan = 'monthly';
    } else if (currentPriceId === PRICE_IDS.annual) {
      currentPlan = 'annual';
    }

    return NextResponse.json({
      currentPlan,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      pendingPlanChange: profile.pending_plan_change,
    });
  } catch (error: any) {
    console.error('Error fetching subscription plan:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération du plan' },
      { status: 500 }
    );
  }
}
