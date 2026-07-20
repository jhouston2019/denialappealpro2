import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createSupabaseRouteHandlerClient } from '@/lib/supabaseServer';
import { getBillingSnapshot } from '@/lib/billing/getBillingSnapshot';
import { incrementUserReviewUsage } from '@/lib/billing/incrementUserReviewUsage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-11-17.clover',
  });

  try {
    const authClient = await createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const {
      estimateName,
      estimateType,
      damageType,
      estimateText,
      claimNumber,
      propertyAddress,
      dateOfLoss,
      insuranceCarrier,
      platform,
      vertical,
    } = await request.json();

    if (!estimateName || !estimateText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SERVER-SIDE USAGE ENFORCEMENT
    const { data: permissionData, error: permissionError } = await supabase
      .rpc('can_create_review', { p_user_id: userId });

    if (permissionError) {
      console.error('Permission check error:', permissionError);
      return NextResponse.json(
        { error: 'Permission check failed' },
        { status: 500 }
      );
    }

    const permission = permissionData as any;

    // Check if user is not allowed to create review
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.message || 'Not allowed to create review' },
        { status: 403 }
      );
    }

    if (!permission.preview_only) {
      const usageSnap = await getBillingSnapshot(authClient, userId);
      if (
        usageSnap.reviews_limit > 0 &&
        usageSnap.usage >= usageSnap.reviews_limit
      ) {
        return NextResponse.json(
          { error: 'Review limit reached' },
          { status: 403 }
        );
      }
    }

    // If preview only, create report but don't increment usage
    if (permission.preview_only) {
      // Create report (unpaid)
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          user_id: userId,
          estimate_name: estimateName,
          estimate_type: estimateType,
          damage_type: damageType,
          result_json: {
            // Placeholder - actual AI analysis would go here
            status: 'preview',
            message: 'Preview mode - payment required for full export',
            vertical: vertical || '',
            property_details: {
              claim_number: claimNumber || '',
              address: propertyAddress || '',
              date_of_loss: dateOfLoss || '',
              adjuster: insuranceCarrier || '',
              total_estimate_value: 0,
              affected_areas: []
            },
            classification: {
              platform: platform || 'UNKNOWN',
              estimate_type: estimateType || 'insurance_claim',
              confidence: 0
            }
          },
          paid_single_use: false,
        })
        .select()
        .single();

      if (reportError) {
        return NextResponse.json(
          { error: 'Failed to create report' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        reportId: report.id,
        previewOnly: true,
        requiresPayment: true,
      });
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('team_id, plan_type')
      .eq('id', userId)
      .single();

    // Handle single plan users
    if (user?.plan_type === 'single') {
      // Create report for single plan user
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { data: report, error: reportError } = await supabase
        .from('reports')
        .insert({
          user_id: userId,
          estimate_name: estimateName,
          estimate_type: estimateType,
          damage_type: damageType,
          result_json: {
            // Placeholder - actual AI analysis would go here
            status: 'complete',
            plan_type: 'single',
            vertical: vertical || '',
            property_details: {
              claim_number: claimNumber || '',
              address: propertyAddress || '',
              date_of_loss: dateOfLoss || '',
              adjuster: insuranceCarrier || '',
              total_estimate_value: 0,
              affected_areas: []
            },
            classification: {
              platform: platform || 'UNKNOWN',
              estimate_type: estimateType || 'insurance_claim',
              confidence: 0
            }
          },
          paid_single_use: true,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (reportError) {
        return NextResponse.json(
          { error: 'Failed to create report' },
          { status: 500 }
        );
      }

      // Remove single plan access after use
      await supabase
        .from('users')
        .update({ plan_type: null })
        .eq('id', userId);

      await incrementUserReviewUsage(supabase, userId, 1);

      return NextResponse.json({
        success: true,
        reportId: report.id,
        previewOnly: false,
        planType: 'single',
      });
    }

    // User has subscription - check usage
    if (!user?.team_id) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 403 }
      );
    }

    // Check if overage
    const isOverage = permission.is_overage;

    // Increment usage (handles overage counting automatically)
    await supabase.rpc('increment_team_usage', { p_team_id: user.team_id });

    await incrementUserReviewUsage(
      supabase,
      userId,
      permission.review_limit ?? 0
    );

    // If overage, bill immediately
    if (isOverage) {
      await billOverage(supabase, stripe, user.team_id, permission.overage_price);
    }

    // Create report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        user_id: userId,
        team_id: user.team_id,
        estimate_name: estimateName,
        estimate_type: estimateType,
        damage_type: damageType,
        result_json: {
          // Placeholder - actual AI analysis would go here
          status: 'complete',
          reviewCount: permission.review_count + 1,
          reviewLimit: permission.review_limit,
          isOverage: isOverage,
          vertical: vertical || '',
          property_details: {
            claim_number: claimNumber || '',
            address: propertyAddress || '',
            date_of_loss: dateOfLoss || '',
            adjuster: insuranceCarrier || '',
            total_estimate_value: 0,
            affected_areas: []
          },
          classification: {
            platform: platform || 'UNKNOWN',
            estimate_type: estimateType || 'insurance_claim',
            confidence: 0
          }
        },
        paid_single_use: false, // Subscription, not single use
      })
      .select()
      .single();

    if (reportError) {
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      previewOnly: false,
      usage: {
        reviewCount: permission.review_count + 1,
        reviewLimit: permission.review_limit,
        overageCount: isOverage ? permission.overage_count + 1 : permission.overage_count,
        overagePrice: permission.overage_price,
      },
    });
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

async function billOverage(
  supabase: SupabaseClient,
  stripe: Stripe,
  teamId: string,
  overagePrice: number
) {
  try {
    // Get team and subscription
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (!team || !team.stripe_subscription_id) {
      throw new Error('Team or subscription not found');
    }

    // Get subscription
    const subscription = await stripe.subscriptions.retrieve(team.stripe_subscription_id);

    // Determine overage price ID based on plan
    const overagePriceId = team.plan_type === 'professional'
      ? process.env.STRIPE_PRICE_PROFESSIONAL_OVERAGE!
      : process.env.STRIPE_PRICE_ENTERPRISE_OVERAGE!;

    // Create invoice item for overage (simpler than metered billing)
    await stripe.invoiceItems.create({
      customer: subscription.customer as string,
      amount: overagePrice * 100, // Convert to cents
      currency: 'usd',
      description: `Overage review - ${new Date().toLocaleDateString()}`,
      subscription: subscription.id,
    }, {
      idempotencyKey: `overage_${teamId}_${Date.now()}`,
    });

    console.log(`Billed overage for team ${teamId}: $${overagePrice}`);
  } catch (error) {
    console.error('Overage billing error:', error);
    // Don't throw - allow review to proceed even if billing fails
  }
}
