import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
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
        await handleSuccessfulPayment(session);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session expired:', session.id);
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

async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const courseId = session.metadata?.courseId;

  if (!userId || !courseId) {
    console.error('Missing userId or courseId in session metadata');
    return;
  }

  const supabase = await createSupabaseServerClient();

  try {
    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: userId,
      course_id: courseId,
      stripe_session_id: session.id,
      amount_cents: session.amount_total || 0,
      currency: session.currency || 'eur',
      status: 'succeeded',
    });

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    // Update or insert user_course_access
    const { error: accessError } = await supabase
      .from('user_course_access')
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          access_tier: 'paid',
          granted_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,course_id',
        }
      );

    if (accessError) {
      console.error('Error granting course access:', accessError);
    }

    console.log(`Payment successful: User ${userId} granted paid access to course ${courseId}`);
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}
