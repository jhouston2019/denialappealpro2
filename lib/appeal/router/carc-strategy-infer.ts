import type { StrategyId } from "./strategies";

/** Map CARC code + official X12 descriptor to appeal strategy. */
export function inferStrategyId(code: string, descriptor: string): StrategyId {
  const d = descriptor.toLowerCase();
  const n = parseInt(code, 10);

  const EXPLICIT: Record<string, StrategyId> = {
    "1": "contractual",
    "2": "contractual",
    "3": "contractual",
    "4": "claim-defect",
    "5": "claim-defect",
    "6": "claim-defect",
    "7": "claim-defect",
    "8": "claim-defect",
    "9": "claim-defect",
    "10": "claim-defect",
    "11": "claim-defect",
    "12": "claim-defect",
    "13": "claim-defect",
    "14": "claim-defect",
    "15": "authorization",
    "16": "claim-defect",
    "17": "claim-defect",
    "18": "duplicate",
    "19": "wrong-payer",
    "20": "wrong-payer",
    "21": "wrong-payer",
    "22": "wrong-payer",
    "23": "contractual",
    "27": "claim-defect",
    "29": "timely-filing",
    "45": "contractual",
    "49": "non-covered",
    "50": "medical-necessity",
    "55": "experimental",
    "56": "not-proven",
    "62": "authorization",
    "96": "non-covered",
    "97": "bundling",
    "107": "claim-defect",
    "109": "wrong-payer",
    "110": "claim-defect",
    "119": "non-covered",
    "125": "claim-defect",
    "136": "wrong-payer",
    "138": "timely-filing",
    "148": "claim-defect",
    "150": "medical-necessity",
    "151": "medical-necessity",
    "152": "medical-necessity",
    "153": "medical-necessity",
    "154": "medical-necessity",
    "163": "claim-defect",
    "164": "claim-defect",
    "165": "authorization",
    "167": "dx-not-covered",
    "170": "non-covered",
    "171": "claim-defect",
    "181": "claim-defect",
    "182": "claim-defect",
    "185": "non-covered",
    "188": "experimental",
    "197": "authorization",
    "198": "authorization",
    "199": "claim-defect",
    "204": "not-covered-benefit",
    "206": "claim-defect",
    "207": "claim-defect",
    "208": "claim-defect",
    "210": "authorization",
    "227": "claim-defect",
    "233": "wrong-payer",
    "252": "claim-defect",
    B15: "bundling",
  };

  if (EXPLICIT[code]) return EXPLICIT[code];

  if (
    d.includes("authorization") ||
    d.includes("precertification") ||
    d.includes("pre-certification") ||
    d.includes("pre-treatment absent")
  ) {
    return "authorization";
  }
  if (d.includes("duplicate")) return "duplicate";
  if (d.includes("time limit for filing") || d.includes("appeal procedures")) {
    return "timely-filing";
  }
  if (
    d.includes("medical necessity") ||
    d.includes("does not support this level") ||
    d.includes("does not support this many") ||
    d.includes("does not support this length") ||
    d.includes("does not support this dosage") ||
    d.includes("day's supply")
  ) {
    return "medical-necessity";
  }
  if (
    d.includes("experimental") ||
    d.includes("investigational") ||
    d.includes("food and drug administration")
  ) {
    return "experimental";
  }
  if (d.includes("proven to be effective")) return "not-proven";
  if (
    d.includes("included in the payment") ||
    d.includes("bundled") ||
    d.includes("concurrent procedure") ||
    d.includes("multiple or concurrent")
  ) {
    return "bundling";
  }
  if (
    d.includes("coordination of benefits") ||
    d.includes("another payer") ||
    d.includes("workers' compensation") ||
    d.includes("work-related") ||
    d.includes("liability carrier") ||
    d.includes("no-fault")
  ) {
    return "wrong-payer";
  }
  if (d.includes("diagnosis") && d.includes("not covered")) {
    return "dx-not-covered";
  }
  if (
    d.includes("not covered under") ||
    d.includes("benefit plan") ||
    d.includes("benefit maximum") ||
    d.includes("non-covered")
  ) {
    return "non-covered";
  }
  if (
    d.includes("submission/billing error") ||
    d.includes("billing error") ||
    d.includes("lacks information") ||
    d.includes("insufficient/incomplete") ||
    d.includes("invalid on the date of service") ||
    d.includes("inconsistent with") ||
    d.includes("missing") ||
    d.includes("attachment")
  ) {
    return "claim-defect";
  }
  if (
    d.includes("deductible") ||
    d.includes("coinsurance") ||
    d.includes("co-payment") ||
    d.includes("fee schedule") ||
    d.includes("contractual") ||
    d.includes("maximum allowable")
  ) {
    return "contractual";
  }

  if (Number.isFinite(n) && n >= 1 && n <= 275) return "unknown";
  return "unknown";
}

export function inferAdministrative(
  strategyId: StrategyId,
  descriptor: string
): boolean {
  const d = descriptor.toLowerCase();
  if (
    [
      "authorization",
      "claim-defect",
      "duplicate",
      "timely-filing",
      "bundling",
      "wrong-payer",
    ].includes(strategyId)
  ) {
    return true;
  }
  if (
    d.includes("billing error") ||
    d.includes("submission") ||
    d.includes("duplicate") ||
    d.includes("authorization") ||
    d.includes("timely filing") ||
    d.includes("time limit for filing")
  ) {
    return true;
  }
  return false;
}

export function inferCorrectedClaimFirst(
  strategyId: StrategyId,
  descriptor: string
): boolean {
  if (strategyId === "duplicate") return true;
  if (strategyId === "claim-defect") {
    const d = descriptor.toLowerCase();
    return (
      !d.includes("coverage terminated") &&
      !d.includes("not eligible dependent")
    );
  }
  if (strategyId === "wrong-payer") return true;
  return false;
}

export function defaultPrimaryArgument(
  strategyId: StrategyId,
  descriptor: string
): string {
  switch (strategyId) {
    case "authorization":
      return "The denial reflects an authorization or precertification issue, not a coverage or medical necessity determination.";
    case "bundling":
      return "This service is separately payable and was not included in payment for another procedure.";
    case "timely-filing":
      return "The claim was filed within the applicable timely filing limit or good cause applies.";
    case "medical-necessity":
      return "The service meets medical necessity criteria supported by the clinical record.";
    case "claim-defect":
      return "The cited technical deficiency has been corrected or was not present; request reprocessing.";
    case "duplicate":
      return "This claim is not a duplicate of a previously paid or denied service.";
    case "experimental":
      return "The service is established and not experimental or investigational for this indication.";
    case "non-covered":
      return "The service is a covered benefit under the patient's plan.";
    case "wrong-payer":
      return "This payer is responsible for this claim under applicable coordination of benefits rules.";
    case "contractual":
      return "The adjustment does not reflect the contracted provider payment obligation.";
    default:
      return `Request reconsideration: ${descriptor}`;
  }
}
