# AGENTS.md

## Project Overview
- `pad-clock` is a static Firebase Hosting app.
- Runtime files live in `public/`:
  - `public/index.html` defines the full UI shell.
  - `public/style.css` contains the complete visual system.
  - `public/app.js` contains all client logic.
- Deployment is configured in `firebase.json` and GitHub Actions under `.github/workflows/`.
- There is no build step, bundler, framework, or package manager in this repo.

## Working Rules
- Keep changes minimal and targeted.
- Preserve the current architecture unless the task explicitly asks for a refactor.
- Do not introduce a build tool, transpiler, or dependency manager just to make a change.
- Assume the app must continue to work as plain static files served from `public/`.

## JavaScript Guidelines
- Maintain compatibility with older mobile browsers noted in `public/app.js`.
- Prefer ES5-style syntax already used in the project:
  - use `var`, not `let` or `const`
  - use classic function expressions when touching existing code
  - avoid modules and modern tooling assumptions
- Do not replace `XMLHttpRequest` with `fetch` unless the user explicitly requests a browser support change.
- Reuse existing helpers and cache patterns before adding new abstractions.

## HTML/CSS Guidelines
- Preserve the current single-page structure in `public/index.html`.
- Keep the cyberpunk visual direction unless asked to redesign it.
- Favor compatibility-oriented CSS patterns already present in `public/style.css`.
- Be careful with layout changes: this app appears intended for tablet-like fullscreen use.

## Product Constraints
- UI copy is currently French; keep new user-facing text consistent unless asked otherwise.
- Weather and news depend on external APIs configured in `public/app.js`; avoid changing providers without a clear reason.
- Local caching uses `localStorage`; keep cache key changes deliberate and backward compatible when possible.

## Validation
- For quick local checks, serve `public/` with a simple static server.
- If you need a no-dependency option, use `python3 -m http.server` from the repo root and open the site locally.
- After behavior changes, verify:
  - clock rendering still updates every second
  - weather still works with geolocation failure fallback
  - news rotation still behaves when the feed is unavailable
  - layout remains usable on a tablet-sized viewport

## Deployment Notes
- Firebase Hosting serves from `public/` and rewrites all routes to `index.html`.
- The main deploy workflow is `.github/workflows/firebase-hosting-merge.yml`.
- Avoid changing Firebase project or workflow settings unless the task is deployment-related.
