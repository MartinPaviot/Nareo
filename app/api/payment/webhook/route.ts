import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
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
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(dispute);
        break;
      }
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeClosed(dispute);
        break;
      }
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionPaused(subscription);
        break;
      }
      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionResumed(subscription);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
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

  const supabase = getServiceSupabase();

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

    // Get customer email and name from session
    const customerEmail = session.customer_email || session.customer_details?.email || null;
    const customerName = session.customer_details?.name || null;

    console.log('Extracted IDs - customerId:', customerId, 'subscriptionId:', subscriptionId);
    console.log('Customer info - email:', customerEmail, 'name:', customerName);

    // Calculate subscription expiry based on plan
    // Monthly = 4 weeks (28 days), Annual = 52 weeks (364 days)
    const now = new Date();
    let expiresAt: Date;
    if (plan === 'annual') {
      expiresAt = new Date(now.getTime() + 52 * 7 * 24 * 60 * 60 * 1000); // 52 weeks
    } else {
      expiresAt = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000); // 4 weeks (28 days)
    }

    // First try to update existing profile
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    const profileData = {
      user_id: userId,
      email: customerEmail,
      full_name: customerName,
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
          email: customerEmail,
          full_name: customerName,
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

  const supabase = getServiceSupabase();

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

  const supabase = getServiceSupabase();

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

    const supabase = getServiceSupabase();

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

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log('=== CHARGE REFUNDED ===');
  console.log('Charge ID:', charge.id);
  console.log('Customer ID:', charge.customer);
  console.log('Refunded:', charge.refunded);
  console.log('Amount refunded:', charge.amount_refunded);

  // Get customer ID from charge
  const customerId = typeof charge.customer === 'string'
    ? charge.customer
    : charge.customer?.id;

  if (!customerId) {
    console.error('No customer ID found in refunded charge');
    return;
  }

  const supabase = getServiceSupabase();

  try {
    // Find user by stripe_customer_id
    const { data: profile, error: selectError } = await supabase
      .from('profiles')
      .select('user_id, subscription_tier')
      .eq('stripe_customer_id', customerId)
      .single();

    if (selectError || !profile) {
      console.error('Could not find user for customer:', customerId, selectError);
      return;
    }

    console.log('Found user:', profile.user_id, 'current tier:', profile.subscription_tier);

    // Only revoke if it's a full refund
    if (charge.refunded) {
      // Revoke premium access
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_expires_at: null,
          stripe_subscription_id: null,
        })
        .eq('user_id', profile.user_id);

      if (updateError) {
        console.error('Error revoking premium access:', updateError);
      } else {
        console.log(`SUCCESS: Premium access revoked for user ${profile.user_id} due to refund`);
      }

      // Update payment record status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('user_id', profile.user_id)
        .eq('status', 'succeeded')
        .order('created_at', { ascending: false })
        .limit(1);

      if (paymentError) {
        console.error('Error updating payment record:', paymentError);
      }
    } else {
      console.log('Partial refund detected, keeping premium access');
    }
  } catch (error) {
    console.error('Error handling charge refunded:', error);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log('=== DISPUTE CREATED (CHARGEBACK) ===');
  console.log('Dispute ID:', dispute.id);
  console.log('Reason:', dispute.reason);
  console.log('Amount:', dispute.amount);
  console.log('Status:', dispute.status);

  // Get charge to find customer
  const chargeId = typeof dispute.charge === 'string'
    ? dispute.charge
    : dispute.charge?.id;

  if (!chargeId) {
    console.error('No charge ID found in dispute');
    return;
  }

  const supabase = getServiceSupabase();

  try {
    // Get the charge to find the customer
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = typeof charge.customer === 'string'
      ? charge.customer
      : charge.customer?.id;

    if (!customerId) {
      console.error('No customer ID found in disputed charge');
      return;
    }

    // Find user by stripe_customer_id
    const { data: profile, error: selectError } = await supabase
      .from('profiles')
      .select('user_id, email, subscription_tier')
      .eq('stripe_customer_id', customerId)
      .single();

    if (selectError || !profile) {
      console.error('Could not find user for disputed customer:', customerId);
      return;
    }

    console.log('ALERT: Dispute/Chargeback for user:', profile.user_id, 'email:', profile.email);

    // Immediately suspend premium access when a dispute is opened
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: 'free',
        subscription_expires_at: null,
      })
      .eq('user_id', profile.user_id);

    if (updateError) {
      console.error('Error suspending access due to dispute:', updateError);
    } else {
      console.log(`Premium access suspended for user ${profile.user_id} due to chargeback`);
    }

    // Update payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .update({ status: 'disputed' })
      .eq('user_id', profile.user_id)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1);

    if (paymentError) {
      console.error('Error updating payment record for dispute:', paymentError);
    }
  } catch (error) {
    console.error('Error handling dispute created:', error);
  }
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  console.log('=== DISPUTE CLOSED ===');
  console.log('Dispute ID:', dispute.id);
  console.log('Status:', dispute.status);

  // Get charge to find customer
  const chargeId = typeof dispute.charge === 'string'
    ? dispute.charge
    : dispute.charge?.id;

  if (!chargeId) {
    console.error('No charge ID found in closed dispute');
    return;
  }

  const supabase = getServiceSupabase();

  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = typeof charge.customer === 'string'
      ? charge.customer
      : charge.customer?.id;

    if (!customerId) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) return;

    // If we won the dispute, we could restore access
    // But typically you'd want to manually review this
    if (dispute.status === 'won') {
      console.log(`Dispute won for user ${profile.user_id} - consider restoring access manually`);
      // Optionally restore access automatically:
      // await supabase.from('profiles').update({ subscription_tier: 'premium' }).eq('user_id', profile.user_id);
    } else if (dispute.status === 'lost') {
      console.log(`Dispute lost for user ${profile.user_id} - access remains revoked`);

      // Update payment record to refunded (lost dispute = money returned)
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('user_id', profile.user_id)
        .eq('status', 'disputed');
    }
  } catch (error) {
    console.error('Error handling dispute closed:', error);
  }
}

