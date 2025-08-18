import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma, { updateUserPlan, getUserByEmail } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !endpointSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;

      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(deletedSubscription);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(failedInvoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const customerId = session.customer as string;

  if (!userId) return;

  try {
    // Get subscription details to determine plan
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const priceId = subscription.items.data[0]?.price.id;
      
      // Map price ID to plan (you'd set this up based on your Stripe price IDs)
      const planMapping = {
        'price_smart_monthly': 'SMART',
        'price_smart_yearly': 'SMART',
        'price_genius_monthly': 'GENIUS',
        'price_genius_yearly': 'GENIUS',
        'price_enterprise_monthly': 'ENTERPRISE',
        'price_enterprise_yearly': 'ENTERPRISE',
      };

      const plan = planMapping[priceId as keyof typeof planMapping] || 'FREE';

      // Update user's plan in database
      await updateUserPlan(userId, plan, {
        customerId,
        subscriptionId: subscription.id,
        priceId,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      console.log(`User ${userId} upgraded to ${plan} plan`);
    }
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    // Find user by Stripe customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (user) {
      const priceId = subscription.items.data[0]?.price.id;
      
      // Map price ID to plan
      const planMapping = {
        'price_smart_monthly': 'SMART',
        'price_smart_yearly': 'SMART',
        'price_genius_monthly': 'GENIUS',
        'price_genius_yearly': 'GENIUS',
        'price_enterprise_monthly': 'ENTERPRISE',
        'price_enterprise_yearly': 'ENTERPRISE',
      };

      const plan = planMapping[priceId as keyof typeof planMapping] || 'FREE';

      await updateUserPlan(user.id, plan, {
        subscriptionId: subscription.id,
        priceId,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      console.log(`User ${user.id} plan updated to ${plan}`);
    }
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  try {
    // Find user by Stripe customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (user) {
      // Downgrade to free plan
      await updateUserPlan(user.id, 'FREE', {
        subscriptionId: null,
        priceId: null,
        currentPeriodEnd: null,
      });

      console.log(`User ${user.id} downgraded to FREE plan`);
    }
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  try {
    // Find user by Stripe customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (user) {
      // Here you could:
      // 1. Send email notification
      // 2. Temporarily pause service
      // 3. Log the failed payment
      console.log(`Payment failed for user ${user.id} (${user.email})`);
      
      // For now, just log it. In production, you'd want to:
      // - Send email notification
      // - Set account to "past due" status
      // - Implement grace period logic
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}