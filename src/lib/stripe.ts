import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_demo_key'
    );
  }
  return stripePromise;
};

// Price IDs for different plans (these would be from your Stripe dashboard)
export const STRIPE_PLANS = {
  SMART: {
    monthly: 'price_smart_monthly',
    yearly: 'price_smart_yearly',
  },
  GENIUS: {
    monthly: 'price_genius_monthly', 
    yearly: 'price_genius_yearly',
  },
  ENTERPRISE: {
    monthly: 'price_enterprise_monthly',
    yearly: 'price_enterprise_yearly',
  },
};

export const formatPrice = (amount: number, currency: string = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
};

export const createCheckoutSession = async (priceId: string, userId: string) => {
  try {
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
      }),
    });

    const session = await response.json();
    
    if (response.ok) {
      return session;
    } else {
      throw new Error(session.error || 'Failed to create checkout session');
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

export const createBillingPortalSession = async (customerId: string) => {
  try {
    const response = await fetch('/api/stripe/create-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
      }),
    });

    const session = await response.json();
    
    if (response.ok) {
      return session;
    } else {
      throw new Error(session.error || 'Failed to create portal session');
    }
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
};