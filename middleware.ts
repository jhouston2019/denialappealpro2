import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ARTICLE = /^\/appeals\/(learn|ai|seo)\/(.+)$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(ARTICLE);
  if (!match) return NextResponse.next();
  if (match[2].endsWith(".html")) return NextResponse.next();

  const destination = new URL(
    `https://www.denialappealpro.com${pathname}.html`
  );
  return NextResponse.redirect(destination, 301);
}

export const config = {
  matcher: ["/appeals/learn/:path+", "/appeals/ai/:path+", "/appeals/seo/:path+"],
};
