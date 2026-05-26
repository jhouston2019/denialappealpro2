import type { AnalysisResult, ComparisonResult } from "@/lib/estimate-json-parse";
import { toSupabaseJsonValue } from "@/lib/wizard-snapshot";
import type { WizardClaimMeta } from "@/lib/wizard-deliverables";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export type SaveWizardReviewInput = {
  claimMeta: WizardClaimMeta;
  analysis: AnalysisResult | null;
  comparison: ComparisonResult | null;
  summary: unknown;
  letterType: string | null;
  letterText: string | null;
};

export type SaveWizardReviewResult =
  | { ok: true; reviewId: string }
  | { ok: false; error: string };

export async function saveWizardReview(
  input: SaveWizardReviewInput
): Promise<SaveWizardReviewResult> {
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { ok: false, error: "Not signed in" };
    }

    const m = input.claimMeta;
    const a = input.analysis;
    const analysisWithClaimMeta =
      a && typeof a === "object"
        ? {
            ...(a as Record<string, unknown>),
            claimMeta: {
              insuredName: m.insuredName,
              carrierName: m.carrierName,
              policyNumber: m.policyNumber,
              claimNumber: m.claimNumber,
              dateOfLoss: m.dateOfLoss,
              adjusterName: m.adjusterName,
              responseDeadline: m.responseDeadline,
            },
          }
        : a;

    const letterText = input.letterText?.trim() || null;

    const { data: inserted, error } = await supabase
      .from("reviews")
      .insert({
        user_id: session.user.id,
        ai_analysis_json: toSupabaseJsonValue(analysisWithClaimMeta),
        ai_comparison_json: toSupabaseJsonValue(input.comparison),
        ai_summary_json: toSupabaseJsonValue(input.summary),
        insured_name: m.insuredName?.trim() || null,
        letter_text: letterText,
        letter_type: input.letterType?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      console.error("[saveWizardReview] insert:", error);
      return { ok: false, error: error?.message ?? "Save failed" };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("plan_type")
      .eq("id", session.user.id)
      .single();

    if (userData?.plan_type === "single") {
      await supabase
        .from("users")
        .update({ plan_type: null })
        .eq("id", session.user.id);
    }

    try {
      const usageRes = await fetch("/api/increment-review-usage", {
        method: "POST",
        credentials: "include",
      });
      if (!usageRes.ok) {
        console.error("[saveWizardReview] increment:", await usageRes.text());
      }
    } catch (usageErr) {
      console.error("[saveWizardReview] increment:", usageErr);
    }

    return { ok: true, reviewId: inserted.id as string };
  } catch (e) {
    console.error("[saveWizardReview]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}
