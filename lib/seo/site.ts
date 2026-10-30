export const SITE_ORIGIN = "https://www.denialappealpro.com";

/** App Router paths that are public (not disallowed in public/robots.txt). */
export const APP_PUBLIC_PATHS = [
  "/",
  "/analysis-preview",
  "/contact",
  "/hipaa",
  "/privacy",
  "/pricing",
  "/upload",
  "/login",
  "/register",
  "/terms",
] as const;

export function absoluteCanonical(path: string): string {
  if (path === "/") return `${SITE_ORIGIN}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
