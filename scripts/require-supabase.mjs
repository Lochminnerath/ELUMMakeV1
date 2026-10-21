// Require Supabase for production deploys, but allow preview mode.
// In preview/PR contexts, the app falls back to localStorage for accounts.
// This script is run during the Netlify build step.

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

// In deploy-preview context (PR builds), skip the Supabase requirement.
const context = process.env.CONTEXT || "deploy-preview";

if (context === "production" || context === "deploy") {
  const problems = [];
  if (!url) problems.push("VITE_SUPABASE_URL");
  if (!key) problems.push("VITE_SUPABASE_ANON_KEY");

  if (problems.length) {
    console.error(`
This site is not connected to Supabase, so accounts would never be saved:
  - ${problems.join("\n  - ")}

Fix: in Netlify, open this site > Site configuration > Environment variables, and add
  VITE_SUPABASE_URL       your project URL (Supabase > Project Settings > API > Project URL)
  VITE_SUPABASE_ANON_KEY  the anon public key (same page, "Project API keys")
for all deploy contexts. Then trigger a new deploy (Deploys > Trigger deploy > Clear cache and deploy).
`);
    process.exit(1);
  }
  console.log(`Connected to Supabase at ${url}.`);
} else {
  console.log(`Preview mode: Supabase not required (context: ${context}).`);
}
