export const CHANGELOG = [
  {
    version: "1.0.2",
    label: "Latest Update",
    date: "April 2026",
    changes: [
      "Enhanced device naming with automatic detection and optional custom naming while preventing blank values.",
      "Improved settings experience with clearer Save Connection Settings button, instant feedback, and fixed stuck saving issues.",
      "Improved overall UI feedback so actions clearly confirm without needing to scroll.",
      "Added offline queue system with Pending Sync status and ability to send orders to Printavo when reconnected.",
      "Enhanced back button protection with in-app toast warnings and smarter navigation handling.",
      "Improved submission history to prevent duplicate install records and ensure accurate tracking.",
      "Completed installs can now be edited and updated without creating duplicate history entries, with refreshed timestamps.",
      "Clear History now safely preserves Pending Sync jobs to prevent accidental data loss.",
      "Added a styled in-app confirmation warning before clearing sent history.",
      "Improved installer flow by removing completed jobs from active lists while keeping them accessible in history.",
      "Introduced shared login system with persistent users across all devices.",
      "Added secure session controls with admin-only access to active devices and global logout.",
      "Users can now log themselves out across all devices without affecting others.",
      "General stability and usability improvements for real-world field workflows.",
    ],
  },
  {
    version: "1.0.1",
    label: "Previous Build",
    date: "April 2026",
    changes: [
      "Added Inquiry intake that sends leads straight into Printavo inquiries.",
      "Refreshed the app with a cleaner purple and slate UI palette for a more polished field workflow.",
      "Improved login flow with a cleaner branded screen, version display, and password visibility toggle.",
      "Added installer artwork warnings and restored quick actions for calling customers and opening maps.",
      "Improved settings layout and added in-app changelog viewing.",
    ],
  },
  {
    version: "1.0.0",
    label: "Initial Release",
    date: "April 2026",
    changes: [
      "Released the Decal Monkey Field App with sales, measurements, installer, and Printavo sync workflows.",
      "Added draft saving, submission history, measurement completion flow, and install closeout tools.",
    ],
  },
];