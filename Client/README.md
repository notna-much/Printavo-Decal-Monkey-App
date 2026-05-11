# Decal Monkey Field App Client

This frontend powers the Decal Monkey Field App user experience. It is the field-facing React application used by sales reps, measurement staff, and installers.

## Frontend Responsibilities

- Sign-in and shared app session flow
- Inquiry intake
- New order and quote intake flow
- Offsite measurement workflow
- Installer workflow and install completion reporting
- Submission history and pending sync review
- Settings, guide, tips, and device preferences

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS

## Notes

- The live app version is controlled in `src/config/version.ts`.
- The in-app changelog is controlled in `src/config/changelog.ts`.
- Startup guide steps and page tips are controlled in `src/config/onboarding.ts`.

## Licensing

This client is part of the Decal Monkey Field App repository and is covered by the GPLv3 and any separate written commercial licensing agreement described in the root `README.md`.
