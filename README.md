<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fbba5e0d-9288-4b2c-bba4-e792bbc852f5

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and set the required values. `BZZOIRO_API_KEY` powers sports data features, and `GEMINI_API_KEY` is only needed when Gemini-powered features are enabled.
3. Run the app:
   `npm run dev`
4. Run tests:
   `npm test`
