import { ALWAYS_REQUIRED, CLINICAL_KEYS, DEFAULT_ENCLOSURES } from "./keys";
import type {
  Fact,
  FactKey,
  FactLedger,
  FactValue,
  Provenance,
} from "./types";

function isUserOnlyKey(key: FactKey): boolean {
  return CLINICAL_KEYS.includes(key) || key === "patient.planType";
}

function isPresent(value: FactValue | undefined): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function emptyLedger(documentIds: string[] = []): FactLedger {
  return {
    facts: {},
    enclosures: DEFAULT_ENCLOSURES.map((e) => ({
      id: e.id,
      label: e.label,
      checked: false,
    })),
    meta: {
      ledgerVersion: 1,
      createdAt: new Date().toISOString(),
      documentIds: [...documentIds],
    },
  };
}

/**
 * Write a fact into the ledger.
 * Hard invariant: clinical.* may only be written with provenance 'user'.
 */
export function setFact(
  ledger: FactLedger,
  key: FactKey,
  value: FactValue,
  provenance: Provenance,
  sourceRef: string,
  confidence?: number
): FactLedger {
  if (isUserOnlyKey(key) && provenance !== "user") {
    const label =
      key === "patient.planType" ? "Plan type" : `Clinical fact "${key}"`;
    throw new Error(
      `${label} may only be written with provenance "user" (got "${provenance}")`
    );
  }

  const conf =
    typeof confidence === "number"
      ? Math.min(1, Math.max(0, confidence))
      : provenance === "user" || provenance === "library"
        ? 1
        : provenance === "derived"
          ? 1
          : 0;

  const fact: Fact = {
    key,
    value,
    provenance,
    sourceRef,
    confidence: conf,
  };

  return {
    ...ledger,
    facts: {
      ...ledger.facts,
      [key]: fact,
    },
  };
}

export function getFact(
  ledger: FactLedger,
  key: FactKey
): Fact | undefined {
  return ledger.facts[key];
}

export function getValue(
  ledger: FactLedger,
  key: FactKey
): FactValue | undefined {
  return ledger.facts[key]?.value;
}

export function mergeLedger(
  base: FactLedger,
  overlay: FactLedger
): FactLedger {
  return {
    facts: { ...base.facts, ...overlay.facts },
    enclosures:
      overlay.enclosures.length > 0 ? overlay.enclosures : base.enclosures,
    meta: {
      ledgerVersion: 1,
      createdAt: base.meta.createdAt || overlay.meta.createdAt,
      documentIds: Array.from(
        new Set([...(base.meta.documentIds || []), ...(overlay.meta.documentIds || [])])
      ),
    },
  };
}

export function missingRequired(ledger: FactLedger): FactKey[] {
  return ALWAYS_REQUIRED.filter((key) => {
    const fact = ledger.facts[key];
    return !fact || !isPresent(fact.value);
  });
}
