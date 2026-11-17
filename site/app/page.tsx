import { SITE, SHOTS } from "@/site.config";
import { Actions } from "@/components/actions";
import { ShotImage, HeroShot } from "@/components/shot";
import { Behaviour } from "@/components/behaviour";

export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-cta focus:px-4 focus:py-2 focus:text-cta-ink">
        Skip to content
      </a>
      <header className="mx-auto flex max-w-6xl items-center px-5 pt-5 sm:px-8">
        <a href="/" className="-my-2 flex min-h-[44px] items-center gap-2.5 py-2 text-[1.0625rem] font-semibold tracking-tight">
          <img src="/logo.svg" width={30} height={30} alt="" className="size-[30px]" />
          {SITE.name}
        </a>
      </header>

      <main id="main">
        {/* 1. Hero: what it is, and the one action. */}
        <section className="relative">
          <div aria-hidden className="grid-bg pointer-events-none absolute inset-x-0 -top-24 h-[760px]" />
          <div className="relative mx-auto max-w-6xl px-5 pt-16 text-center sm:px-8 sm:pt-24">
            <h1 className="mx-auto max-w-[21ch] text-display font-bold text-balance">
              A canvas where your AI draws your systems
            </h1>
            <p className="mx-auto mt-6 max-w-[36rem] text-lead text-muted text-pretty">
              Blueprint is a free Mac app. Your AI agent draws your systems as maps you can click and edit. Works with Claude Code, Cursor, Codex, or any agent that speaks MCP.
            </p>
            <div className="enter mt-9" style={{ ["--i" as string]: 2 }}>
              <Actions center />
              <p className="mt-4 text-[0.9375rem] text-muted">{SITE.requirement}</p>
            </div>
          </div>
          <div className="relative mx-auto mt-14 max-w-6xl px-3 sm:mt-20 sm:px-8">
            <div className="shot tilt">
              <HeroShot shot={SHOTS.app} />
            </div>
          </div>
        </section>

        {/* 2. Signature: one command, then the map draws in. */}
        <section className="beat mx-auto max-w-6xl px-5 sm:px-8" data-play>
          <div className="grid gap-8">
            <div>
              <h2 className="text-h2 font-bold">Type one command. Get a map.</h2>
            </div>
            <div>
              <p className="inline-flex max-w-full items-center rounded-xl border border-line bg-bg-2 px-4 py-3 font-mono text-[1rem] sm:text-[1.0625rem]">
                <span aria-hidden className="mr-3 text-muted">&gt;</span>
                <span className="cmd-text">/visualize how my coffee shop makes money</span>
                <span aria-hidden className="caret" />
              </p>
            </div>
          </div>
          <div data-draw className="mx-auto mt-12 max-w-[40rem]">
            <div className="shot draw">
              <ShotImage shot={SHOTS.map} sizes="(min-width: 640px) 640px, 100vw" />
            </div>
          </div>
        </section>

        {/* 3. Close: the same action. */}
        <section className="beat relative overflow-hidden">
          <div aria-hidden className="grid-bg pointer-events-none absolute inset-0" style={{ maskImage: "radial-gradient(ellipse 60% 70% at 50% 50%, #000 20%, transparent 75%)" }} />
          <div className="relative mx-auto max-w-6xl px-5 py-12 text-center sm:px-8 sm:py-16" data-reveal>
            <img src="/logo.svg" width={64} height={64} alt="" className="mx-auto mb-8 size-16" />
            <h2 className="text-h2 font-bold">Give your AI a canvas.</h2>
            <div className="mt-10">
              <Actions center />
              <p className="mt-4 text-[0.9375rem] text-muted">{SITE.requirement}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[0.9375rem] text-muted sm:px-8">
          <span className="flex items-center gap-2">
            <img src="/logo.svg" width={20} height={20} alt="" className="size-5" />
            {SITE.name}
          </span>
          <span className="flex flex-wrap gap-x-6">
            <a href={SITE.issuesUrl} className="inline-flex min-h-[44px] items-center underline-offset-4 hover:text-ink hover:underline">
              Report an issue
            </a>
            <a href={SITE.githubUrl} className="inline-flex min-h-[44px] items-center underline-offset-4 hover:text-ink hover:underline">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
      <Behaviour />
    </>
  );
}
