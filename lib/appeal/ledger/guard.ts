import type { FactLedger } from "./types";

export function isFactLedger(value: unknown): value is FactLedger {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<FactLedger>;
  return (
    !!v.facts &&
    typeof v.facts === "object" &&
    Array.isArray(v.enclosures) &&
    !!v.meta &&
    typeof v.meta === "object" &&
    v.meta.ledgerVersion === 1
  );
}
