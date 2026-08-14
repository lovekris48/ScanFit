# ScanFit

AI-powered fitness app prototype for physique-based training, nutrition, supplement, and progress recommendations.

## Run locally

1. Install Node.js 18+.
2. Open Terminal in this folder.
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL Vite prints (usually `http://localhost:5173`).

## Important prototype note

The original Claude artifact used `window.storage`. This project includes a localStorage fallback so the interface can run in a normal browser.

The physique AI analysis currently calls Anthropic directly from the frontend. That should be moved to a backend/serverless function before real deployment. Do not commit an Anthropic API key to this repository.

## Main files

- `src/App.jsx` — original ScanFit prototype
- `src/main.jsx` — React entry point + browser storage fallback
- `package.json` — dependencies and run scripts
