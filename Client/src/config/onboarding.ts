export const QUICK_GUIDE_STEPS = [
  {
    id: "welcome",
    badge: "Start Here",
    title: "Welcome to the Decal Monkey Field App",
    body:
      "This app helps the team capture inquiries, build orders, complete offsite measurements, and finish install reports without losing the handoff to Printavo.",
    bullets: [
      "Use the main home buttons to pick the workflow you need.",
      "Settings gives you device info, guide controls, shared logins, and connection tools.",
    ],
  },
  {
    id: "home",
    badge: "Main Actions",
    title: "Use the home screen as your launch point",
    body:
      "Each button on the home screen maps to a real shop workflow so users can move quickly without guessing where to go next.",
    bullets: [
      "New Order is for full quote and order capture.",
      "Offsite Measurements is for jobs waiting on site photos and measurements.",
      "Installation is for jobs ready for the install crew.",
      "Inquiry is for fast lead capture before a full order is needed.",
    ],
  },
  {
    id: "safety",
    badge: "Safety Nets",
    title: "The app protects work in progress",
    body:
      "This build includes a few guardrails so field work is less likely to get lost when the day gets messy.",
    bullets: [
      "Pending Sync keeps unsent jobs safe if the backend or internet is unavailable.",
      "Submission History keeps sent work and install closeouts easy to review.",
      "Back button protection helps prevent accidental exits while working.",
    ],
  },
  {
    id: "tips",
    badge: "Tips",
    title: "Page tips can keep helping after this guide",
    body:
      "After you close this quick guide, smaller screen tips can appear as users move through the app. Both the startup guide and tips can be turned on or off in Settings.",
    bullets: [
      "Use Don't show at startup if this guide should stop appearing after sign-in.",
      "Turn Show Tips on in Settings to keep the smaller page tips available.",
    ],
  },
];

export const SCREEN_TIPS: Record<
  string,
  {
    title: string;
    body: string;
    actions?: string[];
  }
> = {
  home: {
    title: "Home Screen Tip",
    body:
      "Start from the workflow you actually need instead of forcing every job through the same path.",
    actions: [
      "Tap New Order for a full quote build.",
      "Tap Measurements for OFFSITE - MEASUREMENT jobs.",
      "Tap Installation for ORDER READY FOR INSTALL jobs.",
    ],
  },
  wizard: {
    title: "New Order Tip",
    body:
      "Move step by step and focus on giving the shop the details they need later, not just enough to get through the form.",
    actions: [
      "Use line items clearly.",
      "Add useful mockup notes and field details.",
      "Review before submitting so the Printavo handoff stays clean.",
    ],
  },
  existing: {
    title: "Measurements Tip",
    body:
      "Refresh this list when you expect a job to appear. Only quotes in OFFSITE - MEASUREMENT should show here.",
    actions: [
      "Open a job to capture real site measurements and photos.",
      "Use edit when you need to reopen and update an existing measurement path.",
    ],
  },
  measurement: {
    title: "Measurement Detail Tip",
    body:
      "Use photos, markup notes, and surface details to remove guesswork for production and install.",
    actions: [
      "Capture dimensions clearly.",
      "Mark up placement or obstacles on photos when needed.",
      "Submit when the field package is complete.",
    ],
  },
  installer: {
    title: "Installer List Tip",
    body:
      "This screen is for jobs that are ready for the install crew. Refresh if a job was just moved into install-ready status in Printavo.",
    actions: [
      "Open the job to review contact info, location details, and artwork.",
      "Use the sync status at the top to spot stale job data.",
    ],
  },
  "installer-detail": {
    title: "Installer Job Tip",
    body:
      "Double-check the location, contact details, and artwork before leaving for the site.",
    actions: [
      "Use the quick call and map actions when available.",
      "Move into the completion screen once the crew is ready to close out the job.",
    ],
  },
  "installer-completion": {
    title: "Install Completion Tip",
    body:
      "Use this screen to record the true job outcome and upload clear finish photos for the shop record.",
    actions: [
      "Add completion notes that explain issues or follow-up needs.",
      "Include photos that make the result easy to review later.",
    ],
  },
  "installer-complete-success": {
    title: "Completion Saved Tip",
    body:
      "This job is now stored in history. If something needs to be corrected later, reopen it from Submission History instead of creating duplicate records.",
  },
  history: {
    title: "Submission History Tip",
    body:
      "History is the safest place to review what was sent, what completed successfully, and what still needs attention.",
    actions: [
      "Pending Sync items should be retried, not deleted.",
      "Completed installs can be reopened and updated from history.",
    ],
  },
  "submission-detail": {
    title: "History Detail Tip",
    body:
      "Use this view to confirm what was sent and decide whether the record should be retried or reopened for edits.",
  },
  inquiry: {
    title: "Inquiry Tip",
    body:
      "Inquiry is best for quick lead capture before a customer is ready for a full quote build.",
    actions: [
      "Capture contact info clearly.",
      "Use the notes area to describe what the customer is asking for.",
    ],
  },
  settings: {
    title: "Settings Tip",
    body:
      "This is the control panel for device info, guide preferences, shared logins, and admin tools.",
    actions: [
      "Leave Device Name blank to use auto-detection.",
      "Use Guide & Suggestions to control the startup guide and tips.",
    ],
  },
  "app-guide": {
    title: "Full Guide Tip",
    body:
      "This page is the longer walkthrough. Use it when someone needs the full workflow explained, not just a quick reminder.",
  },
};
