/**
 * CHECK REVIEW ACCESS API
 * Verifies user has available review credits before upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteHandlerClient } from '@/lib/supabaseServer';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const authClient = await createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user can create review
    const { data: canCreate, error } = await (supabase as any)
      .rpc('can_user_create_review', { user_id_param: userId });

    if (error) {
      console.error('[CHECK-ACCESS] Error:', error);
      return NextResponse.json(
        { error: 'Failed to check access' },
        { status: 500 }
      );
    }

    if (!canCreate) {
      // Get usage details for better error message
      const { data: usageData } = await (supabase as any)
        .rpc('get_user_plan_usage', { user_id_param: userId });

      if (!usageData || usageData.length === 0) {
        return NextResponse.json({
          hasAccess: false,
          reason: 'no_plan',
          message: 'No active subscription or credits. Please purchase a plan to continue.',
          redirectUrl: '/pricing',
        });
      }

      const usage = usageData[0];

      return NextResponse.json({
        hasAccess: false,
        reason: 'limit_reached',
        message: `You've used all ${usage.reviews_limit} reviews for this billing period. Resets on ${new Date(usage.billing_period_end).toLocaleDateString()}.`,
        planName: usage.plan_name,
        reviewsUsed: usage.reviews_used,
        reviewsLimit: usage.reviews_limit,
        billingPeriodEnd: usage.billing_period_end,
        redirectUrl: '/pricing',
      });
    }

    // Get usage details for display
    const { data: usageData } = await (supabase as any)
      .rpc('get_user_plan_usage', { user_id_param: userId });

    const usage = usageData?.[0];

    return NextResponse.json({
      hasAccess: true,
      planName: usage?.plan_name,
      reviewsUsed: usage?.reviews_used || 0,
      reviewsLimit: usage?.reviews_limit,
      reviewsRemaining: usage?.reviews_remaining,
    });

  } catch (error) {
    console.error('[CHECK-ACCESS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
