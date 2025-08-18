import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import Stripe from 'stripe';
import prisma, { updateUserPlan } from '../../src/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const body = event.body;
  const signature = event.headers['stripe-signature'];

  if (!signature || !endpointSecret || !body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing signature or body' }),
    };
  }

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
    };
  }
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const customerId = session.customer as string;

  if (!userId) return;

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const priceId = subscription.items.data[0]?.price.id;
      
      const planMapping = {
        'price_smart_monthly': 'SMART',
        'price_smart_yearly': 'SMART',
        'price_genius_monthly': 'GENIUS',
        'price_genius_yearly': 'GENIUS',
        'price_enterprise_monthly': 'ENTERPRISE',
        'price_enterprise_yearly': 'ENTERPRISE',
      };

      const plan = planMapping[priceId as keyof typeof planMapping] || 'FREE';

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
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (user) {
      const priceId = subscription.items.data[0]?.price.id;
      
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
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (user) {
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
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    });

    if (user) {
      console.log(`Payment failed for user ${user.id} (${user.email})`);
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}