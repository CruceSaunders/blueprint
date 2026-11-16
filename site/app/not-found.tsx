import type { Metadata } from "next";
import { SITE } from "@/site.config";

export const metadata: Metadata = { title: `Page not found | ${SITE.name}` };

export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-svh flex-col items-center justify-center px-5 text-center">
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0" />
      <div className="relative">
        <img src="/logo.svg" width={56} height={56} alt="" className="mx-auto mb-8 size-14" />
        <h1 className="text-h2 font-bold">This page isn&rsquo;t on the map.</h1>
        <p className="mt-4 text-lead text-muted">The link may be old or mistyped.</p>
        <a href="/" className="btn btn-primary mt-9">
          Go to the {SITE.name} home page
        </a>
      </div>
    </main>
  );
}
