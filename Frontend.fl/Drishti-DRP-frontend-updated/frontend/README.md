# Drishti DRP frontend

The frontend is a React and TypeScript single-page application built with Vite. It currently uses the dependencies already included in this project; it does not require Tailwind CSS, Axios, or React Router.

## Run locally

From this directory:

```sh
npm install
npm run dev
```

The Vite development server prints its local URL when it starts. To create and preview a production build, run `npm run build` and `npm run preview`.

## Backend connection

The dashboard, brand profile, and monitor pages use the FastAPI backend for saved brand profiles, submitted metadata checks, summary counts, and detection history. The social, app, and domain checks analyze only data entered by the analyst; they do not connect to external platforms, inspect APK files, or query DNS.

The Vite development server proxies `/api` to `http://127.0.0.1:8000` by default. Set `VITE_API_PROXY_TARGET` to change that target. For a frontend served separately from the API, set `VITE_API_BASE_URL` to the API origin and configure the backend's `FRONTEND_ORIGINS` setting to allow the frontend origin.

Run the backend from `brandshield-sentinel-backend/brandshield-backend` with `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`, then run the Vite development server as described above.

## Appearance and typography

Light, Dark, and System appearance modes are available in the top bar. The selected mode is stored in browser local storage; System follows the operating-system color preference. Sidebar collapse preference is also stored locally.

Typography uses [Outfit](https://fonts.google.com/specimen/Outfit), loaded from Google Fonts in `index.html` (a single variable-weight request, weights 400-700, `display=swap`). The font stack is defined once as `--font-primary` in `src/index.css` and falls back to the system sans-serif stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`) if Outfit cannot load. The type scale (`--fs-2xs` to `--fs-2xl`) and tracking tokens live at the top of `src/App.css`.

## Motion system

All durations and easings are CSS custom properties in `src/App.css` (`--duration-*`, `--ease-*`, `--transition-interactive`). Cards (`.panel`, `.stat-card`) share one hover pattern (scale, lift, border and glow) that can be tuned per card with `--card-scale`, `--card-lift` and `--card-accent`. Zoom and lift only run on hover-capable pointers when `prefers-reduced-motion` is not set; smooth scrolling for in-page anchors (`#id` links, such as the skip link) is also disabled for reduced motion. A reusable `.media-card` overlay pattern is included for future thumbnail cards.
