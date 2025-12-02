import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

// Price IDs from environment variables
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, plan, successUrl, cancelUrl } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    // Check if user already has an active premium subscription
    const supabase = getServiceSupabase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_expires_at')
      .eq('user_id', auth.user.id)
      .single();

    if (profile?.subscription_tier === 'premium') {
      const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
      const now = new Date();

      // If subscription is still active (not expired)
      if (!expiresAt || expiresAt > now) {
        return NextResponse.json(
          { error: 'You already have an active premium subscription', alreadySubscribed: true },
          { status: 400 }
        );
      }
    }

    // Validate plan type
    const selectedPlan = plan === 'monthly' ? 'monthly' : 'annual';
    const priceId = PRICE_IDS[selectedPlan];

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan or price not configured' }, { status: 400 });
    }

    // Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/courses/${courseId}/learn?payment=success`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/courses/${courseId}/learn?payment=cancelled`,
      client_reference_id: courseId,
      customer_email: auth.user.email,
      billing_address_collection: 'required',
      metadata: {
        userId: auth.user.id,
        courseId: courseId,
        plan: selectedPlan,
      },
      subscription_data: {
        metadata: {
          userId: auth.user.id,
          courseId: courseId,
          plan: selectedPlan,
        },
      },
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
