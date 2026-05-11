# Decal Monkey Field App

Decal Monkey Field App is an internal field workflow system built for Decal Monkey's sales and install process. It connects the field team to Printavo so reps and installers can capture inquiries, build orders, complete offsite measurements, review job history, and close out installs from one app.

## What It Does

- Captures quick customer inquiries and sends them into Printavo inquiries.
- Builds full order intake for quoting with customer details, line items, artwork notes, and field notes.
- Supports offsite measurement workflows with photos, markup, and measurement completion updates.
- Supports installer workflows for install-ready jobs, customer contact details, mapping, artwork review, and completion reporting.
- Tracks submission history, pending sync records, and completed install snapshots.
- Includes shared app logins, active session controls, device naming, and field-friendly settings tools.

## App Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express
- Integrations: Printavo API and Printavo inquiry form flow

## Project Structure

- `Client/` contains the React frontend.
- `Server/` contains the Express backend.
- `Client/src/config/changelog.ts` contains the in-app changelog shown inside Settings.
- `CHANGELOG.md` contains the repository changelog in markdown form.

## Repository Safety

This repository should not contain live secrets, production `.env` files, uploaded files, dependency folders, or built frontend bundles.

Use `Server/.env.example` as the setup template for local and deployed environments.

Required backend environment variables include:

- `PRINTAVO_EMAIL`
- `PRINTAVO_TOKEN`
- `PRINTAVO_INQUIRY_KEY`

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

## Licensing

This project is released under the GNU General Public License v3.0.

You may use, study, modify, and redistribute it under the GPLv3. Commercial licensing, proprietary use arrangements, white-label arrangements, bundling arrangements, and full intellectual property acquisition can be discussed directly with the repository owner under a separate written agreement.
