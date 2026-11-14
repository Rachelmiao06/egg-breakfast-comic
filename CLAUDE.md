# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive scroll-driven web comic ("荷包蛋的早餐"): a full-screen animated kitchen scene, then a six-panel fried-egg story revealed panel by panel on scroll. The product spec is `SPEC.md` (scope, UX, acceptance criteria, build order); `PROMPT-step1.md` is the brief for the first build step. Read `SPEC.md` before changing behaviour. Source artwork is hand-drawn PNGs; never redraw assets in code.

## Commands

- `npm run dev` — dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build; run before pushing to catch type/route errors
- `npm run lint` — ESLint (`eslint-config-next`)
- No test runner is set up yet.

## Rhythm (read before touching any animation or sound)

- One source of truth for pacing: `src/lib/beats.json` (readable: `docs/BEATS.md`, live tuning: `/dev/beats`). `<ScrollDriver>` maps scroll → `useScene().timeline`; everything else is derived (`derive`, `envelope`, `phaseProgress`, `loopLevels` in `src/lib/beats.ts`). Never add another scroll listener or ScrollTrigger.
- After editing beats.json run `node tools/beats_table.mjs` to regenerate `docs/BEATS.md`. Tune scroll lengths first, then `seconds`.

## Stack notes

- Next.js 16 App Router, TypeScript, `src/app/` with `@/*` → `src/*`. This Next version differs from older training data: check `node_modules/next/dist/docs/` before using an API you are unsure of (see `AGENTS.md`, which `next dev` regenerates).
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`, hides dev indicators, and wires Tailwind CSS v4 through the `@tailwindcss/turbopack` loader. Tailwind is configured in `src/app/globals.css`, not a `tailwind.config` file.
- Deployed on Vercel (project `egg-breakfast-comic`, production branch `main`). `.vercel/` and `.env*` are git-ignored; `.env.example` lists variable names only.

## Working rules

- After every meaningful change that works, commit with a descriptive message.
- Never commit real secrets. Public config uses the NEXT_PUBLIC_ prefix; secret keys stay server-side only.
