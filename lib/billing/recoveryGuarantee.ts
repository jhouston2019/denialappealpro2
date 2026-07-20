/**
 * RECOVERY GUARANTEE SYSTEM
 * Automatically refunds users if recovery value < $1,000
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let stripeClient: Stripe | null = null;
let supabase: ReturnType<typeof createClient> | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-11-17.clover',
    });
  }
  return stripeClient;
}

function getSupabaseClient() {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

export interface RecoveryGuaranteeResult {
  guaranteeTriggered: boolean;
  recoveryValue: number;
  refundIssued: boolean;
  refundAmount?: number;
  stripeRefundId?: string;
  reason?: string;
}

const GUARANTEE_THRESHOLD = 1000; // $1,000 minimum recovery

/**
 * Check if recovery guarantee is triggered
 */
export function shouldTriggerGuarantee(recoveryValue: number): boolean {
  return recoveryValue < GUARANTEE_THRESHOLD;
}

/**
 * Issue Stripe refund
 */
async function issueStripeRefund(
  paymentIntentId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    console.log(`[GUARANTEE] Issuing refund for ${paymentIntentId}: $${amount}`);
    
    const refund = await getStripe().refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100), // Convert to cents
      reason: 'requested_by_customer',
      metadata: {
        reason,
        auto_refund: 'recovery_guarantee',
      },
    });
    
    console.log(`[GUARANTEE] Refund issued: ${refund.id}`);
    
    return {
      success: true,
      refundId: refund.id,
    };
    
  } catch (error: any) {
    console.error('[GUARANTEE] Stripe refund failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Log recovery metric to database
 */
async function logRecoveryMetric(
  userId: string,
  reportId: string,
  recoveryData: {
    originalValue: number;
    reconstructedValue: number;
    recoveryValue: number;
    carrier?: string;
    claimType?: string;
    state?: string;
  },
  guaranteeTriggered: boolean,
  refundData?: {
    refundIssued: boolean;
    refundAmount?: number;
    stripeRefundId?: string;
  }
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[GUARANTEE] Supabase not configured');
    return;
  }
  
  try {
    await (client as any)
      .from('recovery_metrics')
      .insert({
        user_id: userId,
        report_id: reportId,
        original_estimate_value: recoveryData.originalValue,
        reconstructed_value: recoveryData.reconstructedValue,
        recovery_value: recoveryData.recoveryValue,
        carrier: recoveryData.carrier,
        claim_type: recoveryData.claimType,
        state: recoveryData.state,
        guarantee_triggered: guaranteeTriggered,
        refund_issued: refundData?.refundIssued || false,
        refund_amount: refundData?.refundAmount,
        stripe_refund_id: refundData?.stripeRefundId,
      });
    
    console.log('[GUARANTEE] Recovery metric logged');
    
  } catch (error) {
    console.error('[GUARANTEE] Failed to log recovery metric:', error);
  }
}

/**
 * Get payment intent ID for report
 */
async function getPaymentIntentForReport(
  userId: string,
  reportId: string
): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  
  try {
    // Get the most recent payment transaction for this user
    const { data } = await (client as any)
      .from('payment_transactions')
      .select('stripe_payment_id')
      .eq('user_id', userId)
      .eq('payment_type', 'one-time')
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.stripe_payment_id || null;
    
  } catch (error) {
    console.error('[GUARANTEE] Failed to get payment intent:', error);
    return null;
  }
}

/**
 * Main recovery guarantee check
 */
