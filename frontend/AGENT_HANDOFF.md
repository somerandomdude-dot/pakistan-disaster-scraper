# Agent Handoff: Dark Mode Implementation

## State
- The previous agent (Opus) exhausted tokens before fully completing the request and generating this file.
- We have taken over and manually added the `@media (prefers-color-scheme: dark)` CSS variable block to `src/app/globals.css`.

## Changes Made
- Modified `frontend/src/app/globals.css` to include dark mode variables mapped to the existing CSS variable names.

## Next Steps
- Review frontend React components to ensure they rely on the CSS variables (via Tailwind `bg-background`, `text-text-primary`, etc.) instead of hardcoded hex values or generic `bg-white` classes.
- Update hardcoded colors in `globals.css` (e.g. `.map-shell`, `.map-actions` backgrounds) to use the CSS variables so they also react to the system theme correctly.
