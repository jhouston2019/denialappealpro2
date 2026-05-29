"use client";

import { useEffect, useState } from "react";

export function StartingAtPrice() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plan-prices", { cache: "no-store" });
        const data = await res.json();
        const single = data.plans?.single;
        if (!cancelled && single?.amountFormatted) {
          setLabel(
            `Starting at ${single.amountFormatted} • Multiple plans available`
          );
        }
      } catch {
        /* fallback below */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="text-sm text-slate-400">
      {label ?? "Multiple plans available — see pricing"}
    </span>
  );
}
