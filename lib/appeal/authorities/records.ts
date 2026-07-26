import type { PlanType } from "../ledger/types";
import type { StrategyId } from "../router/strategies";

export interface AuthorityRecord {
  id: string;
  citation: string;
  shortLabel: string;
  planTypes: PlanType[];
  strategies: StrategyId[];
  argument: string;
  quotable: string;
  blocked: PlanType[];
  sourceUrl: string;
  payer?: string;
  policyNumber?: string;
  cptCodes?: string[];
}

export const AUTHORITY_RECORDS: AuthorityRecord[] = [
  {
    id: "erisa-503-full-fair-review",
    citation: "29 U.S.C. § 1133; 29 C.F.R. § 2560.503-1",
    shortLabel: "ERISA §503 / DOL Reg.",
    planTypes: ["erisa-self-funded"],
    strategies: [
      "authorization",
      "medical-necessity",
      "non-covered",
      "not-covered-benefit",
      "bundling",
      "experimental",
      "claim-defect",
    ],
    argument: `ERISA § 1133 and 29 C.F.R. § 2560.503-1 require that every adverse benefit determination set forth the specific reason for the denial and the specific plan provision on which the denial is based. The denial of claim CIG-2026-887731 cites only CARC CO-15 and RARC N517 without identifying the plan provision that imposes the prior authorization requirement or the criteria applied in determining that the submitted authorization number was missing, invalid, or inapplicable. A denial that fails to cite the specific plan provision relied upon is procedurally defective under § 2560.503-1(g)(1)(i)–(ii) and does not constitute a valid adverse benefit determination.`,
    quotable:
      "specific reason for the denial and the specific plan provision on which the denial is based",
    blocked: [
      "fully-insured-group",
      "medicare-advantage",
      "medicaid-mco",
      "marketplace-individual",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XXV/subchapter-F/part-2560/section-2560.503-1",
  },
  {
    id: "erisa-503-deemed-exhaustion",
    citation: "29 C.F.R. § 2560.503-1(l)",
    shortLabel: "ERISA Deemed Exhaustion",
    planTypes: ["erisa-self-funded"],
    strategies: ["authorization", "medical-necessity", "claim-defect"],
    argument: `Under 29 C.F.R. § 2560.503-1(l), if a plan fails to strictly adhere to the claims procedure requirements — including the requirement to provide a specific plan provision and the specific reason for the denial — the claimant is deemed to have exhausted internal administrative remedies and may immediately pursue civil action under ERISA § 502(a)(1)(B), 29 U.S.C. § 1132(a)(1)(B). This appeal is submitted to preserve the record and provide the plan an opportunity to cure the procedural defect. Failure to respond with a decision that complies with § 2560.503-1(g) will be treated as deemed exhaustion.`,
    quotable: "deemed to have exhausted internal administrative remedies",
    blocked: [
      "fully-insured-group",
      "medicare-advantage",
      "medicaid-mco",
      "marketplace-individual",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XXV/subchapter-F/part-2560/section-2560.503-1",
  },
  {
    id: "erisa-503-document-production",
    citation: "29 C.F.R. § 2560.503-1(h)(2)(iii)",
    shortLabel: "ERISA Document Production",
    planTypes: ["erisa-self-funded"],
    strategies: [
      "authorization",
      "medical-necessity",
      "claim-defect",
      "non-covered",
      "not-covered-benefit",
    ],
    argument: `Pursuant to 29 C.F.R. § 2560.503-1(h)(2)(iii), the plan must provide, upon request and free of charge, copies of all documents, records, and other information relevant to the claimant's claim for benefits. We hereby request production of: (1) the plan provision or coverage policy imposing the prior authorization requirement for CPT 27130; (2) the authorization criteria applied; (3) all communications regarding this claim; and (4) the identity and qualifications of any clinical reviewer. Failure to produce these documents within the appeal review period will constitute an additional procedural violation under § 2560.503-1.`,
    quotable:
      "all documents, records, and other information relevant to the claimant's claim",
    blocked: [
      "fully-insured-group",
      "medicare-advantage",
      "medicaid-mco",
      "marketplace-individual",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XXV/subchapter-F/part-2560/section-2560.503-1",
  },
  {
    id: "erisa-502a-civil-action",
    citation: "29 U.S.C. § 1132(a)(1)(B)",
    shortLabel: "ERISA § 502(a)",
    planTypes: ["erisa-self-funded"],
    strategies: [
      "authorization",
      "medical-necessity",
      "non-covered",
      "not-covered-benefit",
      "bundling",
      "experimental",
      "claim-defect",
    ],
    argument: `In the event this appeal is denied, the claimant expressly reserves all rights under ERISA § 502(a)(1)(B), 29 U.S.C. § 1132(a)(1)(B), to bring a civil action to recover benefits due under the terms of the plan. The administrative record compiled through this appeal will constitute the evidentiary record for any subsequent federal court proceeding.`,
    quotable:
      "bring a civil action to recover benefits due under the terms of the plan",
    blocked: [
      "fully-insured-group",
      "medicare-advantage",
      "medicaid-mco",
      "marketplace-individual",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title29-section1132",
  },
  {
    id: "aca-external-review",
    citation: "45 C.F.R. § 147.136",
    shortLabel: "ACA External Review",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: [
      "authorization",
      "medical-necessity",
      "experimental",
      "non-covered",
      "not-covered-benefit",
      "bundling",
      "timely-filing",
    ],
    argument: `Pursuant to 45 C.F.R. § 147.136, if this internal appeal is denied, the claimant has the right to request an independent external review by an accredited Independent Review Organization (IRO). External review must be requested within four months of receipt of the final internal adverse benefit determination. The IRO's decision is binding on the plan. We reserve the right to pursue external review simultaneously with any additional internal remedies.`,
    quotable:
      "independent external review by an accredited Independent Review Organization",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-147/section-147.136",
  },
  {
    id: "ma-422-subpart-m",
    citation: "42 C.F.R. Part 422, Subpart M",
    shortLabel: "MA Appeals (42 CFR 422)",
    planTypes: ["medicare-advantage"],
    strategies: [
      "authorization",
      "medical-necessity",
      "non-covered",
      "not-covered-benefit",
      "bundling",
      "experimental",
    ],
    argument: `Under 42 C.F.R. Part 422, Subpart M, Medicare Advantage organizations must provide enrollees with a meaningful appeals process. The plan may not apply coverage criteria more restrictive than traditional Medicare. If this appeal is denied, the enrollee has the right to an automatic Independent Review Entity (IRE) review by the Quality Improvement Organization, which must be completed within 72 hours for expedited requests or 30 days for standard requests.`,
    quotable:
      "may not apply coverage criteria more restrictive than traditional Medicare",
    blocked: [
      "erisa-self-funded",
      "fully-insured-group",
      "marketplace-individual",
      "medicaid-mco",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-422/subpart-M",
  },
  {
    id: "ma-ncd-binding",
    citation: "42 C.F.R. § 422.101(b)(6)",
    shortLabel: "MA NCD/LCD Binding",
    planTypes: ["medicare-advantage"],
    strategies: [
      "medical-necessity",
      "non-covered",
      "not-covered-benefit",
      "experimental",
    ],
    argument: `Under 42 C.F.R. § 422.101(b)(6), Medicare Advantage plans are bound by CMS National Coverage Determinations and applicable Local Coverage Determinations issued by the relevant Medicare Administrative Contractor. The plan may not deny coverage for services covered under traditional Medicare fee-for-service on the basis of criteria not contained in an applicable NCD or LCD.`,
    quotable:
      "bound by CMS National Coverage Determinations and applicable Local Coverage Determinations",
    blocked: [
      "erisa-self-funded",
      "fully-insured-group",
      "marketplace-individual",
      "medicaid-mco",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-422/section-422.101",
  },
  {
    id: "medicaid-438-subpart-f",
    citation: "42 C.F.R. Part 438, Subpart F",
    shortLabel: "Medicaid MCO Appeals",
    planTypes: ["medicaid-mco"],
    strategies: [
      "authorization",
      "medical-necessity",
      "non-covered",
      "not-covered-benefit",
    ],
    argument: `Under 42 C.F.R. Part 438, Subpart F, Medicaid managed care organizations must provide enrollees with a grievance and appeal system that meets federal standards. The enrollee has the right to continue receiving benefits pending the outcome of this appeal. Failure to resolve this appeal within the regulatory timeframe constitutes a violation of the plan's contract with the state Medicaid agency.`,
    quotable:
      "right to continue receiving benefits pending the outcome of this appeal",
    blocked: [
      "erisa-self-funded",
      "fully-insured-group",
      "marketplace-individual",
      "medicare-advantage",
      "medicare-traditional",
    ],
    sourceUrl:
      "https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-438/subpart-F",
  },
  {
    id: "cigna-coverage-policy-hip-arthroplasty",
    citation: "Cigna Medical Coverage Policy — Total Hip Arthroplasty (CPT 27130)",
    shortLabel: "Cigna Coverage Policy — Hip Arthroplasty",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27130"],
    payer: "cigna",
    argument: `Cigna's own Medical Coverage Policy for Total Hip Arthroplasty recognizes CPT 27130 as a covered benefit when the member has a diagnosis of advanced hip joint disease — including osteoarthritis, avascular necrosis, or rheumatoid arthritis — with functional impairment that has not responded to conservative measures including physical therapy, analgesics, and activity modification. Where the clinical record documents these criteria, denial of CPT 27130 on administrative grounds alone is inconsistent with Cigna's published coverage standards for this procedure.`,
    quotable:
      "covered benefit when the member has a diagnosis of advanced hip joint disease",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.cigna.com/static/www-cigna-com/docs/health-care-provider/coverage-positions/medical/mm_0052_coveragepositioncriteria_hip_knee_replacement.pdf",
    policyNumber: "MM-0052",
  },
  {
    id: "uhc-coverage-policy-hip-arthroplasty",
    citation: "UnitedHealthcare Coverage Determination Guideline — Hip Arthroplasty",
    shortLabel: "UHC Coverage Guideline — Hip Arthroplasty",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27130"],
    payer: "uhc",
    argument: `UnitedHealthcare's Coverage Determination Guideline for Hip Arthroplasty recognizes total hip replacement as medically necessary for members with severe hip joint disease causing functional limitation that has not improved with appropriate conservative therapy. Denial of this procedure on administrative grounds where the clinical criteria are met is inconsistent with UnitedHealthcare's own published coverage standards.`,
    quotable:
      "medically necessary for members with severe hip joint disease causing functional limitation",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/cdgs/hip-arthroplasty.pdf",
  },
  {
    id: "aetna-coverage-policy-hip-arthroplasty",
    citation: "Aetna Clinical Policy Bulletin — Hip Replacement Surgery (CPB 0285)",
    shortLabel: "Aetna CPB 0285 — Hip Replacement",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27130"],
    payer: "aetna",
    argument: `Aetna's Clinical Policy Bulletin 0285 recognizes total hip arthroplasty as medically necessary when the member has disabling arthritis or other hip pathology that has failed conservative management. Where the submitted clinical record documents functional disability and failure of conservative care, denial on administrative grounds is inconsistent with Aetna's own published clinical criteria for this procedure.`,
    quotable:
      "medically necessary when the member has disabling arthritis or other hip pathology",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.aetna.com/cpb/medical/data/200_299/0285.html",
    policyNumber: "CPB-0285",
  },
  {
    id: "ncci-policy-manual-medical-necessity",
    citation: "CMS NCCI Policy Manual for Medicare Services, Chapter 1",
    shortLabel: "NCCI Policy Manual Ch. 1",
    planTypes: [
      "erisa-self-funded",
      "fully-insured-group",
      "medicare-advantage",
      "marketplace-individual",
      "medicare-traditional",
    ],
    strategies: ["bundling", "authorization"],
    argument: `The CMS National Correct Coding Initiative Policy Manual for Medicare Services, Chapter 1, establishes that correct coding requires reporting the service actually rendered. Where a procedure is performed and documented in the operative record, denial based on bundling or administrative coding grounds must be evaluated against the NCCI procedure-to-procedure edit table and the applicable modifier indicators. A modifier indicator of '1' permits unbundling with an appropriate modifier; denial without evaluation of the applicable modifier is inconsistent with NCCI policy.`,
    quotable: "correct coding requires reporting the service actually rendered",
    blocked: ["medicaid-mco"],
    sourceUrl:
      "https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-policy-manual",
  },
  {
    id: "cpt-guidelines-separate-procedure",
    citation: "CPT® Guidelines — Separate Procedure Designation",
    shortLabel: "CPT Separate Procedure",
    planTypes: [
      "erisa-self-funded",
      "fully-insured-group",
      "medicare-advantage",
      "marketplace-individual",
      "medicare-traditional",
      "medicaid-mco",
    ],
    strategies: ["bundling"],
    argument: `The AMA CPT® Guidelines provide that a procedure designated as a "separate procedure" may be reported separately when performed independently and not immediately related to another service. When the operative record documents that the separate procedure was performed as a distinct service, bundling without application of the appropriate modifier — specifically modifier 59 or the applicable X{EPSU} modifier — is inconsistent with CPT guidelines and NCCI unbundling policy.`,
    quotable:
      "may be reported separately when performed independently and not immediately related to another service",
    blocked: [],
    sourceUrl:
      "https://www.ama-assn.org/practice-management/cpt/cpt-overview-and-code-approval",
  },
  {
    id: "aaos-guideline-hip-arthroplasty",
    citation:
      "American Academy of Orthopaedic Surgeons — Clinical Practice Guideline on Surgical Management of Osteoarthritis of the Hip",
    shortLabel: "AAOS Hip Arthroplasty Guideline",
    planTypes: [
      "erisa-self-funded",
      "fully-insured-group",
      "medicare-advantage",
      "marketplace-individual",
      "medicaid-mco",
      "medicare-traditional",
    ],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27130", "27132", "27134"],
    argument: `The American Academy of Orthopaedic Surgeons Clinical Practice Guideline on Surgical Management of Osteoarthritis of the Hip supports total hip arthroplasty as the definitive treatment for patients with end-stage hip osteoarthritis who have failed conservative management. The AAOS guideline is a recognized clinical evidence standard for determining the appropriateness of this procedure. Denial of a procedure supported by AAOS guidelines requires the plan to identify a specific clinical criterion of equal or greater evidentiary weight that the service fails to satisfy.`,
    quotable:
      "definitive treatment for patients with end-stage hip osteoarthritis who have failed conservative management",
    blocked: [],
    sourceUrl:
      "https://www.aaos.org/quality/quality-programs/lower-extremity-programs/osteoarthritis-of-the-hip/",
  },
  {
    id: "aaos-guideline-knee-arthroplasty",
    citation:
      "American Academy of Orthopaedic Surgeons — Clinical Practice Guideline on Surgical Management of Osteoarthritis of the Knee",
    shortLabel: "AAOS Knee Arthroplasty Guideline",
    planTypes: [
      "erisa-self-funded",
      "fully-insured-group",
      "medicare-advantage",
      "marketplace-individual",
      "medicaid-mco",
      "medicare-traditional",
    ],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27447", "27446", "27445"],
    argument: `The American Academy of Orthopaedic Surgeons Clinical Practice Guideline on Surgical Management of Osteoarthritis of the Knee supports total knee arthroplasty as appropriate surgical treatment for patients with end-stage knee osteoarthritis who have failed conservative management. Denial of a procedure supported by AAOS guidelines requires the plan to identify a specific clinical criterion of equal or greater evidentiary weight that the service fails to satisfy.`,
    quotable:
      "appropriate surgical treatment for patients with end-stage knee osteoarthritis",
    blocked: [],
    sourceUrl:
      "https://www.aaos.org/quality/quality-programs/lower-extremity-programs/osteoarthritis-of-the-knee/",
  },
  {
    id: "aaos-guideline-spine",
    citation:
      "American Academy of Orthopaedic Surgeons — Evidence-Based Clinical Practice Guidelines, Spine",
    shortLabel: "AAOS Spine Guidelines",
    planTypes: [
      "erisa-self-funded",
      "fully-insured-group",
      "medicare-advantage",
      "marketplace-individual",
      "medicaid-mco",
      "medicare-traditional",
    ],
    strategies: ["medical-necessity", "authorization"],
    cptCodes: ["22551", "22552", "22554", "22612", "22630", "22633", "63030", "63047"],
    argument: `AAOS evidence-based clinical practice guidelines for spinal procedures support surgical intervention for patients with structural pathology causing neurological compromise or functional limitation that has not responded to conservative management. Denial of a spinal procedure supported by AAOS guidelines requires the plan to identify a specific clinical criterion of equal or greater evidentiary weight that the procedure fails to satisfy.`,
    quotable:
      "surgical intervention for patients with structural pathology causing neurological compromise",
    blocked: [],
    sourceUrl:
      "https://www.aaos.org/quality/quality-programs/spine-programs/",
  },
  {
    id: "cigna-coverage-policy-knee-arthroplasty",
    citation: "Cigna Medical Coverage Policy — Total Knee Arthroplasty (CPT 27447)",
    shortLabel: "Cigna Coverage Policy — Knee Arthroplasty",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27447", "27446", "27445"],
    payer: "cigna",
    argument: `Cigna's Medical Coverage Policy for Total Knee Arthroplasty recognizes CPT 27447 as a covered benefit when the member has advanced knee joint disease with functional impairment that has not responded to conservative management including physical therapy, analgesics, and activity modification. Denial of CPT 27447 where the clinical record documents these criteria is inconsistent with Cigna's published coverage standards for this procedure.`,
    quotable:
      "covered benefit when the member has advanced knee joint disease with functional impairment",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.cigna.com/static/www-cigna-com/docs/health-care-provider/coverage-positions/medical/mm_0052_coveragepositioncriteria_hip_knee_replacement.pdf",
    policyNumber: "MM-0052",
  },
  {
    id: "uhc-coverage-policy-knee-arthroplasty",
    citation: "UnitedHealthcare Coverage Determination Guideline — Knee Arthroplasty",
    shortLabel: "UHC Coverage Guideline — Knee Arthroplasty",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27447", "27446", "27445"],
    payer: "uhc",
    argument: `UnitedHealthcare's Coverage Determination Guideline for Knee Arthroplasty recognizes total knee replacement as medically necessary for members with severe knee joint disease causing functional limitation that has not improved with appropriate conservative therapy. Denial on administrative grounds where clinical criteria are met is inconsistent with UnitedHealthcare's own published coverage standards.`,
    quotable:
      "medically necessary for members with severe knee joint disease causing functional limitation",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/cdgs/knee-arthroplasty.pdf",
  },
  {
    id: "aetna-coverage-policy-knee-arthroplasty",
    citation: "Aetna Clinical Policy Bulletin — Knee Replacement Surgery (CPB 0656)",
    shortLabel: "Aetna CPB 0656 — Knee Replacement",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27447", "27446", "27445"],
    payer: "aetna",
    argument: `Aetna Clinical Policy Bulletin 0656 recognizes total knee arthroplasty as medically necessary when the member has disabling arthritis or other knee pathology that has failed conservative management. Where the clinical record documents functional disability and failure of conservative care, denial on administrative grounds is inconsistent with Aetna's published clinical criteria.`,
    quotable:
      "medically necessary when the member has disabling arthritis or other knee pathology",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl: "https://www.aetna.com/cpb/medical/data/600_699/0656.html",
    policyNumber: "CPB-0656",
  },
  {
    id: "cigna-coverage-policy-spine",
    citation: "Cigna Medical Coverage Policy — Spinal Surgery (CPT 22551–22633)",
    shortLabel: "Cigna Coverage Policy — Spinal Surgery",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["22551", "22552", "22554", "22612", "22630", "22633", "63030", "63047"],
    payer: "cigna",
    argument: `Cigna's Medical Coverage Policy for Spinal Surgery recognizes spinal fusion and decompression procedures as covered when the member has structural spinal pathology with neurological compromise or significant functional limitation that has not responded to conservative management. Denial of a spinal procedure where the clinical record documents these criteria is inconsistent with Cigna's published coverage standards.`,
    quotable:
      "covered when the member has structural spinal pathology with neurological compromise",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.cigna.com/static/www-cigna-com/docs/health-care-provider/coverage-positions/medical/mm_0265_coveragepositioncriteria_spinal_surgery.pdf",
    policyNumber: "MM-0265",
  },
  {
    id: "bcbs-coverage-policy-hip-arthroplasty",
    citation: "Blue Cross Blue Shield Association Medical Policy — Hip Arthroplasty",
    shortLabel: "BCBS Medical Policy — Hip Arthroplasty",
    planTypes: ["erisa-self-funded", "fully-insured-group", "marketplace-individual"],
    strategies: ["medical-necessity", "authorization", "not-covered-benefit"],
    cptCodes: ["27130", "27132", "27134"],
    payer: "bcbs",
    argument: `The Blue Cross Blue Shield Association Medical Policy for Hip Arthroplasty recognizes total hip replacement as medically necessary for members with disabling hip joint disease who have failed an adequate trial of conservative management. Where the clinical record documents failure of conservative care and significant functional impairment, denial is inconsistent with BCBS published coverage criteria for this procedure.`,
    quotable:
      "medically necessary for members with disabling hip joint disease who have failed an adequate trial of conservative management",
    blocked: ["medicare-advantage", "medicaid-mco", "medicare-traditional"],
    sourceUrl:
      "https://www.bcbs.com/sites/default/files/file-attachments/health-topics/policies/hip-arthroplasty.pdf",
  },
];

/** Three core ERISA records required for erisa-self-funded letters. */
export const CORE_ERISA_AUTHORITY_IDS = [
  "erisa-503-full-fair-review",
  "erisa-503-deemed-exhaustion",
  "erisa-503-document-production",
] as const;

export function allAuthorityRecords(): AuthorityRecord[] {
  return AUTHORITY_RECORDS;
}

export function getRecordById(id: string): AuthorityRecord | undefined {
  return AUTHORITY_RECORDS.find((r) => r.id === id);
}

export function citationStringsFromRecords(records: AuthorityRecord[]): string[] {
  const out = new Set<string>();
  for (const r of records) {
    out.add(r.citation);
    out.add(r.shortLabel);
    out.add(r.quotable);
    for (const part of r.citation.split(/[;,]/)) {
      const t = part.trim();
      if (t.length >= 6) out.add(t);
    }
  }
  return [...out];
}
