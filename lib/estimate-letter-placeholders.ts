/** Letter placeholders — kept for dashboard / wizard-deliverables compat. */

export type ClaimMetaSlice = {
  insuredName?: string;
  carrierName?: string;
  policyNumber?: string;
  claimNumber?: string;
  dateOfLoss?: string;
  adjusterName?: string;
  responseDeadline?: string;
};

export type LetterPlaceholderFields = {
  insured: string;
  policy: string;
  claim: string;
  dateOfLoss: string;
  adjuster: string;
  carrier: string;
  amount: string;
  responseDeadline: string;
};

export function emptyLetterPlaceholders(): LetterPlaceholderFields {
  return {
    insured: "",
    policy: "",
    claim: "",
    dateOfLoss: "",
    adjuster: "",
    carrier: "",
    amount: "",
    responseDeadline: "",
  };
}

export function letterPlaceholdersFromClaimMeta(
  meta: ClaimMetaSlice
): LetterPlaceholderFields {
  return {
    insured: meta.insuredName?.trim() || "",
    policy: meta.policyNumber?.trim() || "",
    claim: meta.claimNumber?.trim() || "",
    dateOfLoss: meta.dateOfLoss?.trim() || "",
    adjuster: meta.adjusterName?.trim() || "",
    carrier: meta.carrierName?.trim() || "",
    amount: "",
    responseDeadline: meta.responseDeadline?.trim() || "",
  };
}

const TOKEN_MAP: [string, keyof LetterPlaceholderFields][] = [
  ["[INSURED NAME]", "insured"],
  ["[POLICY NUMBER]", "policy"],
  ["[CLAIM NUMBER]", "claim"],
  ["[DATE OF LOSS]", "dateOfLoss"],
  ["[ADJUSTER NAME]", "adjuster"],
  ["[CARRIER NAME]", "carrier"],
  ["[DISPUTED AMOUNT]", "amount"],
  ["[RESPONSE DEADLINE]", "responseDeadline"],
];

export function applyPlaceholdersToLetter(
  letter: string,
  fields: LetterPlaceholderFields
): string {
  let out = letter;
  for (const [token, key] of TOKEN_MAP) {
    const val = fields[key]?.trim();
    if (val) {
      out = out.split(token).join(val);
    }
  }
  return out;
}
