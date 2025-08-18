import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-12-18.acacia',
});

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { priceId, userId } = JSON.parse(event.body || '{}');

    if (!priceId || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' }),
      };
    }

    // For demo purposes, we'll simulate the checkout process
    // In production, you'd create real Stripe sessions
    const mockSession = {
      id: `cs_demo_${Date.now()}`,
      url: `/pricing?success=true&plan=${priceId}`,
      payment_status: 'paid',
    };

    return {
      statusCode: 200,
      body: JSON.stringify(mockSession),
    };

    // Real Stripe implementation would be:
    /*
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
      client_reference_id: userId,
      metadata: {
        userId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
    */
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create checkout session' }),
    };
  }
};