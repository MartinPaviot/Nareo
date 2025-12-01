import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment failed:', invoice.id);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('=== CHECKOUT COMPLETED ===');
  console.log('Session ID:', session.id);
  console.log('Session metadata:', JSON.stringify(session.metadata));

  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan || 'monthly';

  if (!userId) {
    console.error('Missing userId in session metadata - metadata was:', session.metadata);
    return;
  }

  console.log('Processing payment for userId:', userId, 'plan:', plan);

  const supabase = await createSupabaseServerClient();

  try {
    // Get subscription details if it's a subscription checkout
    // Handle both string IDs and expanded objects
    let subscriptionId: string | null = null;
    let customerId: string | null = null;

    if (session.subscription) {
      subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    }

    if (session.customer) {
      customerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer.id;
    }

    console.log('Extracted IDs - customerId:', customerId, 'subscriptionId:', subscriptionId);

    // Calculate subscription expiry based on plan
    const now = new Date();
    let expiresAt: Date;
    if (plan === 'annual') {
      expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // First try to update existing profile
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    const profileData = {
      user_id: userId,
      subscription_tier: 'premium',
      subscription_started_at: now.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    };

    let profileError;

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'premium',
          subscription_started_at: now.toISOString(),
          subscription_expires_at: expiresAt.toISOString(),
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq('user_id', userId);
      profileError = error;
      console.log('Updated existing profile for user:', userId);
    } else {
      // Insert new profile
      const { error } = await supabase
        .from('profiles')
        .insert(profileData);
      profileError = error;
      console.log('Created new profile for user:', userId);
    }

    if (profileError) {
      console.error('Error saving profile subscription:', profileError);
    } else {
      console.log('SUCCESS: Profile saved to premium for user:', userId, 'with customerId:', customerId, 'subscriptionId:', subscriptionId);
    }

    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: userId,
      course_id: session.metadata?.courseId || null,
      stripe_session_id: session.id,
      amount_cents: session.amount_total || 0,
      currency: session.currency || 'eur',
      status: 'succeeded',
    });

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    console.log(`Subscription activated: User ${userId} is now premium (${plan})`);
  } catch (error) {
    console.error('Error handling checkout completed:', error);
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  const supabase = await createSupabaseServerClient();

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  // Get the current period end from the first subscription item
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: isActive ? 'premium' : 'free',
        stripe_subscription_id: subscription.id,
        ...(currentPeriodEnd && {
          subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
        }),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating subscription:', error);
    }

    console.log(`Subscription updated for user ${userId}: ${subscription.status}`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: 'free',
        stripe_subscription_id: null,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error canceling subscription:', error);
    }

    console.log(`Subscription canceled for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // This handles recurring payments (renewal)
  // In newer Stripe API versions, subscription is accessed via parent.subscription_details
  const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined;

  if (!subscriptionId) return;

  try {
    // Get subscription to find user
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;

    if (!userId) {
      console.error('Missing userId in subscription metadata for invoice');
      return;
    }

    const supabase = await createSupabaseServerClient();

    // Get the current period end from the first subscription item
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

    // Extend subscription expiry
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: 'premium',
        ...(currentPeriodEnd && {
          subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
        }),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error extending subscription:', error);
    }

    console.log(`Subscription renewed for user ${userId}`);
  } catch (error) {
    console.error('Error handling invoice payment:', error);
  }
}
