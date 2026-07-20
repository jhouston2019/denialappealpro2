import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { appAbsoluteUrl } from '@/lib/appUrl';
import {
  buildCheckoutSessionParams,
  isCheckoutPlanType,
  missingPriceEnvHint,
  checkoutLineItemForPlan,
  resolveStripePriceId,
  retrieveCheckoutPrice,
  validatePriceForCheckout,
} from '@/lib/billing/stripePlanPrices';

export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-11-17.clover';

function maskKeyPrefix(value: string | undefined, expectedPrefix: string) {
  if (!value?.trim()) return { present: false as const, prefix: '' };
  const v = value.trim();
  const ok = v.startsWith(expectedPrefix);
  return {
    present: true as const,
    prefix: v.length >= 12 ? `${v.slice(0, 8)}…${v.slice(-4)}` : '(too short)',
    looksLikeTestKey: ok,
  };
}

function stripeEnvDiagnostics() {
  const secret = process.env.STRIPE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const secretPrefix = secret?.trim().startsWith('sk_live_')
    ? 'sk_live_'
    : 'sk_test_';
  const publishablePrefix = publishable?.trim().startsWith('pk_live_')
    ? 'pk_live_'
    : 'pk_test_';
  return {
    STRIPE_SECRET_KEY: maskKeyPrefix(secret, secretPrefix),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: maskKeyPrefix(
      publishable,
      publishablePrefix
    ),
  };
}

export async function POST(request: NextRequest) {
  const envDiag = stripeEnvDiagnostics();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const appPublicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  try {
    if (!appPublicUrl || !/^https?:\/\//i.test(appPublicUrl)) {
      console.error(
        '[create-checkout-session] NEXT_PUBLIC_APP_URL must be an absolute URL (e.g. https://estimatereviewpro.com)'
      );
      return NextResponse.json(
        {
          error: 'App URL is not configured',
          details:
            'Set NEXT_PUBLIC_APP_URL to your production origin in Netlify (Site settings → Environment variables), redeploy. Trailing slash is optional.',
        },
        { status: 500 }
      );
    }

    if (!secretKey) {
      console.error(
        '[create-checkout-session] STRIPE_SECRET_KEY is missing or empty'
      );
      return NextResponse.json(
        {
          error: 'Stripe secret key is not configured',
          details:
            'Set STRIPE_SECRET_KEY in .env.local (sk_test_… or sk_live_…) and restart the dev server.',
          stripeEnv: envDiag,
        },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    const { planType } = await request.json();

    if (!planType || typeof planType !== 'string') {
      return NextResponse.json(
        { error: 'Missing planType' },
        { status: 400 }
      );
    }

    if (!isCheckoutPlanType(planType)) {
      return NextResponse.json(
        { error: 'Invalid plan type' },
        { status: 400 }
      );
    }

    const resolved = resolveStripePriceId(planType);
    if (!resolved) {
      console.error(
        `[create-checkout-session] No Stripe price ID for plan "${planType}"`
      );
      return NextResponse.json(
        {
          error: `Stripe price not configured for ${planType}`,
          details: missingPriceEnvHint(planType),
        },
        { status: 500 }
      );
    }

    let stripePrice: Stripe.Price;
    try {
      stripePrice = await retrieveCheckoutPrice(stripe, resolved.priceId);
    } catch (err) {
      console.error(
        `[create-checkout-session] Invalid price ${resolved.priceId} for ${planType}:`,
        err
      );
      return NextResponse.json(
        {
          error: `Stripe price not found for ${planType}`,
          details: `Check ${resolved.envKey}=${resolved.priceId} in Netlify matches a live-mode price in your Stripe Dashboard.`,
        },
        { status: 500 }
      );
    }

    const priceMismatch = validatePriceForCheckout(planType, stripePrice);
    if (priceMismatch) {
      return NextResponse.json(
        { error: priceMismatch, details: missingPriceEnvHint(planType) },
        { status: 500 }
      );
    }

    const successUrl = appAbsoluteUrl(
      'success?session_id={CHECKOUT_SESSION_ID}'
    );
    const cancelUrl = appAbsoluteUrl('cancel');

    const lineItem = checkoutLineItemForPlan(planType, stripePrice);
    const sessionConfig = buildCheckoutSessionParams(
      planType,
      lineItem,
      successUrl,
      cancelUrl
    );

    const checkoutSession = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    const payload: Record<string, unknown> = {
      error: 'Failed to create checkout session',
      stripeEnv: stripeEnvDiagnostics(),
    };

    if (error instanceof Stripe.errors.StripeError) {
      console.error('[create-checkout-session] Stripe API error:', {
        type: error.type,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        requestId: error.requestId,
        doc_url: error.doc_url,
      });
      payload.error = error.message;
      payload.stripeError = {
        type: error.type,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        requestId: error.requestId,
        doc_url: error.doc_url,
      };
    } else if (error instanceof Error) {
      console.error('[create-checkout-session] Error:', error.message, error.stack);
      payload.error = error.message;
      if (process.env.NODE_ENV === 'development') {
        payload.details = error.stack;
      }
    } else {
      console.error('[create-checkout-session] Unknown error:', error);
      payload.details = String(error);
    }

    return NextResponse.json(payload, { status: 500 });
  }
}
