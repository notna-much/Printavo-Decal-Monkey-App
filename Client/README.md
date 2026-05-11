# Decal Monkey Field App Client

This frontend powers the Decal Monkey Field App user experience. It is the field-facing React application used by sales reps, measurement staff, and installers.

## Frontend Responsibilities

- Sign-in and shared app session flow
- Inquiry intake for quick capture quotes that feed into Printavo inquiries
- New order wizard for guided quote and order intake
- Offsite measurement workflow
- Installer workflow with artwork review, install completion reporting, completed-job photo uploads, Printavo install notes, and installed status updates
- Submission history and pending sync review
- Settings, quick guide, tool tips, and device preferences

## Workflow Highlights

- The inquiry screen is built for fast lead capture when a customer is not ready for a full order yet.
- The new order flow uses a wizard so reps can move step by step through customer info, products, measurements, artwork notes, and review.
- The installer completion flow allows installers to upload finished-job photos, save closeout notes, push those notes into Printavo, and mark the job as installed.
- Built-in quick guide and page tool tips help new users understand what each section does and what to click next.

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