export async function checkRecoveryGuarantee(
  userId: string,
  reportId: string,
  recoveryValue: number,
  recoveryData: {
    originalValue: number;
    reconstructedValue: number;
    carrier?: string;
    claimType?: string;
    state?: string;
  }
): Promise<RecoveryGuaranteeResult> {
  
  console.log(`[GUARANTEE] Checking guarantee for report ${reportId}`);
  console.log(`[GUARANTEE] Recovery value: $${recoveryValue.toFixed(2)}`);
  
  const guaranteeTriggered = shouldTriggerGuarantee(recoveryValue);
  
  if (!guaranteeTriggered) {
    console.log('[GUARANTEE] Guarantee not triggered (recovery >= $1,000)');
    
    // Log metric without refund
    await logRecoveryMetric(
      userId,
      reportId,
      { ...recoveryData, recoveryValue },
      false
    );
    
    return {
      guaranteeTriggered: false,
      recoveryValue,
      refundIssued: false,
    };
  }
  
  console.log('[GUARANTEE] ⚠️ Guarantee triggered (recovery < $1,000)');
  
  // Get payment intent
  const paymentIntentId = await getPaymentIntentForReport(userId, reportId);
  
  if (!paymentIntentId) {
    console.warn('[GUARANTEE] No payment intent found (may be subscription user)');
    
    // Log metric without refund
    await logRecoveryMetric(
      userId,
      reportId,
      { ...recoveryData, recoveryValue },
      true,
      { refundIssued: false }
    );
    
    return {
      guaranteeTriggered: true,
      recoveryValue,
      refundIssued: false,
      reason: 'No payment intent found (subscription or free review)',
    };
  }
  
  // Issue refund
  const refundResult = await issueStripeRefund(
    paymentIntentId,
    49.00, // Full review price
    `Recovery guarantee: Found only $${recoveryValue.toFixed(2)} (threshold: $${GUARANTEE_THRESHOLD})`
  );
  
  if (!refundResult.success) {
    console.error('[GUARANTEE] Refund failed:', refundResult.error);
    
    // Log metric with failed refund
    await logRecoveryMetric(
      userId,
      reportId,
      { ...recoveryData, recoveryValue },
      true,
      { refundIssued: false }
    );
    
    return {
      guaranteeTriggered: true,
      recoveryValue,
      refundIssued: false,
      reason: `Refund failed: ${refundResult.error}`,
    };
  }
  
  // Update payment transaction
  const client = getSupabaseClient();
  if (client) {
    try {
      await (client as any)
        .from('payment_transactions')
        .update({
          status: 'refunded',
          refunded_amount: 149.00,
        })
        .eq('stripe_payment_id', paymentIntentId);
    } catch (error) {
      console.error('[GUARANTEE] Failed to update transaction:', error);
    }
  }
  
  // Log metric with successful refund
  await logRecoveryMetric(
    userId,
    reportId,
    { ...recoveryData, recoveryValue },
    true,
    {
      refundIssued: true,
      refundAmount: 49.00,
      stripeRefundId: refundResult.refundId,
    }
  );
  
  console.log('[GUARANTEE] ✅ Refund issued successfully');
  
  return {
    guaranteeTriggered: true,
    recoveryValue,
    refundIssued: true,
    refundAmount: 149.00,
    stripeRefundId: refundResult.refundId,
    reason: `Recovery value ($${recoveryValue.toFixed(2)}) below guarantee threshold ($${GUARANTEE_THRESHOLD})`,
  };
}

/**
 * Format guarantee message for report
 */
export function formatGuaranteeMessage(result: RecoveryGuaranteeResult): string {
  if (!result.guaranteeTriggered) {
    return `✅ Recovery Guarantee: $${result.recoveryValue.toFixed(2)} identified (exceeds $${GUARANTEE_THRESHOLD} threshold)`;
  }
  
  if (result.refundIssued) {
    return `🔄 Recovery Guarantee Triggered: Found $${result.recoveryValue.toFixed(2)} (below $${GUARANTEE_THRESHOLD} threshold). Full refund of $${result.refundAmount?.toFixed(2)} has been issued to your payment method.`;
  }
  
  return `ℹ️ Recovery Guarantee: Found $${result.recoveryValue.toFixed(2)} (below $${GUARANTEE_THRESHOLD} threshold). ${result.reason || 'Review marked as complimentary.'}`;
}