async function handleSubscriptionPaused(subscription: Stripe.Subscription) {
  console.log('=== SUBSCRIPTION PAUSED ===');
  console.log('Subscription ID:', subscription.id);

  // When paused, the user keeps access until the end of their paid period
  // The subscription_expires_at already tracks when their access ends
  // We just log this event - access will naturally expire at subscription_expires_at

  const userId = subscription.metadata?.userId;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!userId) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    if (!customerId) {
      console.error('Missing userId and customerId in paused subscription');
      return;
    }

    const supabase = getServiceSupabase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, subscription_expires_at')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) {
      console.error('Could not find user for paused subscription');
      return;
    }

    // Keep premium access until the paid period ends
    // Just ensure the expiry date is set correctly
    if (currentPeriodEnd) {
      await supabase
        .from('profiles')
        .update({
          subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
        })
        .eq('user_id', profile.user_id);
    }

    console.log(`Subscription paused for user ${profile.user_id} - access continues until ${profile.subscription_expires_at || new Date(currentPeriodEnd! * 1000).toISOString()}`);
    return;
  }

  const supabase = getServiceSupabase();

  try {
    // Keep premium, just ensure expiry is set
    if (currentPeriodEnd) {
      await supabase
        .from('profiles')
        .update({
          subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
        })
        .eq('user_id', userId);
    }

    console.log(`Subscription paused for user ${userId} - access continues until period end`);
  } catch (error) {
    console.error('Error handling subscription paused:', error);
  }
}

async function handleSubscriptionResumed(subscription: Stripe.Subscription) {
  console.log('=== SUBSCRIPTION RESUMED ===');
  console.log('Subscription ID:', subscription.id);

  const userId = subscription.metadata?.userId;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

  if (!userId) {
    // Try to find user by customer ID
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    if (!customerId) {
      console.error('Missing userId and customerId in resumed subscription');
      return;
    }

    const supabase = getServiceSupabase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!profile) {
      console.error('Could not find user for resumed subscription');
      return;
    }

    // Restore access
    await supabase
      .from('profiles')
      .update({
        subscription_tier: 'premium',
        ...(currentPeriodEnd && {
          subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
        }),
      })
      .eq('user_id', profile.user_id);

    console.log(`Subscription resumed for user ${profile.user_id}`);
    return;
  }

  const supabase = getServiceSupabase();

  try {
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
      console.error('Error resuming subscription:', error);
    }

    console.log(`Subscription resumed for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription resumed:', error);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('=== INVOICE PAID ===');
  console.log('Invoice ID:', invoice.id);
  console.log('Amount paid:', invoice.amount_paid);

  // This is similar to invoice.payment_succeeded but includes out-of-band payments
  // Get subscription ID from the invoice
  const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined;

  if (!subscriptionId) {
    console.log('No subscription associated with this invoice');
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;

    if (!userId) {
      // Try to find by customer ID
      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

      if (!customerId) return;

      const supabase = getServiceSupabase();
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!profile) return;

      const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'premium',
          ...(currentPeriodEnd && {
            subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
          }),
        })
        .eq('user_id', profile.user_id);

      console.log(`Invoice paid - subscription confirmed for user ${profile.user_id}`);
      return;
    }

    const supabase = getServiceSupabase();
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

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
      console.error('Error updating subscription from invoice.paid:', error);
    }

    console.log(`Invoice paid - subscription confirmed for user ${userId}`);
  } catch (error) {
    console.error('Error handling invoice paid:', error);
  }
}
