/**
 * USAGE TRACKING SYSTEM
 * Enforces review limits based on subscription plan
 */

import { createClient } from '@supabase/supabase-js';
import { incrementReviewUsageForUser } from '@/lib/billing/incrementUserReviewUsage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export interface UsageStatus {
  canCreateReview: boolean;
  planName?: string;
  reviewsUsed: number;
  reviewsLimit: number | null; // null = unlimited
  reviewsRemaining: number | null; // null = unlimited
  billingPeriodEnd?: Date;
  reason?: string;
}

/**
 * Check if user can create a review
 */
export async function checkUserUsage(userId: string): Promise<UsageStatus> {
  const client = getSupabaseClient();
  
  if (!client) {
    console.error('[USAGE] Supabase not configured');
    return {
      canCreateReview: false,
      reviewsUsed: 0,
      reviewsLimit: 0,
      reviewsRemaining: 0,
      reason: 'System configuration error',
    };
  }
  
  try {
    // Get user's current plan and usage
    const { data, error } = await (client as any)
      .rpc('get_user_plan_usage', { user_id_param: userId });
    
    if (error) {
      console.error('[USAGE] Error fetching usage:', error);
      return {
        canCreateReview: false,
        reviewsUsed: 0,
        reviewsLimit: 0,
        reviewsRemaining: 0,
        reason: 'Failed to fetch usage data',
      };
    }
    
    // No active plan
    if (!data || data.length === 0) {
      console.log('[USAGE] No active plan found');
      return {
        canCreateReview: false,
        reviewsUsed: 0,
        reviewsLimit: 0,
        reviewsRemaining: 0,
        reason: 'No active subscription or credits',
      };
    }
    
    const usage = data[0];
    
    // Unlimited plan (Litigation)
    if (usage.reviews_limit === null) {
      console.log('[USAGE] Unlimited plan - access granted');
      return {
        canCreateReview: true,
        planName: usage.plan_name,
        reviewsUsed: usage.reviews_used,
        reviewsLimit: null,
        reviewsRemaining: null,
        billingPeriodEnd: new Date(usage.billing_period_end),
      };
    }
    
    // Check if under limit
    const canCreate = usage.reviews_remaining > 0;
    
    console.log(`[USAGE] ${usage.plan_name}: ${usage.reviews_used}/${usage.reviews_limit} used`);
    
    return {
      canCreateReview: canCreate,
      planName: usage.plan_name,
      reviewsUsed: usage.reviews_used,
      reviewsLimit: usage.reviews_limit,
      reviewsRemaining: usage.reviews_remaining,
      billingPeriodEnd: new Date(usage.billing_period_end),
      reason: canCreate ? undefined : 'Review limit reached for current billing period',
    };
    
  } catch (error) {
    console.error('[USAGE] Error checking usage:', error);
    return {
      canCreateReview: false,
      reviewsUsed: 0,
      reviewsLimit: 0,
      reviewsRemaining: 0,
      reason: 'System error',
    };
  }
}

/**
 * Increment user's review usage
 */
export async function incrementUsage(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client) {
    console.error('[USAGE] Supabase not configured');
    return false;
  }
  
  try {
    const ok = await incrementReviewUsageForUser(client, userId);
    if (ok) {
      console.log('[USAGE] Usage incremented successfully');
    }
    return ok;
  } catch (error) {
    console.error('[USAGE] Error incrementing usage:', error);
    return false;
  }
}

/**
 * Create usage record for new subscription
 */
export async function createUsageRecord(
  userId: string,
  planId: string,
  reviewsLimit: number | null,
  stripeSubscriptionId?: string
): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client) {
    console.error('[USAGE] Supabase not configured');
    return false;
  }
  
  try {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    await (client as any)
      .from('user_review_usage')
      .insert({
        user_id: userId,
        plan_id: planId,
        reviews_used: 0,
        reviews_limit: reviewsLimit,
        billing_period_start: now.toISOString(),
        billing_period_end: periodEnd.toISOString(),
        stripe_subscription_id: stripeSubscriptionId,
        is_active: true,
      });
    
    console.log('[USAGE] Usage record created');
    return true;
    
  } catch (error) {
    console.error('[USAGE] Failed to create usage record:', error);
    return false;
  }
}

/**
 * Get user's total recovery value
 */
export async function getUserTotalRecovery(userId: string): Promise<number> {
  const client = getSupabaseClient();
  
  if (!client) {
    return 0;
  }
  
  try {
    const { data, error } = await (client as any)
      .rpc('get_user_total_recovery', { user_id_param: userId });
    
    if (error) {
      console.error('[USAGE] Error fetching total recovery:', error);
      return 0;
    }
    
    return data || 0;
    
  } catch (error) {
    console.error('[USAGE] Error fetching total recovery:', error);
    return 0;
  }
}

/**
 * Get recovery summary for user
 */
export async function getRecoverySummary(userId: string): Promise<{
  totalReviews: number;
  totalRecovery: number;
  averageRecovery: number;
  guaranteesTriggered: number;
  refundsIssued: number;
}> {
  const client = getSupabaseClient();
  
  if (!client) {
    return {
      totalReviews: 0,
      totalRecovery: 0,
      averageRecovery: 0,
      guaranteesTriggered: 0,
      refundsIssued: 0,
    };
  }
  
  try {
    const { data, error } = await (client as any)
      .rpc('get_recovery_summary', { user_id_param: userId });
    
    if (error || !data || data.length === 0) {
      return {
        totalReviews: 0,
        totalRecovery: 0,
        averageRecovery: 0,
        guaranteesTriggered: 0,
        refundsIssued: 0,
      };
    }
    
    const summary = data[0];
    
    return {
      totalReviews: summary.total_reviews || 0,
      totalRecovery: summary.total_recovery || 0,
      averageRecovery: summary.average_recovery || 0,
      guaranteesTriggered: summary.guarantees_triggered || 0,
      refundsIssued: summary.refunds_issued || 0,
    };
    
  } catch (error) {
    console.error('[USAGE] Error fetching recovery summary:', error);
    return {
      totalReviews: 0,
      totalRecovery: 0,
      averageRecovery: 0,
      guaranteesTriggered: 0,
      refundsIssued: 0,
    };
  }
}

/**
 * Format usage status message
 */
export function formatUsageMessage(status: UsageStatus): string {
  if (!status.canCreateReview) {
    return status.reason || 'Cannot create review';
  }
  
  if (status.reviewsLimit === null) {
    return `${status.planName}: Unlimited reviews`;
  }
  
  return `${status.planName}: ${status.reviewsRemaining} of ${status.reviewsLimit} reviews remaining`;
}
