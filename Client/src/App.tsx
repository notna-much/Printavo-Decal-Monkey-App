// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  mockDefaultForm,
  mockExistingOrders,
  mockInstallJobs,
  mockSubmittedOrders,
} from "./data/mockData";

import { getStored, setStored } from "./utils/storage";

import HomeScreen from "./screens/HomeScreen";
import ExistingOrdersScreen from "./screens/ExistingOrdersScreen";
import HistoryScreen from "./screens/HistoryScreen";
import InstallerScreen from "./screens/InstallerScreen";
import InstallerDetailScreen from "./screens/InstallerDetailScreen";
import InstallerCompletionScreen from "./screens/InstallerCompletionScreen";
import InstallerCompleteSuccessScreen from "./screens/InstallerCompleteSuccessScreen";
import SettingsScreen from "./screens/SettingsScreen";
import WizardScreen from "./screens/WizardScreen";
import SubmissionDetailScreen from "./screens/SubmissionDetailScreen";
import AppGuideScreen from "./screens/AppGuideScreen";
import MeasurementScreen from "./screens/MeasurementScreen";
import LoginScreen from "./screens/LoginScreen";
import InquiryScreen from "./screens/InquiryScreen";
import {
  clearStoredAuthSession,
  createEmptyAppUser,
  fetchSharedAuthSessions,
  fetchSharedAuthUsers,
  getDefaultScreenForRole,
  isScreenAllowedForRole,
  loadStoredAuthSession,
  loadStoredAuthUsers,
  loginSharedAuthUser,
  logoutAllSharedAuthUsers,
  logoutMySharedAuthDevices,
  logoutSharedAuthUser,
  resetSharedAuthUsers,
  saveStoredAuthSession,
  saveStoredAuthUsers,
  saveSharedAuthUsers,
  validateStoredSession,
} from "./utils/auth";

const MOCKUP_PLACEHOLDER = "Specify Size, Placement, and any necessary details";

function showBackPressToast(message: string) {
  if (typeof document === "undefined") return;

  const existing = document.getElementById("dm-back-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "dm-back-toast";

  toast.style.position = "fixed";
  toast.style.top = "16px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%) translateY(-10px)";
  toast.style.background = "#ffffff";
  toast.style.color = "#1f2937";
  toast.style.padding = "14px 18px";
  toast.style.borderRadius = "16px";
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "600";
  toast.style.boxShadow = "0 12px 30px rgba(0,0,0,0.15)";
  toast.style.border = "1px solid #e5e7eb";
  toast.style.zIndex = "99999";
  toast.style.maxWidth = "calc(100vw - 32px)";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "10px";
  toast.style.opacity = "0";
  toast.style.transition = "all 180ms ease";

  const icon = document.createElement("div");
  icon.textContent = "⚠️";
  icon.style.fontSize = "16px";

  const label = document.createElement("div");
  label.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(label);
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0px)";
  });

window.setTimeout(() => {
  toast.style.opacity = "0";
  toast.style.transform = "translateX(-50%) translateY(-10px)";
  window.setTimeout(() => toast.remove(), 180);
}, 3200);
}

function cloneDefaultForm(currentUser: string) {
  return {
    ...mockDefaultForm,
    customerOwner: currentUser,
    jobNickname: "",
    offsiteMeasurementsNeeded: false,
    unableToTakePhotosNow: false,
    photoEntries: [],
    productTypes: [],
    lineItems: [],
    productionFiles: [],
    mockupInstructions: "",
  };
}

function buildPrintavoMetaFromResponse(data: any) {
  const visualId =
    data?.visualId ||
    data?.quote?.visualId ||
    data?.quote?.id ||
    data?.quoteId ||
    "";

  const quoteId = data?.quoteId || data?.quote?.id || "";
  const publicUrl = data?.publicUrl || data?.quote?.publicUrl || "";

  const normalizedVisualId = String(visualId || "").replace("#", "");

  return {
    printavoQuoteId: quoteId ? String(quoteId) : "",
    printavoQuoteNumber: normalizedVisualId,
    printavoPublicUrl: publicUrl || "",
  };
}

function normalizeInstallJob(job: any) {
  return {
    ...job,
    id: String(job?.id || ""),
    invoiceNumber:
      job?.printavoQuoteNumber ||
      job?.invoiceNumber ||
      String(job?.id || "").replace("#", ""),
    printavoQuoteNumber:
      job?.printavoQuoteNumber ||
      job?.invoiceNumber ||
      String(job?.id || "").replace("#", ""),
    nickname: job?.nickname || job?.company || job?.customer || "Untitled",
    customer:
      job?.customer ||
      [job?.firstName, job?.lastName].filter(Boolean).join(" ").trim() ||
      job?.company ||
      "Unknown Customer",
    phone: job?.phone || "",
    email: job?.email || "",
    address: job?.address || "",
    city: job?.city || "",
    state: job?.state || "",
    zip: job?.zip || "",
    status: job?.status || "Job",
    mockup: job?.mockup || "",
    photoEntries: Array.isArray(job?.photoEntries) ? job.photoEntries : [],
    lineItems: Array.isArray(job?.lineItems) ? job.lineItems : [],
    productionFiles: Array.isArray(job?.productionFiles)
      ? job.productionFiles
      : [],
  };
}

function mergeInstallJobsPreservingCompleted(
  previousJobs: any[],
  fetchedJobs: any[]
) {
  const previous = Array.isArray(previousJobs) ? previousJobs : [];
  const incoming = (Array.isArray(fetchedJobs) ? fetchedJobs : []).map(
    normalizeInstallJob
  );

  const previousById = new Map(previous.map((job: any) => [job.id, job]));
  const incomingIds = new Set(incoming.map((job: any) => job.id));

  const mergedIncoming = incoming.map((job: any) => {
    const existing = previousById.get(job.id);

    if (!existing) return job;

    return {
      ...existing,
      ...job,
      installCompletion: existing.installCompletion || job.installCompletion,
      photoEntries:
        Array.isArray(existing.photoEntries) && existing.photoEntries.length
          ? existing.photoEntries
          : job.photoEntries || [],
      lineItems:
        Array.isArray(existing.lineItems) && existing.lineItems.length
          ? existing.lineItems
          : job.lineItems || [],
      productionFiles:
        Array.isArray(existing.productionFiles) &&
        existing.productionFiles.length
          ? existing.productionFiles
          : job.productionFiles || [],
    };
  });

  const preservedCompletedOnly = previous.filter(
    (job: any) => job.installCompletion && !incomingIds.has(job.id)
  );

  return [...mergedIncoming, ...preservedCompletedOnly];
}

function getSortableTimestamp(value: any) {
  const dateValue = value ? new Date(value).getTime() : 0;
  return Number.isFinite(dateValue) ? dateValue : 0;
}

function mergeMeasurementJobs(previousJobs: any[], fetchedJobs: any[]) {
  const previous = Array.isArray(previousJobs) ? previousJobs : [];
  const incoming = (Array.isArray(fetchedJobs) ? fetchedJobs : []).map(
    normalizeInstallJob
  );

  const previousById = new Map(previous.map((job: any) => [job.id, job]));

  const merged = incoming.map((job: any) => {
    const existing = previousById.get(job.id);

    if (!existing) return job;

    const incomingHasPhotoEntries =
      Array.isArray(job.photoEntries) && job.photoEntries.length > 0;
    const existingHasPhotoEntries =
      Array.isArray(existing.photoEntries) && existing.photoEntries.length > 0;

    const incomingHasLineItems =
      Array.isArray(job.lineItems) && job.lineItems.length > 0;
    const existingHasLineItems =
      Array.isArray(existing.lineItems) && existing.lineItems.length > 0;

    const incomingHasProductionFiles =
      Array.isArray(job.productionFiles) && job.productionFiles.length > 0;
    const existingHasProductionFiles =
      Array.isArray(existing.productionFiles) &&
      existing.productionFiles.length > 0;

    return {
      ...existing,
      ...job,
      photoEntries:
        incomingHasPhotoEntries
          ? job.photoEntries
          : existingHasPhotoEntries
          ? existing.photoEntries
          : [],
      lineItems:
        incomingHasLineItems
          ? job.lineItems
          : existingHasLineItems
          ? existing.lineItems
          : [],
      productionFiles:
        incomingHasProductionFiles
          ? job.productionFiles
          : existingHasProductionFiles
          ? existing.productionFiles
          : [],
      locationType: job.locationType || existing.locationType || "",
      surfaceType: job.surfaceType || existing.surfaceType || "",
      surfaceOther: job.surfaceOther || existing.surfaceOther || "",
      installNeeded:
        typeof job.installNeeded === "boolean"
          ? job.installNeeded
          : typeof existing.installNeeded === "boolean"
          ? existing.installNeeded
          : false,
      installSameAsCustomer:
        typeof job.installSameAsCustomer === "boolean"
          ? job.installSameAsCustomer
          : typeof existing.installSameAsCustomer === "boolean"
          ? existing.installSameAsCustomer
          : true,
      installAddress: job.installAddress || existing.installAddress || "",
      installCity: job.installCity || existing.installCity || "",
      installState: job.installState || existing.installState || "",
      installZip: job.installZip || existing.installZip || "",
      offsiteMeasurementsNeeded:
        typeof job.offsiteMeasurementsNeeded === "boolean"
          ? job.offsiteMeasurementsNeeded
          : typeof existing.offsiteMeasurementsNeeded === "boolean"
          ? existing.offsiteMeasurementsNeeded
          : false,
      unableToTakePhotosNow:
        typeof job.unableToTakePhotosNow === "boolean"
          ? job.unableToTakePhotosNow
          : typeof existing.unableToTakePhotosNow === "boolean"
          ? existing.unableToTakePhotosNow
          : false,
      logoStatus: job.logoStatus || existing.logoStatus || "Customer provided",
      colorNotes: job.colorNotes || existing.colorNotes || "",
      mockupInstructions: job.mockupInstructions || existing.mockupInstructions || "",
      artworkStatus: job.artworkStatus || existing.artworkStatus || "",
      sendArtworkRequest:
        typeof job.sendArtworkRequest === "boolean"
          ? job.sendArtworkRequest
          : typeof existing.sendArtworkRequest === "boolean"
          ? existing.sendArtworkRequest
          : false,
      additionalInquiries:
        job.additionalInquiries || existing.additionalInquiries || "",
      modifiedAt: job.modifiedAt || existing.modifiedAt || "",
    };
  });

  return merged.sort((a: any, b: any) => {
    const timeDiff = getSortableTimestamp(b.modifiedAt) - getSortableTimestamp(a.modifiedAt);
    if (timeDiff !== 0) return timeDiff;
    return String(b.printavoQuoteNumber || b.invoiceNumber || "").localeCompare(
      String(a.printavoQuoteNumber || a.invoiceNumber || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    );
  });
}

function formatInstallDebugMessage(
  debug: any,
  fetchedCount: number,
  refreshedAt: string
) {
  const timeText = refreshedAt
    ? `Last synced ${new Date(refreshedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}.`
    : "";

  if (!debug) {
    return fetchedCount
      ? `Refreshed ${fetchedCount} active job${
          fetchedCount === 1 ? "" : "s"
        }. ${timeText}`.trim()
      : `No active install jobs were returned. ${timeText}`.trim();
  }

  const parts = [
    fetchedCount
      ? `Refreshed ${fetchedCount} active job${fetchedCount === 1 ? "" : "s"}.`
      : "No active install jobs were returned.",
  ];

  if (typeof debug.invoiceCount === "number") {
    parts.push(`Invoices: ${debug.invoiceCount}`);
  }

  if (debug.message) {
    parts.push(String(debug.message));
  }

  if (timeText) {
    parts.push(timeText);
  }

  return parts.join(" ");
}

function formatMeasurementDebugMessage(
  debug: any,
  fetchedCount: number,
  refreshedAt: string
) {
  const timeText = refreshedAt
    ? `Last synced ${new Date(refreshedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}.`
    : "";

  if (!debug) {
    return fetchedCount
      ? `Refreshed ${fetchedCount} offsite measurement job${
          fetchedCount === 1 ? "" : "s"
        }. ${timeText}`.trim()
      : `No offsite measurement jobs were returned. ${timeText}`.trim();
  }

  const parts = [
    fetchedCount
      ? `Refreshed ${fetchedCount} offsite measurement job${
          fetchedCount === 1 ? "" : "s"
        }.`
      : "No offsite measurement jobs were returned.",
  ];

  if (typeof debug.quoteCount === "number") {
    parts.push(`Quotes: ${debug.quoteCount}`);
  }

  if (debug.message) {
    parts.push(String(debug.message));
  }

  if (timeText) {
    parts.push(timeText);
  }

  return parts.join(" ");
}

function parseMaybeJson(response: Response, rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(
      response.ok
        ? "Unexpected server response. Expected JSON."
        : rawText || "Server request failed."
    );
  }
}

function dataUrlToFile(dataUrl: string, fallbackName: string) {
  const matches = String(dataUrl || "").match(/^data:(.*?);base64,(.*)$/);
  if (!matches) {
    return null;
  }

  const mimeType = matches[1] || "image/jpeg";
  const base64Data = matches[2] || "";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  let extension = "jpg";
  if (mimeType.includes("png")) extension = "png";
  if (mimeType.includes("webp")) extension = "webp";
  if (mimeType.includes("gif")) extension = "gif";
  if (mimeType.includes("svg")) extension = "svg";

  return new File([bytes], `${fallbackName}.${extension}`, {
    type: mimeType,
  });
}

function uniqueStrings(values: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}


function normalizeSnapshotValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normalizeSnapshotValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = normalizeSnapshotValue(value[key]);
        return acc;
      }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value ?? "";
}

function buildComparableFormSnapshot(rawForm: any) {
  const safeForm = rawForm || {};

  const snapshot = {
    jobNickname: safeForm.jobNickname || "",
    firstName: safeForm.firstName || "",
    lastName: safeForm.lastName || "",
    customerOwner: safeForm.customerOwner || "",
    company: safeForm.company || "",
    phone: safeForm.phone || "",
    email: safeForm.email || "",
    address: safeForm.address || "",
    city: safeForm.city || "",
    state: safeForm.state || "",
    zip: safeForm.zip || "",
    additionalInquiries: safeForm.additionalInquiries || "",
    productTypes: Array.isArray(safeForm.productTypes)
      ? [...safeForm.productTypes]
          .map((item: any) => String(item || "").trim())
          .sort()
      : [],
    printedDecalFinish: safeForm.printedDecalFinish || "",
    wallGraphicType: safeForm.wallGraphicType || "",
    wallGraphicFinish: safeForm.wallGraphicFinish || "",
    otherProductType: safeForm.otherProductType || "",
    locationType: safeForm.locationType || "",
    surfaceType: safeForm.surfaceType || "",
    surfaceOther: safeForm.surfaceOther || "",
    installNeeded: !!safeForm.installNeeded,
    installSameAsCustomer:
      typeof safeForm.installSameAsCustomer === "boolean"
        ? safeForm.installSameAsCustomer
        : true,
    installAddress: safeForm.installAddress || "",
    installCity: safeForm.installCity || "",
    installState: safeForm.installState || "",
    installZip: safeForm.installZip || "",
    offsiteMeasurementsNeeded: !!safeForm.offsiteMeasurementsNeeded,
    unableToTakePhotosNow: !!safeForm.unableToTakePhotosNow,
    logoStatus: safeForm.logoStatus || "",
    colorNotes: safeForm.colorNotes || "",
    mockupInstructions: safeForm.mockupInstructions || "",
    artworkStatus: safeForm.artworkStatus || "",
    sendArtworkRequest: !!safeForm.sendArtworkRequest,
    lineItems: Array.isArray(safeForm.lineItems)
      ? safeForm.lineItems.map((item: any) => ({
          id: item?.id || "",
          category: item?.category || "",
          quantity: String(item?.quantity || ""),
          color: item?.color || "",
          description: item?.description || "",
          finish: item?.finish || "",
          otherDetails: item?.otherDetails || "",
        }))
      : [],
    photoEntries: Array.isArray(safeForm.photoEntries)
      ? safeForm.photoEntries.map((entry: any) => ({
          id: entry?.id || "",
          name: entry?.name || "",
          width: String(entry?.width || ""),
          widthUnit: entry?.widthUnit || "in",
          height: String(entry?.height || ""),
          heightUnit: entry?.heightUnit || "in",
          quantity: String(entry?.quantity || ""),
          imageData: entry?.imageData || "",
          annotatedImageData: entry?.annotatedImageData || "",
          markupNotes: entry?.markupNotes || "",
        }))
      : [],
    productionFiles: Array.isArray(safeForm.productionFiles)
      ? safeForm.productionFiles.map((file: any) => ({
          id: file?.id || "",
          name: file?.name || "",
          type: file?.type || "",
          size: file?.size || "",
          fileData:
            file?.dataUrl ||
            file?.imageData ||
            file?.fileData ||
            file?.preview ||
            file?.previewUrl ||
            file?.url ||
            "",
        }))
      : [],
  };

  return JSON.stringify(normalizeSnapshotValue(snapshot));
}

export default function App() {
  const steps = useMemo(
    () => [
      "Customer Information",
      "What are we making?",
      "Where is it going?",
      "Measurements & Photos",
      "Artwork & Design",
      "Additional Customer Inquiries",
      "Review & Submit",
    ],
    []
  );

  const [screen, setScreenState] = useState("home");
  const [authUsers, setAuthUsers] = useState(() => loadStoredAuthUsers());
  const [activeAuthSessions, setActiveAuthSessions] = useState<any[]>([]);
  const [authUser, setAuthUser] = useState(() => loadStoredAuthSession());
  const [loginMessage, setLoginMessage] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState(() =>
    getStored("dm_api_base_url", "http://localhost:3001")
  );
  const [mainEmail, setMainEmail] = useState(() =>
    getStored("dm_main_email", "info@decalmonkey.biz")
  );
  const [deviceName, setDeviceName] = useState(() =>
    getStored("dm_device_name", "web")
  );
  const [currentUser, setCurrentUser] = useState(() =>
    getStored(
      "dm_current_user",
      loadStoredAuthSession()?.displayName || "Heather R."
    )
  );
  const [submitState, setSubmitState] = useState({
    loading: false,
    message: "",
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [connectionState, setConnectionState] = useState({
    loading: false,
    status: "idle",
    message: "",
  });
  const [selectedInstall, setSelectedInstall] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState(null);
  const [lastCompletedInstall, setLastCompletedInstall] = useState(null);
  const [editingSubmittedOrder, setEditingSubmittedOrder] = useState(null);
  const [step, setStep] = useState(1);
  const [draftStatus, setDraftStatus] = useState("Draft idle");
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadJobsMessage, setLoadJobsMessage] = useState("");
  const [loadingMeasurementJobs, setLoadingMeasurementJobs] = useState(false);
  const [measurementJobsMessage, setMeasurementJobsMessage] = useState("");
  const [measurementSearchTerm, setMeasurementSearchTerm] = useState("");
  const [activeDraftId, setActiveDraftId] = useState(() =>
    getStored("decal_monkey_outside_sales_active_draft_id", null)
  );
  const [savedDrafts, setSavedDrafts] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("decal_monkey_outside_sales_drafts") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [submittedOrders, setSubmittedOrders] = useState(() => {
    try {
      const saved = localStorage.getItem("dm_submitted_orders");
      return saved ? JSON.parse(saved) : mockSubmittedOrders;
    } catch {
      return mockSubmittedOrders;
    }
  });

  const [existingOrders, setExistingOrders] = useState(() => {
    try {
      const saved = localStorage.getItem("dm_existing_orders");
      return saved ? JSON.parse(saved) : mockExistingOrders;
    } catch {
      return mockExistingOrders;
    }
  });

  const [measurementJobs, setMeasurementJobs] = useState(() => {
    try {
      const saved = localStorage.getItem("dm_measurement_jobs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [installJobs, setInstallJobs] = useState(() => {
    try {
      const saved = localStorage.getItem("dm_install_jobs");
      return saved ? JSON.parse(saved) : mockInstallJobs;
    } catch {
      return mockInstallJobs;
    }
  });

  const [installHistorySnapshots, setInstallHistorySnapshots] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("dm_install_history_snapshots") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [installerLastRefresh, setInstallerLastRefresh] = useState(() =>
    getStored("dm_install_last_refresh", "")
  );
  const [measurementLastRefresh, setMeasurementLastRefresh] = useState(() =>
    getStored("dm_measurement_last_refresh", "")
  );

  const [searchTerm, setSearchTerm] = useState("");
  const totalSteps = 7;
  const backPressAtRef = useRef(0);
  const isLeavingAppRef = useRef(false);

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(
        "decal_monkey_outside_sales_draft_active"
      );
      return saved ? JSON.parse(saved) : cloneDefaultForm(loadStoredAuthSession()?.displayName || "Heather R.");
    } catch {
      return cloneDefaultForm(loadStoredAuthSession()?.displayName || "Heather R.");
    }
  });

  const [lastSavedFormSnapshot, setLastSavedFormSnapshot] = useState(() => "");

  const currentFormSnapshot = useMemo(() => buildComparableFormSnapshot(form), [form]);
  const hasUnsavedChanges = useMemo(() => {
    if (!lastSavedFormSnapshot) return false;
    return currentFormSnapshot !== lastSavedFormSnapshot;
  }, [currentFormSnapshot, lastSavedFormSnapshot]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "decal_monkey_outside_sales_drafts",
        JSON.stringify(savedDrafts)
      );
    } catch {}
  }, [savedDrafts]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "decal_monkey_outside_sales_active_draft_id",
        JSON.stringify(activeDraftId)
      );
    } catch {}
  }, [activeDraftId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dm_submitted_orders",
        JSON.stringify(submittedOrders)
      );
    } catch {}
  }, [submittedOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dm_existing_orders",
        JSON.stringify(existingOrders)
      );
    } catch {}
  }, [existingOrders]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dm_measurement_jobs",
        JSON.stringify(measurementJobs)
      );
    } catch {}
  }, [measurementJobs]);

  useEffect(() => {
    try {
      localStorage.setItem("dm_install_jobs", JSON.stringify(installJobs));
    } catch {}
  }, [installJobs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dm_install_history_snapshots",
        JSON.stringify(installHistorySnapshots)
      );
    } catch {}
  }, [installHistorySnapshots]);

  useEffect(() => {
    try {
      setStored("dm_install_last_refresh", installerLastRefresh || "");
    } catch {}
  }, [installerLastRefresh]);

  useEffect(() => {
    try {
      setStored("dm_measurement_last_refresh", measurementLastRefresh || "");
    } catch {}
  }, [measurementLastRefresh]);

  useEffect(() => {
    if (!selectedInstall) return;

    const selectedInstallId = String(selectedInstall?.id || "").trim();
    const selectedOriginalJobId = String(
      selectedInstall?.originalJobId || selectedInstall?.id || ""
    ).trim();

    const updatedSelectedInstall =
      installJobs.find((job: any) => String(job?.id || "").trim() === selectedInstallId) ||
      measurementJobs.find((job: any) => String(job?.id || "").trim() === selectedInstallId) ||
      installHistorySnapshots.find((item: any) => {
        const historyId = String(item?.id || "").trim();
        const historyOriginalJobId = String(item?.originalJobId || item?.id || "").trim();
        return (
          historyId === selectedInstallId ||
          historyOriginalJobId === selectedOriginalJobId
        );
      }) ||
      null;

    if (updatedSelectedInstall) {
      setSelectedInstall(updatedSelectedInstall);
    }
  }, [installJobs, measurementJobs, installHistorySnapshots, selectedInstall]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        localStorage.setItem(
          "decal_monkey_outside_sales_draft_active",
          JSON.stringify(form)
        );
        setDraftStatus(
          `Auto-saved at ${new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`
        );
      } catch {
        setDraftStatus("Auto-save unavailable");
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [form]);

  useEffect(() => {
    if (screen === "existing" && measurementJobs.length === 0) {
      loadMeasurementJobs();
    }
  }, [screen]);

  useEffect(() => {
    saveStoredAuthUsers(authUsers);
  }, [authUsers]);

  useEffect(() => {
    syncSharedAuthUsers();
    syncActiveAuthSessions();
  }, []);



  useEffect(() => {
    let cancelled = false;

    const validateSession = async () => {
      if (!authUser) {
        clearStoredAuthSession();
        return;
      }

      const validatedUser = await validateStoredSession(
        authUser?.sessionToken,
        getApiBaseUrl()
      );

      if (!validatedUser && !cancelled) {
        clearStoredAuthSession();
        setAuthUser(null);
        setLoginMessage("Your app session has ended. Please sign in again.");
        setScreenState("home");
        return;
      }

      if (
        validatedUser &&
        !cancelled &&
        JSON.stringify(validatedUser) !== JSON.stringify(authUser)
      ) {
        setAuthUser(validatedUser);
        saveStoredAuthSession(validatedUser);
      }
    };

    validateSession();
    return () => {
      cancelled = true;
    };
  }, [authUser?.sessionToken, authUsers.length]);

  useEffect(() => {
    if (!authUser) return;

    const nextName = authUser.displayName || authUser.username || currentUser;
    setCurrentUser(nextName);
    setStored("dm_current_user", nextName);

    setForm((prev: any) => ({
      ...prev,
      customerOwner: prev?.customerOwner || nextName,
    }));

    if (!isScreenAllowedForRole(screen, authUser.role)) {
      setScreenState(getDefaultScreenForRole(authUser.role));
    }
  }, [authUser]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authUser) return;

    try {
      window.history.pushState(
        { dmFieldAppGuard: true, screen, at: Date.now() },
        "",
        window.location.href
      );
    } catch {}
  }, [authUser, screen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authUser) return;

    const handlePopState = () => {
      if (isLeavingAppRef.current) return;

      const now = Date.now();

      if (screen !== "home") {
        try {
          window.history.pushState(
            { dmFieldAppGuard: true, screen: "home", at: Date.now() },
            "",
            window.location.href
          );
        } catch {}
        setScreenState("home");
        showBackPressToast("Press back again to exit the app. Use the app buttons to navigate.");
        backPressAtRef.current = now;
        return;
      }

      if (now - backPressAtRef.current < 1500) {
        isLeavingAppRef.current = true;
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
        return;
      }

      backPressAtRef.current = now;

      try {
        window.history.pushState(
          { dmFieldAppGuard: true, screen: "home", at: Date.now() },
          "",
          window.location.href
        );
      } catch {}

      showBackPressToast("Press back again to exit the app. Use the app buttons to navigate.");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [authUser, screen]);


  const syncSharedAuthUsers = async (sessionTokenOverride?: string) => {
    try {
      const users = await fetchSharedAuthUsers(getApiBaseUrl(), sessionTokenOverride || authUser?.sessionToken);
      setAuthUsers(users);
      saveStoredAuthUsers(users);
      return users;
    } catch (error: any) {
      setSettingsMessage(
        error?.message || "Could not load shared app logins from the server."
      );
      return [];
    }
  };

  const syncActiveAuthSessions = async (sessionTokenOverride?: string) => {
    try {
      const sessions = await fetchSharedAuthSessions(getApiBaseUrl(), sessionTokenOverride || authUser?.sessionToken);
      setActiveAuthSessions(sessions);
      return sessions;
    } catch (error: any) {
      setSettingsMessage(
        error?.message || "Could not load active device sessions."
      );
      return [];
    }
  };

  const setScreen = (nextScreen: any) => {
    const resolvedScreen =
      typeof nextScreen === "function" ? nextScreen(screen) : nextScreen;

    if (!authUser) {
      setScreenState("home");
      return;
    }

    if (
      resolvedScreen === "inquiry" ||
      isScreenAllowedForRole(resolvedScreen, authUser.role)
    ) {
      setScreenState(resolvedScreen);
      return;
    }

    setSubmitState({
      loading: false,
      message: `Access limited: ${authUser.displayName} is signed in as ${authUser.role}.`,
    });
    setScreenState(getDefaultScreenForRole(authUser.role));
  };

  const handleLogin = async (username: string, password: string) => {
    const result = await loginSharedAuthUser({
      apiBaseUrl: getApiBaseUrl(),
      username,
      password,
      deviceName,
    });

    if (!result.ok) {
      setLoginMessage(result.message || "Login failed.");
      return false;
    }

    setAuthUser(result.user);
    saveStoredAuthSession(result.user);
    setCurrentUser(result.user.displayName || result.user.username);
    setStored(
      "dm_current_user",
      result.user.displayName || result.user.username || ""
    );
    setSettingsMessage("");
    setSubmitState({ loading: false, message: "" });
    setLoginMessage("");
    await syncSharedAuthUsers(result.user.sessionToken);
    await syncActiveAuthSessions(result.user.sessionToken);
    setScreenState(getDefaultScreenForRole(result.user.role));
    return true;
  };

  const handleLogout = async () => {
    try {
      await logoutSharedAuthUser(authUser?.sessionToken, getApiBaseUrl());
    } catch {}
    clearStoredAuthSession();
    setAuthUser(null);
    setActiveAuthSessions([]);
    setLoginMessage("You have been logged out.");
    setScreenState("home");
  };

  const handleLogoutAllDevices = async () => {
    try {
      await logoutAllSharedAuthUsers(getApiBaseUrl(), authUser?.sessionToken);
      setActiveAuthSessions([]);
      clearStoredAuthSession();
      setAuthUser(null);
      setLoginMessage("All devices were logged out.");
      setSettingsMessage("All shared app sessions were cleared.");
      setScreenState("home");
    } catch (error: any) {
      setSettingsMessage(
        error?.message || "Could not log out all devices."
      );
    }
  };

  const handleLogoutMyDevices = async () => {
    try {
      if (!authUser?.id) {
        throw new Error("Missing signed-in user.");
      }

      await logoutMySharedAuthDevices({
        apiBaseUrl: getApiBaseUrl(),
        userId: authUser.id,
        sessionToken: authUser.sessionToken,
      });

      setActiveAuthSessions([]);
      clearStoredAuthSession();
      setAuthUser(null);
      setLoginMessage("You were logged out on all of your devices.");
      setSettingsMessage("Your app sessions were cleared on every device.");
      setScreenState("home");
    } catch (error: any) {
      setSettingsMessage(
        error?.message || "Could not log out your devices."
      );
    }
  };

  const addAuthUser = () => {
    setAuthUsers((prev: any[]) => [...prev, createEmptyAppUser()]);
  };

  const updateAuthUser = (userId: string, key: string, value: any) => {
    setAuthUsers((prev: any[]) =>
      prev.map((user: any) =>
        user.id === userId ? { ...user, [key]: value } : user
      )
    );
  };

  const removeAuthUser = (userId: string) => {
    setAuthUsers((prev: any[]) => prev.filter((user: any) => user.id !== userId));
  };

  const saveAuthUsersNow = async () => {
    try {
      const sanitizedUsers = (Array.isArray(authUsers) ? authUsers : [])
        .map((user: any) => ({
          ...user,
          username: String(user?.username || "").trim(),
          password: String(user?.password || "").trim(),
          displayName: String(user?.displayName || "").trim(),
        }))
        .filter(
          (user: any) => user.username && user.password && user.displayName && user.role
        );

      const savedUsers = await saveSharedAuthUsers(sanitizedUsers, getApiBaseUrl(), authUser?.sessionToken);
      setAuthUsers(savedUsers);
      saveStoredAuthUsers(savedUsers);
      setSettingsMessage(
        `Saved ${savedUsers.length} shared app login${
          savedUsers.length === 1 ? "" : "s"
        }.`
      );
      await syncActiveAuthSessions();
    } catch (error: any) {
      setSettingsMessage(
        error?.message || "Could not save shared app logins."
      );
    }
  };

  const resetAuthUsers = async () => {
    try {
      const defaults = await resetSharedAuthUsers(getApiBaseUrl(), authUser?.sessionToken);
      setAuthUsers(defaults);
      saveStoredAuthUsers(defaults);
      setSettingsMessage(
        "Shared app logins reset to the default Decal Monkey starter accounts."
      );
    } catch (error: any) {
      setSettingsMessage(
        error?.message || "Could not reset shared app logins."
      );
    }
  };

  const filteredExisting = existingOrders.filter((item: any) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      [
        item.customer,
        item.id,
        item.note,
        item.owner,
        item.nickname,
        item.firstName,
        item.lastName,
        item.invoiceNumber,
        item.company,
      ].some((value: string) =>
        String(value || "")
          .toLowerCase()
          .includes(q)
      )
    );
  });

  const filteredMeasurementJobs = measurementJobs.filter((item: any) => {
    const q = measurementSearchTerm.toLowerCase();
    return (
      !q ||
      [
        item.customer,
        item.contact,
        item.id,
        item.nickname,
        item.invoiceNumber,
        item.printavoQuoteNumber,
        item.company,
        item.phone,
        item.email,
        item.address,
        item.city,
        item.state,
        item.zip,
      ].some((value: string) =>
        String(value || "")
          .toLowerCase()
          .includes(q)
      )
    );
  });

  const getApiBaseUrl = () => {
    return String(apiBaseUrl || "https://api.decalmonkey.biz")
      .trim()
      .replace(/\/+$/, "");
  };

  const uploadImagesToBackend = async (sources: any[], prefix: string) => {
    const sourceList = Array.isArray(sources) ? sources : [];
    const existingUrls = uniqueStrings(
      sourceList.filter((item: any) => /^https?:\/\//i.test(String(item || "")))
    );
    const dataUrls = sourceList.filter((item: any) =>
      /^data:/i.test(String(item || ""))
    );

    if (!dataUrls.length) {
      return existingUrls;
    }

    const formData = new FormData();

    dataUrls.forEach((dataUrl: string, index: number) => {
      const file = dataUrlToFile(dataUrl, `${prefix}-${index + 1}`);
      if (file) {
        formData.append("images", file);
      }
    });

    const response = await fetch(`${getApiBaseUrl()}/api/upload-images`, {
      method: "POST",
      body: formData,
    });

    const rawText = await response.text();
    const data = parseMaybeJson(response, rawText);

    if (!response.ok || !data.ok) {
      throw new Error(data?.error || "Image upload failed.");
    }

    return uniqueStrings([...(data.urls || []), ...existingUrls]);
  };

  const collectPhotoEntrySources = (rawForm: any) => {
    return (rawForm?.photoEntries || [])
      .map((entry: any) => {
        const annotated = entry?.annotatedImageData || "";
        const original = entry?.imageData || "";
        const existingUrl = entry?.uploadedPhotoUrl || "";

        if (
          existingUrl &&
          (!annotated || /^https?:\/\//i.test(annotated)) &&
          (!original || /^https?:\/\//i.test(original))
        ) {
          return existingUrl;
        }

        if (annotated && annotated.startsWith("data:")) {
          return annotated;
        }

        if (original && original.startsWith("data:")) {
          return original;
        }

        return existingUrl || "";
      })
      .filter(Boolean);
  };

  const collectProductionFileSources = (rawForm: any) => {
    return (rawForm?.productionFiles || [])
      .map(
        (file: any) =>
          file?.dataUrl ||
          file?.imageData ||
          file?.fileData ||
          file?.preview ||
          file?.previewUrl ||
          file?.url ||
          ""
      )
      .filter(Boolean);
  };

  const prepareFormPayloadForPrintavo = async (rawForm: any) => {
    const uploadedPhotoUrls = await uploadImagesToBackend(
      collectPhotoEntrySources(rawForm),
      "field-photo"
    );

    const uploadedProductionFileUrls = await uploadImagesToBackend(
      collectProductionFileSources(rawForm),
      "artwork-file"
    );

    return {
      ...rawForm,
      uploadedPhotoUrls,
      uploadedProductionFileUrls,
    };
  };

  const buildHistoryPhotoEntries = (
    rawPhotoEntries: any[],
    uploadedPhotoUrls: string[] = []
  ) => {
    const safeEntries = Array.isArray(rawPhotoEntries) ? rawPhotoEntries : [];
    const safeUrls = Array.isArray(uploadedPhotoUrls) ? uploadedPhotoUrls : [];

    return safeEntries.map((entry: any, index: number) => {
      const uploadedUrl = safeUrls[index] || "";
      return {
        ...entry,
        uploadedPhotoUrl: uploadedUrl,
        imageData:
          entry?.annotatedImageData ||
          entry?.imageData ||
          uploadedUrl ||
          "",
      };
    });
  };

  const buildHistoryProductionFiles = (
    rawProductionFiles: any[],
    uploadedProductionFileUrls: string[] = []
  ) => {
    const safeFiles = Array.isArray(rawProductionFiles) ? rawProductionFiles : [];
    const safeUrls = Array.isArray(uploadedProductionFileUrls)
      ? uploadedProductionFileUrls
      : [];

    return safeFiles.map((file: any, index: number) => {
      const uploadedUrl = safeUrls[index] || "";
      return {
        ...file,
        uploadedUrl,
        previewUrl:
          file?.previewUrl ||
          file?.url ||
          file?.dataUrl ||
          uploadedUrl ||
          "",
        url: file?.url || uploadedUrl || "",
      };
    });
  };


  const mergeHydratedOrder = (baseOrder: any, hydratedOrder: any) => {
    const localOrder = baseOrder || {};
    const remoteOrder = hydratedOrder || {};

    const mergedUploadedPhotoUrls = uniqueStrings([
      ...(Array.isArray(remoteOrder.uploadedPhotoUrls)
        ? remoteOrder.uploadedPhotoUrls
        : []),
      ...(Array.isArray(localOrder.uploadedPhotoUrls)
        ? localOrder.uploadedPhotoUrls
        : []),
    ]);

    const mergedUploadedProductionFileUrls = uniqueStrings([
      ...(Array.isArray(remoteOrder.uploadedProductionFileUrls)
        ? remoteOrder.uploadedProductionFileUrls
        : []),
      ...(Array.isArray(localOrder.uploadedProductionFileUrls)
        ? localOrder.uploadedProductionFileUrls
        : []),
    ]);

    const remotePhotoEntries = Array.isArray(remoteOrder.photoEntries)
      ? remoteOrder.photoEntries
      : [];
    const localPhotoEntries = Array.isArray(localOrder.photoEntries)
      ? localOrder.photoEntries
      : [];

    const remoteProductionFiles = Array.isArray(remoteOrder.productionFiles)
      ? remoteOrder.productionFiles
      : [];
    const localProductionFiles = Array.isArray(localOrder.productionFiles)
      ? localOrder.productionFiles
      : [];

    return {
      ...localOrder,
      ...remoteOrder,
      id: localOrder.id || remoteOrder.id || "",
      status: remoteOrder.status || localOrder.status || "",
      statusId: remoteOrder.statusId || localOrder.statusId || "",
      nickname: remoteOrder.nickname || localOrder.nickname || "",
      jobNickname:
        remoteOrder.jobNickname ||
        remoteOrder.nickname ||
        localOrder.jobNickname ||
        localOrder.nickname ||
        "",
      productTypes:
        Array.isArray(remoteOrder.productTypes) && remoteOrder.productTypes.length
          ? remoteOrder.productTypes
          : Array.isArray(localOrder.productTypes)
          ? localOrder.productTypes
          : [],
      lineItems:
        Array.isArray(remoteOrder.lineItems) && remoteOrder.lineItems.length
          ? remoteOrder.lineItems
          : Array.isArray(localOrder.lineItems)
          ? localOrder.lineItems
          : [],
      uploadedPhotoUrls: mergedUploadedPhotoUrls,
      uploadedProductionFileUrls: mergedUploadedProductionFileUrls,
      photoEntries: buildHistoryPhotoEntries(
        remotePhotoEntries.length ? remotePhotoEntries : localPhotoEntries,
        mergedUploadedPhotoUrls
      ),
      productionFiles: buildHistoryProductionFiles(
        remoteProductionFiles.length ? remoteProductionFiles : localProductionFiles,
        mergedUploadedProductionFileUrls
      ),
    };
  };

  const getSubmittedOrderKey = (order: any) => {
    const printavoId = String(order?.printavoQuoteId || "").trim();
    if (printavoId) return `printavo:${printavoId}`;

    const quoteNumber = String(
      order?.printavoQuoteNumber || order?.invoiceNumber || ""
    )
      .replace("#", "")
      .trim();
    if (quoteNumber) return `quote:${quoteNumber}`;

    const orderId = String(order?.id || "").trim();
    if (orderId) return `id:${orderId}`;

    return "";
  };

  const upsertSubmittedOrder = (orders: any[], nextOrder: any) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const targetKey = getSubmittedOrderKey(nextOrder);

    if (!targetKey) {
      return [nextOrder, ...safeOrders];
    }

    let replaced = false;
    const mergedOrders = safeOrders.reduce((acc: any[], item: any) => {
      const itemKey = getSubmittedOrderKey(item);

      if (itemKey === targetKey) {
        if (!replaced) {
          acc.push({
            ...item,
            ...nextOrder,
            id: nextOrder?.id || item?.id || "",
          });
          replaced = true;
        }
        return acc;
      }

      acc.push(item);
      return acc;
    }, []);

    if (!replaced) {
      return [nextOrder, ...mergedOrders];
    }

    return mergedOrders;
  };

  const getInstallHistorySnapshotKey = (item: any) => {
    const originalJobId = String(item?.originalJobId || item?.id || "").trim();
    if (originalJobId) return `job:${originalJobId}`;

    const printavoId = String(item?.printavoQuoteId || "").trim();
    if (printavoId) return `printavo:${printavoId}`;

    const quoteNumber = String(
      item?.printavoQuoteNumber || item?.invoiceNumber || ""
    )
      .replace("#", "")
      .trim();
    if (quoteNumber) return `quote:${quoteNumber}`;

    return "";
  };

  const upsertInstallHistorySnapshot = (snapshots: any[], nextSnapshot: any) => {
    const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];
    const targetKey = getInstallHistorySnapshotKey(nextSnapshot);

    if (!targetKey) {
      return [nextSnapshot, ...safeSnapshots];
    }

    let replaced = false;
    const mergedSnapshots = safeSnapshots.reduce((acc: any[], item: any) => {
      const itemKey = getInstallHistorySnapshotKey(item);

      if (itemKey === targetKey) {
        if (!replaced) {
          acc.push({
            ...item,
            ...nextSnapshot,
            id: nextSnapshot?.id || item?.id || "",
            originalJobId:
              nextSnapshot?.originalJobId || item?.originalJobId || item?.id || "",
          });
          replaced = true;
        }
        return acc;
      }

      acc.push(item);
      return acc;
    }, []);

    if (!replaced) {
      return [nextSnapshot, ...mergedSnapshots];
    }

    return mergedSnapshots;
  };

  const removeCompletedInstallFromActiveJobs = (jobs: any[], completedInstall: any) => {
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const completedId = String(
      completedInstall?.originalJobId || completedInstall?.id || ""
    ).trim();

    return safeJobs.filter((job: any) => String(job?.id || "").trim() !== completedId);
  };

  const clearSafeSubmissionHistory = (orders: any[]) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    return safeOrders.filter(
      (item: any) => String(item?.status || "").trim() === "Pending Sync"
    );
  };


  const clearSubmittedOrderHistory = () => {
    const preservedPendingSyncOrders = clearSafeSubmissionHistory(submittedOrders);
    const clearedOrderCount = Math.max(
      0,
      (Array.isArray(submittedOrders) ? submittedOrders.length : 0) -
        preservedPendingSyncOrders.length
    );
    const clearedInstallCount = Array.isArray(installHistorySnapshots)
      ? installHistorySnapshots.length
      : 0;

    setSubmittedOrders(preservedPendingSyncOrders);
    setInstallHistorySnapshots([]);
    setSelectedOrder(null);
    setSelectedInstall(null);
    setLastCompletedInstall(null);
    setSubmitState({
      loading: false,
      message:
        preservedPendingSyncOrders.length > 0
          ? `Cleared ${clearedOrderCount} sent order history item${
              clearedOrderCount === 1 ? "" : "s"
            } and ${clearedInstallCount} completed install histor${
              clearedInstallCount === 1 ? "y item" : "y items"
            }. Pending Sync jobs were preserved so they are not lost.`
          : `Cleared ${clearedOrderCount} sent order history item${
              clearedOrderCount === 1 ? "" : "s"
            } and ${clearedInstallCount} completed install histor${
              clearedInstallCount === 1 ? "y item" : "y items"
            }.`,
    });
  };

  const isCompletedMeasurementOrder = (order: any) => {
    if (order?.measurementCompleted) return true;

    const status = String(order?.status || "").toUpperCase();
    return status.includes("MEASUREMENT COMPLETE");
  };

  const openHistoryOrder = async (order: any) => {
    const quoteId = String(order?.printavoQuoteId || "").trim();

    if (!quoteId) {
      setSelectedOrder(order);
      setScreen("submission-detail");
      return;
    }

    setSubmitState({
      loading: true,
      message: `Refreshing ${order.printavoQuoteNumber || order.invoiceNumber || order.id} from Printavo...`,
    });

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/printavo/history-details/${encodeURIComponent(quoteId)}`
      );
      const rawText = await response.text();
      const data = parseMaybeJson(response, rawText);

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || "Could not hydrate history order.");
      }

      const hydratedOrder = mergeHydratedOrder(order, data.order || {});

      setSubmittedOrders((prev: any[]) =>
        prev.map((item: any) => {
          const matchesById = item.id === order.id;
          const matchesByPrintavoId =
            String(item?.printavoQuoteId || "").trim() === quoteId;

          return matchesById || matchesByPrintavoId ? hydratedOrder : item;
        })
      );

      setSelectedOrder(hydratedOrder);
      setScreen("submission-detail");
      setSubmitState({
        loading: false,
        message: `Refreshed ${hydratedOrder.printavoQuoteNumber || hydratedOrder.invoiceNumber || hydratedOrder.id} from Printavo.`,
      });
    } catch (error: any) {
      setSelectedOrder(order);
      setScreen("submission-detail");
      setSubmitState({
        loading: false,
        message:
          error.message ||
          `Could not refresh ${order.printavoQuoteNumber || order.invoiceNumber || order.id}. Showing saved history version.`,
      });
    }
  };

  const updateField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  const updateLineItem = (index: number, key: string, value: any) => {
    setForm((prev: any) => {
      const nextLineItems = [...(prev.lineItems || [])];
      nextLineItems[index] = {
        ...(nextLineItems[index] || {}),
        [key]: value,
      };
      return {
        ...prev,
        lineItems: nextLineItems,
      };
    });
  };

  const addProductionFiles = (files: any[]) => {
    setForm((prev: any) => ({
      ...prev,
      productionFiles: [...(prev.productionFiles || []), ...(files || [])],
    }));
  };

  const removeProductionFile = (fileId: string | number) => {
    setForm((prev: any) => ({
      ...prev,
      productionFiles: (prev.productionFiles || []).filter(
        (file: any) => file.id !== fileId
      ),
    }));
  };

  const exitWizardToHome = () => {
    setStep(1);
    setScreen("home");
  };

  const saveSettings = () => {
    setStored("dm_api_base_url", apiBaseUrl);
    setStored("dm_main_email", mainEmail);
    setStored("dm_device_name", deviceName);
    setStored("dm_current_user", currentUser);

    setForm((prev: any) => ({
      ...prev,
      customerOwner: currentUser,
    }));

    setSettingsMessage(`Settings saved for ${currentUser} on ${deviceName}.`);
  };

  const clearInstallerCache = () => {
    localStorage.removeItem("dm_install_jobs");
    localStorage.removeItem("dm_install_last_refresh");
    setInstallJobs([]);
    setInstallerLastRefresh("");
    setLoadJobsMessage("");
    setSettingsMessage("Installer cache cleared.");
  };

  const clearMeasurementCache = () => {
    localStorage.removeItem("dm_measurement_jobs");
    localStorage.removeItem("dm_measurement_last_refresh");
    setMeasurementJobs([]);
    setMeasurementLastRefresh("");
    setMeasurementJobsMessage("");
    setSettingsMessage("Measurement cache cleared.");
  };

  const clearAllJobCaches = () => {
    localStorage.removeItem("dm_install_jobs");
    localStorage.removeItem("dm_measurement_jobs");
    localStorage.removeItem("dm_install_last_refresh");
    localStorage.removeItem("dm_measurement_last_refresh");
    localStorage.removeItem("dm_install_history_snapshots");

    setInstallJobs([]);
    setMeasurementJobs([]);
    setInstallHistorySnapshots([]);
    setInstallerLastRefresh("");
    setMeasurementLastRefresh("");
    setLoadJobsMessage("");
    setMeasurementJobsMessage("");
    setSettingsMessage("All cached jobs and install history cleared.");
  };

  const testBackendConnection = async () => {
    setConnectionState({
      loading: true,
      status: "idle",
      message: "Testing backend connection...",
    });

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/health`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Health check failed.");
      }

      setConnectionState({
        loading: false,
        status: "connected",
        message: `Connected successfully to ${getApiBaseUrl()}`,
      });
    } catch (error: any) {
      setConnectionState({
        loading: false,
        status: "error",
        message:
          error.message ||
          "Could not connect to backend. Check the URL and make sure the server is running.",
      });
    }
  };

  const loadMeasurementJobs = async () => {
    setLoadingMeasurementJobs(true);
    setMeasurementJobsMessage(
      "Refreshing offsite measurement jobs from Printavo..."
    );

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/printavo/measurement-jobs`
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Could not refresh offsite measurement jobs."
        );
      }

      const fetchedJobs = Array.isArray(data.jobs) ? data.jobs : [];
      const refreshedAt = new Date().toISOString();

      setMeasurementJobs((prev: any[]) =>
        mergeMeasurementJobs(prev, fetchedJobs)
      );
      setMeasurementLastRefresh(refreshedAt);

      setMeasurementJobsMessage(
        formatMeasurementDebugMessage(data.debug, fetchedJobs.length, refreshedAt)
      );
    } catch (error: any) {
      setMeasurementJobsMessage(
        error.message ||
          "Could not refresh offsite measurement jobs from the backend."
      );
    } finally {
      setLoadingMeasurementJobs(false);
    }
  };

  const loadNewJobs = async () => {
    setLoadingJobs(true);
    setLoadJobsMessage("Refreshing jobs from Printavo...");

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/printavo/install-jobs`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not refresh jobs.");
      }

      const fetchedJobs = Array.isArray(data.jobs) ? data.jobs : [];
      const refreshedAt = new Date().toISOString();

      setInstallJobs((prev: any[]) =>
        mergeInstallJobsPreservingCompleted(prev, fetchedJobs)
      );
      setInstallerLastRefresh(refreshedAt);

      setLoadJobsMessage(
        formatInstallDebugMessage(data.debug, fetchedJobs.length, refreshedAt)
      );
    } catch (error: any) {
      setLoadJobsMessage(
        error.message || "Could not refresh jobs from the backend."
      );
    } finally {
      setLoadingJobs(false);
    }
  };

  const saveDraftNow = () => {
    const currentSnapshot = buildComparableFormSnapshot(form);

    if (currentSnapshot === lastSavedFormSnapshot) {
      setDraftStatus("No changes to save");
      return false;
    }

    const draftId =
      activeDraftId ||
      `draft_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const draftRecord = {
      id: draftId,
      title:
        `${[form.firstName, form.lastName].filter(Boolean).join(" ")}` ||
        form.company ||
        form.jobNickname ||
        "Untitled Draft",
      updatedAt: new Date().toLocaleString(),
      isFavorite:
        savedDrafts.find((draft: any) => draft.id === draftId)?.isFavorite ||
        false,
      data: form,
    };

    const existingIndex = savedDrafts.findIndex(
      (draft: any) => draft.id === draftId
    );
    let nextDrafts = [...savedDrafts];

    if (existingIndex >= 0) {
      nextDrafts[existingIndex] = draftRecord;
    } else {
      nextDrafts = [draftRecord, ...nextDrafts];
    }

    nextDrafts = nextDrafts.slice(0, 25);

    setSavedDrafts(nextDrafts);
    setActiveDraftId(draftId);
    setLastSavedFormSnapshot(currentSnapshot);

    localStorage.setItem(
      "decal_monkey_outside_sales_draft_active",
      JSON.stringify(form)
    );

    const savedTime = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    setDraftStatus(`Draft saved at ${savedTime}`);
    return true;
  };

  const removeActiveDraftFromSaved = () => {
    if (!activeDraftId) {
      localStorage.removeItem("decal_monkey_outside_sales_draft_active");
      localStorage.removeItem("decal_monkey_outside_sales_active_draft_id");
      setActiveDraftId(null);
      return;
    }

    const nextDrafts = savedDrafts.filter(
      (draft: any) => draft.id !== activeDraftId
    );
    setSavedDrafts(nextDrafts);
    localStorage.removeItem("decal_monkey_outside_sales_draft_active");
    localStorage.removeItem("decal_monkey_outside_sales_active_draft_id");
    setActiveDraftId(null);
  };

  const clearSubmittedDrafts = () => {
    removeActiveDraftFromSaved();
    setDraftStatus("Draft cleared after submit");
  };

  const resetForm = () => {
    const nextForm = cloneDefaultForm(currentUser);
    setForm(nextForm);
    setLastSavedFormSnapshot(buildComparableFormSnapshot(nextForm));
    setStep(1);
    setEditingSubmittedOrder(null);
    setSelectedMeasurement(null);
  };

  const resumeDraft = (draft: any) => {
    setEditingSubmittedOrder(null);
    setActiveDraftId(draft.id);
    setForm(draft.data);
    setLastSavedFormSnapshot(buildComparableFormSnapshot(draft.data));
    setStep(1);
    setScreen("wizard");
    localStorage.setItem(
      "decal_monkey_outside_sales_draft_active",
      JSON.stringify(draft.data)
    );
    setDraftStatus(`Resumed draft from ${draft.updatedAt}`);
  };

  const deleteDraft = (draftId: string) => {
    const nextDrafts = savedDrafts.filter((draft: any) => draft.id !== draftId);
    setSavedDrafts(nextDrafts);

    if (activeDraftId === draftId) {
      setActiveDraftId(null);
      localStorage.removeItem("decal_monkey_outside_sales_draft_active");
      localStorage.removeItem("decal_monkey_outside_sales_active_draft_id");
      setDraftStatus("Draft deleted");
    }
  };

  const toggleFavoriteDraft = (draftId: string) => {
    setSavedDrafts((prev: any[]) =>
      prev.map((draft: any) =>
        draft.id === draftId
          ? { ...draft, isFavorite: !draft.isFavorite }
          : draft
      )
    );
  };

  const startFreshOrder = () => {
    setEditingSubmittedOrder(null);
    setActiveDraftId(null);
    const nextForm = cloneDefaultForm(currentUser);
    setForm(nextForm);
    setLastSavedFormSnapshot(buildComparableFormSnapshot(nextForm));
    setStep(1);
    localStorage.removeItem("decal_monkey_outside_sales_draft_active");
    localStorage.removeItem("decal_monkey_outside_sales_active_draft_id");
    setDraftStatus("Draft idle");
    setScreen("wizard");
  };

  const updatePhotoEntry = (entryId: number, key: string, value: any) => {
    setForm((prev: any) => ({
      ...prev,
      photoEntries: prev.photoEntries.map((entry: any) =>
        entry.id === entryId ? { ...entry, [key]: value } : entry
      ),
    }));
  };

  const addPhotoEntry = () => {
    setForm((prev: any) => ({
      ...prev,
      photoEntries: [
        ...prev.photoEntries,
        {
          id: Date.now(),
          name: "",
          width: "",
          widthUnit: "in",
          height: "",
          heightUnit: "in",
          quantity: "",
          imageData: "",
          annotatedImageData: "",
          markupNotes: "",
        },
      ],
    }));
  };

  const deletePhotoEntry = (entryId: number) => {
    setForm((prev: any) => ({
      ...prev,
      photoEntries: prev.photoEntries.filter(
        (entry: any) => entry.id !== entryId
      ),
    }));
  };

  const movePhotoEntry = (entryId: number, direction: number) => {
    setForm((prev: any) => {
      const index = prev.photoEntries.findIndex(
        (entry: any) => entry.id === entryId
      );
      if (index === -1) return prev;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.photoEntries.length) return prev;

      const nextEntries = [...prev.photoEntries];
      const [moved] = nextEntries.splice(index, 1);
      nextEntries.splice(nextIndex, 0, moved);

      return { ...prev, photoEntries: nextEntries };
    });
  };

  const loadOrderIntoForm = (order: any) => {
    const nextForm = {
      ...cloneDefaultForm(currentUser),
      jobNickname: order.jobNickname || order.nickname || "",
      firstName: order.firstName || "",
      lastName: order.lastName || "",
      customerOwner: order.customerOwner || order.owner || currentUser,
      company: order.company || "",
      phone: order.phone || "",
      email: order.email || "",
      address: order.address || "",
      city: order.city || "",
      state: order.state || "",
      zip: order.zip || "",
      additionalInquiries: order.additionalInquiries || "",
      productTypes: [...(order.productTypes || [])],
      printedDecalFinish: order.printedDecalFinish || "",
      wallGraphicType: order.wallGraphicType || "",
      wallGraphicFinish: order.wallGraphicFinish || "",
      otherProductType: order.otherProductType || "",
      lineItems: (order.lineItems || []).map((item: any) => ({ ...item })),
      productionFiles: (order.productionFiles || []).map((file: any) => ({
        ...file,
      })),
      locationType: order.locationType || "",
      surfaceType: order.surfaceType || "",
      surfaceOther: order.surfaceOther || "",
      installNeeded: !!order.installNeeded,
      installSameAsCustomer:
        typeof order.installSameAsCustomer === "boolean"
          ? order.installSameAsCustomer
          : true,
      installAddress: order.installAddress || "",
      installCity: order.installCity || "",
      installState: order.installState || "",
      installZip: order.installZip || "",
      offsiteMeasurementsNeeded: !!order.offsiteMeasurementsNeeded,
      unableToTakePhotosNow: !!order.unableToTakePhotosNow,
      logoStatus: order.logoStatus || "Customer provided",
      colorNotes: order.colorNotes || "",
      mockupInstructions:
        order.mockupInstructions &&
        order.mockupInstructions !== MOCKUP_PLACEHOLDER
          ? order.mockupInstructions
          : "",
      artworkStatus: order.artworkStatus || "",
      sendArtworkRequest: !!order.sendArtworkRequest,
      printavoQuoteId: order.printavoQuoteId || "",
      printavoQuoteNumber:
        order.printavoQuoteNumber || order.invoiceNumber || "",
      photoEntries:
        (order.photoEntries || []).length > 0
          ? order.photoEntries.map((entry: any) => ({
              ...entry,
              id: entry.id || Date.now() + Math.random(),
              widthUnit: entry.widthUnit || "in",
              heightUnit: entry.heightUnit || "in",
            }))
          : cloneDefaultForm(currentUser).photoEntries,
    };

    setForm(nextForm);
    setLastSavedFormSnapshot(buildComparableFormSnapshot(nextForm));
  };

  const findMeasurementOrderSeed = (order: any) => {
    const possibleKeys = [
      String(order?.printavoQuoteId || "").trim(),
      String(order?.printavoQuoteNumber || "").replace("#", "").trim(),
      String(order?.invoiceNumber || "").replace("#", "").trim(),
    ].filter(Boolean);

    const matchesOrder = (candidate: any) => {
      const candidateKeys = [
        String(candidate?.printavoQuoteId || "").trim(),
        String(candidate?.printavoQuoteNumber || "").replace("#", "").trim(),
        String(candidate?.invoiceNumber || "").replace("#", "").trim(),
      ].filter(Boolean);

      return candidateKeys.some((key: string) => possibleKeys.includes(key));
    };

    return (
      measurementJobs.find(matchesOrder) ||
      submittedOrders.find(matchesOrder) ||
      existingOrders.find(matchesOrder) ||
      null
    );
  };

  const openMeasurementJobForMeasurement = (order: any) => {
    const seedOrder = findMeasurementOrderSeed(order);
    const measurementOrder = {
      ...seedOrder,
      ...order,
      __source: "measurement",
    };

    setEditingSubmittedOrder(measurementOrder);
    setSelectedMeasurement(measurementOrder);
    setActiveDraftId(null);
    loadOrderIntoForm(measurementOrder);
    setScreen("measurement");
    setSubmitState({
      loading: false,
      message: `Taking measurements for ${
        order.printavoQuoteNumber || order.invoiceNumber || order.id
      }.`,
    });
  };

  const openMeasurementJobForEdit = (order: any) => {
    const seedOrder = findMeasurementOrderSeed(order);
    const measurementOrder = {
      ...seedOrder,
      ...order,
      __source: "measurement",
    };

    setEditingSubmittedOrder(measurementOrder);
    setSelectedMeasurement(measurementOrder);
    setActiveDraftId(null);
    loadOrderIntoForm(measurementOrder);
    setStep(1);
    setScreen("wizard");
    setSubmitState({
      loading: false,
      message: `Editing offsite order ${
        order.printavoQuoteNumber || order.invoiceNumber || order.id
      }.`,
    });
  };

  const openSubmittedOrderForEdit = (order: any) => {
    const editableOrder = {
      ...order,
      __source: isCompletedMeasurementOrder(order) ? "measurement" : order?.__source,
    };

    setEditingSubmittedOrder(editableOrder);
    setActiveDraftId(null);
    loadOrderIntoForm(editableOrder);

    if (isCompletedMeasurementOrder(order)) {
      setSelectedMeasurement(editableOrder);
      setScreen("measurement");
      setSubmitState({
        loading: false,
        message: `Editing completed measurements for ${
          order.printavoQuoteNumber || order.invoiceNumber || order.id
        }.`,
      });
      return;
    }

    setStep(7);
    setScreen("wizard");
    setSubmitState({
      loading: false,
      message: `Editing order ${order.id}.`,
    });
  };

  const submitOrder = async (options: { goHomeAfterSave?: boolean } = {}) => {
    const { goHomeAfterSave = false } = options;
    const isEditing = !!editingSubmittedOrder;
    const editingSource = editingSubmittedOrder?.__source;

    if (isEditing && !hasUnsavedChanges) {
      setSubmitState({
        loading: false,
        message:
          editingSource === "measurement"
            ? "No new measurement changes to save."
            : "No new changes to save.",
      });

      if (goHomeAfterSave) {
        exitWizardToHome();
        return;
      }

      setScreen("wizard");
      return;
    }

    if (isEditing && editingSource === "measurement") {
      const modifiedAt = new Date().toLocaleString();

      const updatedMeasurementJob = {
        ...editingSubmittedOrder,
        customer:
          `${form.firstName} ${form.lastName}`.trim() ||
          editingSubmittedOrder.customer ||
          "Untitled customer",
        jobNickname:
          form.jobNickname ||
          editingSubmittedOrder.jobNickname ||
          editingSubmittedOrder.nickname ||
          "",
        nickname:
          form.jobNickname ||
          editingSubmittedOrder.nickname ||
          editingSubmittedOrder.jobNickname ||
          "",
        firstName: form.firstName,
        lastName: form.lastName,
        customerOwner: form.customerOwner,
        company: form.company,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        additionalInquiries: form.additionalInquiries,
        productTypes: [...(form.productTypes || [])],
        printedDecalFinish: form.printedDecalFinish || "",
        wallGraphicType: form.wallGraphicType || "",
        wallGraphicFinish: form.wallGraphicFinish || "",
        otherProductType: form.otherProductType || "",
        lineItems: (form.lineItems || []).map((item: any) => ({ ...item })),
        productionFiles: (form.productionFiles || []).map((file: any) => ({
          ...file,
        })),
        locationType: form.locationType,
        surfaceType: form.surfaceType,
        surfaceOther: form.surfaceOther,
        installNeeded: form.installNeeded,
        installSameAsCustomer: form.installSameAsCustomer,
        installAddress: form.installAddress,
        installCity: form.installCity,
        installState: form.installState,
        installZip: form.installZip,
        offsiteMeasurementsNeeded: !!form.offsiteMeasurementsNeeded,
        unableToTakePhotosNow: !!form.unableToTakePhotosNow,
        logoStatus: form.logoStatus,
        colorNotes: form.colorNotes,
        mockupInstructions: form.mockupInstructions,
        artworkStatus: form.artworkStatus,
        sendArtworkRequest: form.sendArtworkRequest,
        photoEntries: (form.photoEntries || []).map((entry: any) => ({
          ...entry,
        })),
        modifiedAt,
      };

      setMeasurementJobs((prev: any[]) =>
        prev.map((item: any) =>
          item.id === editingSubmittedOrder.id ? updatedMeasurementJob : item
        )
      );

      setSubmitState({
        loading: true,
        message: `Syncing order details for ${
          editingSubmittedOrder.printavoQuoteNumber || editingSubmittedOrder.id
        }...`,
      });

      try {
        const preparedForm = await prepareFormPayloadForPrintavo(form);

        const response = await fetch(`${getApiBaseUrl()}/api/printavo/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...preparedForm,
            measurementOnly: true,
            printavoQuoteId: editingSubmittedOrder.printavoQuoteId || undefined,
            repEmail: mainEmail,
            repName: currentUser,
            deviceName,
            isModification: true,
            modifiedOrderId: editingSubmittedOrder.id,
            modificationNote: "Offsite measurement job details updated from iPad.",
          }),
        });

        const rawText = await response.text();
        const data = parseMaybeJson(response, rawText);

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Measurement job sync failed.");
        }

        const printavoMeta = buildPrintavoMetaFromResponse(data);

        const syncedMeasurementJob = {
          ...updatedMeasurementJob,
          ...printavoMeta,
          status: editingSubmittedOrder.status || updatedMeasurementJob.status || "",
          uploadedPhotoUrls: preparedForm.uploadedPhotoUrls || [],
          uploadedProductionFileUrls:
            preparedForm.uploadedProductionFileUrls || [],
        };

        setMeasurementJobs((prev: any[]) =>
          prev.map((item: any) =>
            item.id === editingSubmittedOrder.id ? syncedMeasurementJob : item
          )
        );

        setEditingSubmittedOrder({
          ...syncedMeasurementJob,
          __source: "measurement",
        });
        setSelectedMeasurement({
          ...syncedMeasurementJob,
          __source: "measurement",
        });
        setLastSavedFormSnapshot(buildComparableFormSnapshot(form));

        setSubmitState({
          loading: false,
          message:
            "Measurement job updated. Use Submit Measurements when the field measurements are ready.",
        });

        if (goHomeAfterSave) {
          exitWizardToHome();
          return;
        }

        setStep(1);
        setScreen("wizard");
        return;
      } catch (error: any) {
        setSubmitState({
          loading: false,
          message:
            error.message ||
            "Measurement job updated locally, but backend sync failed.",
        });

        if (goHomeAfterSave) {
          exitWizardToHome();
          return;
        }

        setStep(1);
        setScreen("wizard");
        return;
      }
    }

    if (isEditing && editingSource === "existing") {
      const modifiedAt = new Date().toLocaleString();

      const updatedExistingOrder = {
        ...editingSubmittedOrder,
        customer:
          `${form.firstName} ${form.lastName}`.trim() || "Untitled customer",
        firstName: form.firstName,
        lastName: form.lastName,
        owner: form.customerOwner,
        customerOwner: form.customerOwner,
        company: form.company,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        additionalInquiries: form.additionalInquiries,
        productTypes: [...(form.productTypes || [])],
        printedDecalFinish: form.printedDecalFinish || "",
        wallGraphicType: form.wallGraphicType || "",
        wallGraphicFinish: form.wallGraphicFinish || "",
        otherProductType: form.otherProductType || "",
        lineItems: (form.lineItems || []).map((item: any) => ({ ...item })),
        productionFiles: (form.productionFiles || []).map((file: any) => ({
          ...file,
        })),
        locationType: form.locationType,
        surfaceType: form.surfaceType,
        surfaceOther: form.surfaceOther,
        installNeeded: form.installNeeded,
        installSameAsCustomer: form.installSameAsCustomer,
        installAddress: form.installAddress,
        installCity: form.installCity,
        installState: form.installState,
        installZip: form.installZip,
        logoStatus: form.logoStatus,
        colorNotes: form.colorNotes,
        mockupInstructions: form.mockupInstructions,
        artworkStatus: form.artworkStatus,
        sendArtworkRequest: form.sendArtworkRequest,
        photoEntries: (form.photoEntries || []).map((entry: any) => ({
          ...entry,
        })),
        note: "Modified from iPad",
        wasModified: true,
        modifiedAt,
      };

      setExistingOrders((prev: any[]) =>
        prev.map((item: any) =>
          item.id === editingSubmittedOrder.id ? updatedExistingOrder : item
        )
      );

      const submissionRecordId = `${editingSubmittedOrder.id}-MOD-${Date.now()}`;
      const pendingSubmission = {
        ...updatedExistingOrder,
        id: submissionRecordId,
        invoiceNumber:
          updatedExistingOrder.invoiceNumber ||
          String(editingSubmittedOrder.id || "").replace("#", ""),
        nickname:
          updatedExistingOrder.nickname ||
          updatedExistingOrder.company ||
          updatedExistingOrder.customer,
        by: deviceName,
        status: "Pending Sync",
        modificationNote: "Existing order updated from iPad.",
        __source: "submission",
      };

      setSubmittedOrders((prev: any[]) => upsertSubmittedOrder(prev, pendingSubmission));
      setSelectedOrder(pendingSubmission);

      setSubmitState({
        loading: true,
        message: `Syncing updated order ${editingSubmittedOrder.id}...`,
      });

      try {
        const preparedForm = await prepareFormPayloadForPrintavo(form);

        const response = await fetch(`${getApiBaseUrl()}/api/printavo/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...preparedForm,
            printavoQuoteId: editingSubmittedOrder.printavoQuoteId || undefined,
            repEmail: mainEmail,
            repName: currentUser,
            deviceName,
            isModification: true,
            modifiedOrderId: editingSubmittedOrder.id,
            modificationNote: "Existing order updated from iPad.",
          }),
        });

        const rawText = await response.text();
        const data = parseMaybeJson(response, rawText);

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Update sync failed.");
        }

        const printavoMeta = buildPrintavoMetaFromResponse(data);

        const syncedSubmission = {
          ...pendingSubmission,
          ...printavoMeta,
          status: "Sent to Printavo",
        };

        setSubmittedOrders((prev: any[]) =>
          upsertSubmittedOrder(prev, syncedSubmission)
        );

        setSelectedOrder(syncedSubmission);
        setEditingSubmittedOrder({
          ...updatedExistingOrder,
          ...printavoMeta,
          __source: "existing",
        });
        setLastSavedFormSnapshot(buildComparableFormSnapshot(form));

        setSubmitState({
          loading: false,
          message: `Changes appended to Printavo for order ${editingSubmittedOrder.id}.`,
        });

        if (goHomeAfterSave) {
          exitWizardToHome();
          return;
        }

        setScreen("wizard");
        return;
      } catch (error: any) {
        setSelectedOrder(pendingSubmission);
        setSubmitState({
          loading: false,
          message:
            error.message ||
            `Order ${editingSubmittedOrder.id} updated locally at ${modifiedAt}.`,
        });
        setScreen("wizard");
        return;
      }
    }

    if (isEditing) {
      const updatedOrder = {
        ...editingSubmittedOrder,
        customer:
          `${form.firstName} ${form.lastName}`.trim() || "Untitled customer",
        firstName: form.firstName,
        lastName: form.lastName,
        customerOwner: form.customerOwner,
        company: form.company,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        additionalInquiries: form.additionalInquiries,
        productTypes: [...(form.productTypes || [])],
        printedDecalFinish: form.printedDecalFinish || "",
        wallGraphicType: form.wallGraphicType || "",
        wallGraphicFinish: form.wallGraphicFinish || "",
        otherProductType: form.otherProductType || "",
        lineItems: (form.lineItems || []).map((item: any) => ({ ...item })),
        productionFiles: (form.productionFiles || []).map((file: any) => ({
          ...file,
        })),
        locationType: form.locationType,
        surfaceType: form.surfaceType,
        surfaceOther: form.surfaceOther,
        installNeeded: form.installNeeded,
        installSameAsCustomer: form.installSameAsCustomer,
        installAddress: form.installAddress,
        installCity: form.installCity,
        installState: form.installState,
        installZip: form.installZip,
        logoStatus: form.logoStatus,
        colorNotes: form.colorNotes,
        mockupInstructions: form.mockupInstructions,
        artworkStatus: form.artworkStatus,
        sendArtworkRequest: form.sendArtworkRequest,
        photoEntries: (form.photoEntries || []).map((entry: any) => ({
          ...entry,
        })),
        by: deviceName,
        status: "Pending Sync",
        wasModified: true,
        modificationNote: "Order modified and resubmitted from iPad.",
        modifiedAt: new Date().toLocaleString(),
      };

      setSubmittedOrders((prev: any[]) =>
        prev.map((item: any) =>
          item.id === editingSubmittedOrder.id ? updatedOrder : item
        )
      );

      setSubmitState({
        loading: true,
        message: `Syncing updated order ${editingSubmittedOrder.id}...`,
      });

      try {
        const preparedForm = await prepareFormPayloadForPrintavo(form);

        const response = await fetch(`${getApiBaseUrl()}/api/printavo/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...preparedForm,
            printavoQuoteId: editingSubmittedOrder.printavoQuoteId || undefined,
            repEmail: mainEmail,
            repName: currentUser,
            deviceName,
            isModification: true,
            modifiedOrderId: editingSubmittedOrder.id,
            modificationNote: "Order modified and resubmitted from iPad.",
          }),
        });

        const rawText = await response.text();
        const data = parseMaybeJson(response, rawText);

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Update sync failed.");
        }

        const printavoMeta = buildPrintavoMetaFromResponse(data);

        const syncedOrder = {
          ...updatedOrder,
          ...printavoMeta,
          status: "Sent to Printavo",
        };

        setSubmittedOrders((prev: any[]) =>
          prev.map((item: any) =>
            item.id === editingSubmittedOrder.id ? syncedOrder : item
          )
        );

        setSelectedOrder(syncedOrder);
        setEditingSubmittedOrder({
          ...updatedOrder,
          ...printavoMeta,
          __source: editingSubmittedOrder?.__source,
        });
        setLastSavedFormSnapshot(buildComparableFormSnapshot(form));

        setSubmitState({
          loading: false,
          message: `Changes appended and synced for order ${editingSubmittedOrder.id}.`,
        });

        if (goHomeAfterSave) {
          exitWizardToHome();
          return;
        }

        setScreen("wizard");
        return;
      } catch (error: any) {
        const pendingOrder = {
          ...updatedOrder,
          status: "Pending Sync",
        };

        setSubmittedOrders((prev: any[]) =>
          prev.map((item: any) =>
            item.id === editingSubmittedOrder.id ? pendingOrder : item
          )
        );

        setSelectedOrder(pendingOrder);

        setSubmitState({
          loading: false,
          message:
            error.message ||
            "Update sync failed. Modified order saved locally.",
        });

        setScreen("wizard");
        return;
      }
    }

    const localId = `TEMP-${Math.floor(1000 + (Date.now() % 9000))}`;
    const nickname =
      form.company || form.productTypes?.[0] || "Outside Sales Intake";

    const pendingOrder = {
      customer:
        `${form.firstName} ${form.lastName}`.trim() || "Untitled customer",
      id: localId,
      invoiceNumber: localId.replace("TEMP-", ""),
      nickname,
      firstName: form.firstName,
      lastName: form.lastName,
      by: deviceName,
      status: "Pending Sync",
      customerOwner: form.customerOwner,
      company: form.company,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
      additionalInquiries: form.additionalInquiries,
      productTypes: [...(form.productTypes || [])],
      printedDecalFinish: form.printedDecalFinish || "",
      wallGraphicType: form.wallGraphicType || "",
      wallGraphicFinish: form.wallGraphicFinish || "",
      otherProductType: form.otherProductType || "",
      locationType: form.locationType,
      surfaceType: form.surfaceType,
      surfaceOther: form.surfaceOther,
      installNeeded: form.installNeeded,
      installSameAsCustomer: form.installSameAsCustomer,
      installAddress: form.installAddress,
      installCity: form.installCity,
      installState: form.installState,
      installZip: form.installZip,
      logoStatus: form.logoStatus,
      colorNotes: form.colorNotes,
      mockupInstructions: form.mockupInstructions,
      artworkStatus: form.artworkStatus,
      sendArtworkRequest: form.sendArtworkRequest,
      photoEntries: buildHistoryPhotoEntries(form.photoEntries || []),
      lineItems: (form.lineItems || []).map((item: any) => ({ ...item })),
      productionFiles: buildHistoryProductionFiles(form.productionFiles || []),
    };

    setSubmittedOrders((prev: any[]) => [pendingOrder, ...prev]);
    setSelectedOrder(pendingOrder);
    setSubmitState({
      loading: true,
      message: "Saving order and syncing to backend...",
    });

    try {
      const preparedForm = await prepareFormPayloadForPrintavo(form);

      const response = await fetch(`${getApiBaseUrl()}/api/printavo/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...preparedForm,
          repEmail: mainEmail,
          repName: currentUser,
          deviceName,
        }),
      });

      const rawText = await response.text();
      const data = parseMaybeJson(response, rawText);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Submit failed.");
      }

      const printavoMeta = buildPrintavoMetaFromResponse(data);
      const visualId =
        printavoMeta.printavoQuoteNumber ||
        `#${Math.floor(1000 + (Date.now() % 9000))}`;

      const finalId = String(visualId).startsWith("#")
        ? String(visualId)
        : `#${visualId}`;

      const finalInvoiceNumber = String(finalId).replace("#", "");

      const finalOrder = {
        ...pendingOrder,
        ...printavoMeta,
        id: finalId,
        invoiceNumber: finalInvoiceNumber,
        nickname: pendingOrder.nickname,
        status: "Sent to Printavo",
        photoEntries: buildHistoryPhotoEntries(
          form.photoEntries || [],
          preparedForm.uploadedPhotoUrls || []
        ),
        uploadedPhotoUrls: preparedForm.uploadedPhotoUrls || [],
        productionFiles: buildHistoryProductionFiles(
          form.productionFiles || [],
          preparedForm.uploadedProductionFileUrls || []
        ),
        uploadedProductionFileUrls:
          preparedForm.uploadedProductionFileUrls || [],
      };

      setSubmittedOrders((prev: any[]) =>
        prev.map((item: any) => (item.id === localId ? finalOrder : item))
      );

      setSelectedOrder(finalOrder);
      clearSubmittedDrafts();
      resetForm();

      setSubmitState({
        loading: false,
        message: `Submitted successfully as ${finalId}. Photo links were appended into Printavo notes.`,
      });

      setScreen("history");
    } catch (error: any) {
      const failedOrder = {
        ...pendingOrder,
        status: "Pending Sync",
      };

      setSubmittedOrders((prev: any[]) =>
        prev.map((item: any) => (item.id === localId ? failedOrder : item))
      );

      setSelectedOrder(failedOrder);
      clearSubmittedDrafts();
      resetForm();

      setSubmitState({
        loading: false,
        message: error.message || "Backend sync failed. Order saved locally.",
      });

      setScreen("history");
    }
  };

  const retrySyncOrder = async (order: any) => {
    setSubmitState({
      loading: true,
      message: `Retrying sync for ${order.id}...`,
    });

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/printavo/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: order.firstName,
          lastName: order.lastName,
          customerOwner: order.customerOwner,
          company: order.company,
          phone: order.phone,
          email: order.email,
          address: order.address,
          city: order.city,
          state: order.state,
          zip: order.zip,
          additionalInquiries: order.additionalInquiries,
          productTypes: order.productTypes || [],
          printedDecalFinish: order.printedDecalFinish || "",
          wallGraphicType: order.wallGraphicType || "",
          wallGraphicFinish: order.wallGraphicFinish || "",
          otherProductType: order.otherProductType || "",
          locationType: order.locationType,
          surfaceType: order.surfaceType,
          surfaceOther: order.surfaceOther,
          installNeeded: order.installNeeded,
          installSameAsCustomer: order.installSameAsCustomer,
          installAddress: order.installAddress,
          installCity: order.installCity,
          installState: order.installState,
          installZip: order.installZip,
          logoStatus: order.logoStatus,
          colorNotes: order.colorNotes,
          mockupInstructions: order.mockupInstructions,
          artworkStatus: order.artworkStatus,
          sendArtworkRequest: order.sendArtworkRequest,
          photoEntries: order.photoEntries || [],
          lineItems: order.lineItems || [],
          productionFiles: order.productionFiles || [],
          repEmail: mainEmail,
          repName: currentUser,
          deviceName,
          isModification: !!order.wasModified,
          modifiedOrderId: order.wasModified ? order.id : undefined,
          modificationNote: order.wasModified
            ? order.modificationNote ||
              "Order modified and resubmitted from iPad."
            : undefined,
          printavoQuoteId: order.printavoQuoteId || undefined,
        }),
      });

      const rawText = await response.text();
      const data = parseMaybeJson(response, rawText);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Retry sync failed.");
      }

      const printavoMeta = buildPrintavoMetaFromResponse(data);

      setSubmittedOrders((prev: any[]) =>
        prev.map((item: any) =>
          item.id === order.id
            ? {
                ...item,
                ...printavoMeta,
                status: "Sent to Printavo",
              }
            : item
        )
      );

      setSelectedOrder((prev: any) =>
        prev && prev.id === order.id
          ? {
              ...prev,
              ...printavoMeta,
              status: "Sent to Printavo",
            }
          : prev
      );

      setSubmitState({
        loading: false,
        message: `Retry successful. Synced ${order.id}.`,
      });
    } catch (error: any) {
      setSubmitState({
        loading: false,
        message: error.message || "Retry sync failed.",
      });
    }
  };


  const submitMeasurements = async () => {
    if (!editingSubmittedOrder) {
      setSubmitState({
        loading: false,
        message: "No measurement job is selected.",
      });
      return;
    }

    const modifiedAt = new Date().toLocaleString();

    const updatedMeasurementJob = {
      ...editingSubmittedOrder,
      customer:
        `${form.firstName} ${form.lastName}`.trim() ||
        editingSubmittedOrder.customer ||
        "Untitled customer",
      jobNickname:
        form.jobNickname ||
        editingSubmittedOrder.jobNickname ||
        editingSubmittedOrder.nickname ||
        "",
      nickname:
        form.jobNickname ||
        editingSubmittedOrder.nickname ||
        editingSubmittedOrder.jobNickname ||
        "",
      firstName: form.firstName,
      lastName: form.lastName,
      customerOwner: form.customerOwner,
      company: form.company,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
      state: form.state,
      zip: form.zip,
      additionalInquiries: form.additionalInquiries,
      productTypes: [...(form.productTypes || [])],
      printedDecalFinish: form.printedDecalFinish || "",
      wallGraphicType: form.wallGraphicType || "",
      wallGraphicFinish: form.wallGraphicFinish || "",
      otherProductType: form.otherProductType || "",
      lineItems: (form.lineItems || []).map((item: any) => ({ ...item })),
      productionFiles: (form.productionFiles || []).map((file: any) => ({
        ...file,
      })),
      locationType: form.locationType,
      surfaceType: form.surfaceType,
      surfaceOther: form.surfaceOther,
      installNeeded: form.installNeeded,
      installSameAsCustomer: form.installSameAsCustomer,
      installAddress: form.installAddress,
      installCity: form.installCity,
      installState: form.installState,
      installZip: form.installZip,
      offsiteMeasurementsNeeded: !!form.offsiteMeasurementsNeeded,
      unableToTakePhotosNow: !!form.unableToTakePhotosNow,
      logoStatus: form.logoStatus,
      colorNotes: form.colorNotes,
      mockupInstructions: form.mockupInstructions,
      artworkStatus: form.artworkStatus,
      sendArtworkRequest: form.sendArtworkRequest,
      photoEntries: (form.photoEntries || []).map((entry: any) => ({
        ...entry,
      })),
      modifiedAt,
    };

    setMeasurementJobs((prev: any[]) => {
      const next = prev.map((item: any) =>
        item.id === editingSubmittedOrder.id ? updatedMeasurementJob : item
      );
      return mergeMeasurementJobs(next, []);
    });

    setSubmitState({
      loading: true,
      message: `Syncing measurement update for ${
        editingSubmittedOrder.printavoQuoteNumber || editingSubmittedOrder.id
      }...`,
    });

    try {
      const preparedForm = await prepareFormPayloadForPrintavo(form);

      const response = await fetch(`${getApiBaseUrl()}/api/printavo/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...preparedForm,
          measurementOnly: true,
          printavoQuoteId: editingSubmittedOrder.printavoQuoteId || undefined,
          repEmail: mainEmail,
          repName: currentUser,
          deviceName,
          isModification: true,
          modifiedOrderId: editingSubmittedOrder.id,
          modificationNote: "Offsite measurement updated from iPad.",
        }),
      });

      const rawText = await response.text();
      const data = parseMaybeJson(response, rawText);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Measurement sync failed.");
      }

      const printavoMeta = buildPrintavoMetaFromResponse(data);

      let measurementCompleteMessage = "";

      if (editingSubmittedOrder.printavoQuoteId) {
        const completeResponse = await fetch(
          `${getApiBaseUrl()}/api/printavo/complete-measurement`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              printavoQuoteId: editingSubmittedOrder.printavoQuoteId,
            }),
          }
        );

        const completeRawText = await completeResponse.text();
        const completeData = parseMaybeJson(completeResponse, completeRawText);

        if (!completeResponse.ok || !completeData.ok) {
          throw new Error(
            completeData.error || "Measurement status update failed."
          );
        }

        measurementCompleteMessage =
          completeData.message || "Marked as OFFSITE - MEASUREMENT - COMPLETE.";
      }

      const syncedMeasurementJob = {
        ...updatedMeasurementJob,
        ...printavoMeta,
        status: "OFFSITE - MEASUREMENT - COMPLETE",
        uploadedPhotoUrls: preparedForm.uploadedPhotoUrls || [],
        uploadedProductionFileUrls:
          preparedForm.uploadedProductionFileUrls || [],
      };

      setMeasurementJobs((prev: any[]) =>
        prev.map((item: any) =>
          item.id === editingSubmittedOrder.id ? syncedMeasurementJob : item
        )
      );

      setEditingSubmittedOrder({
        ...syncedMeasurementJob,
        __source: "measurement",
      });
      setSelectedMeasurement({
        ...syncedMeasurementJob,
        __source: "measurement",
      });
      setLastSavedFormSnapshot(buildComparableFormSnapshot(form));

      const measurementHistoryCard = {
        id:
          editingSubmittedOrder?.measurementCompleted && editingSubmittedOrder?.id
            ? editingSubmittedOrder.id
            : `MEASURE-${Date.now()}`,
        invoiceNumber:
          syncedMeasurementJob.printavoQuoteNumber ||
          syncedMeasurementJob.invoiceNumber ||
          "",
        printavoQuoteNumber:
          syncedMeasurementJob.printavoQuoteNumber ||
          syncedMeasurementJob.invoiceNumber ||
          "",
        printavoQuoteId: syncedMeasurementJob.printavoQuoteId || "",
        jobNickname:
          syncedMeasurementJob.jobNickname ||
          syncedMeasurementJob.nickname ||
          form.jobNickname ||
          "",
        nickname:
          syncedMeasurementJob.jobNickname ||
          syncedMeasurementJob.nickname ||
          form.jobNickname ||
          syncedMeasurementJob.company ||
          syncedMeasurementJob.customer ||
          "Measurement Complete",
        customer:
          syncedMeasurementJob.customer ||
          [syncedMeasurementJob.firstName, syncedMeasurementJob.lastName]
            .filter(Boolean)
            .join(" ") ||
          "Unknown Customer",
        firstName: syncedMeasurementJob.firstName || "",
        lastName: syncedMeasurementJob.lastName || "",
        company: syncedMeasurementJob.company || "",
        phone: syncedMeasurementJob.phone || "",
        email: syncedMeasurementJob.email || "",
        address: syncedMeasurementJob.address || "",
        city: syncedMeasurementJob.city || "",
        state: syncedMeasurementJob.state || "",
        zip: syncedMeasurementJob.zip || "",
        by: deviceName,
        status: "Offsite Measurement Complete",
        measurementCompleted: true,
        modifiedAt,
        photoEntries: buildHistoryPhotoEntries(
          form.photoEntries || [],
          preparedForm.uploadedPhotoUrls || []
        ),
        uploadedPhotoUrls: preparedForm.uploadedPhotoUrls || [],
        lineItems: (form.lineItems || []).map((item: any) => ({ ...item })),
        productionFiles: buildHistoryProductionFiles(
          form.productionFiles || [],
          preparedForm.uploadedProductionFileUrls || []
        ),
        uploadedProductionFileUrls:
          preparedForm.uploadedProductionFileUrls || [],
        additionalInquiries: form.additionalInquiries || "",
        mockupInstructions: form.mockupInstructions || "",
      };

      setSubmittedOrders((prev: any[]) => upsertSubmittedOrder(prev, measurementHistoryCard));
      setSelectedOrder(measurementHistoryCard);

      setSubmitState({
        loading: false,
        message: `Measurements appended to Printavo for ${
          editingSubmittedOrder.printavoQuoteNumber || editingSubmittedOrder.id
        }. ${measurementCompleteMessage}`.trim(),
      });

      setScreen("home");
      return;
    } catch (error: any) {
      setSubmitState({
        loading: false,
        message:
          error.message ||
          "Measurement update saved locally, but backend sync failed.",
      });
      setScreen("measurement");
      return;
    }
  };

  if (!authUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        loginMessage={loginMessage}
        deviceName={deviceName}
      />
    );
  }

  if (screen === "home") {
    return (
      <HomeScreen
        setScreen={setScreen}
        setSelectedInstall={setSelectedInstall}
        draftStatus={draftStatus}
        currentUser={currentUser}
        deviceName={deviceName}
        submitState={submitState}
        savedDrafts={savedDrafts}
        resumeDraft={resumeDraft}
        deleteDraft={deleteDraft}
        toggleFavoriteDraft={toggleFavoriteDraft}
        startFreshOrder={startFreshOrder}
      />
    );
  }

  if (screen === "existing") {
    return (
      <ExistingOrdersScreen
        searchTerm={measurementSearchTerm}
        setSearchTerm={setMeasurementSearchTerm}
        filteredExisting={filteredMeasurementJobs}
        setScreen={setScreen}
        setSelectedOrder={setSelectedOrder}
        openMeasurementJobForMeasurement={openMeasurementJobForMeasurement}
        openMeasurementJobForEdit={openMeasurementJobForEdit}
        loadMeasurementJobs={loadMeasurementJobs}
        loadingMeasurementJobs={loadingMeasurementJobs}
        measurementJobsMessage={measurementJobsMessage}
        measurementLastRefresh={measurementLastRefresh}
      />
    );
  }

  if (screen === "measurement" && editingSubmittedOrder) {
    return (
      <MeasurementScreen
        form={form}
        updateField={updateField}
        addPhotoEntry={addPhotoEntry}
        updatePhotoEntry={updatePhotoEntry}
        movePhotoEntry={movePhotoEntry}
        deletePhotoEntry={deletePhotoEntry}
        submitMeasurements={submitMeasurements}
        submitState={submitState}
        setScreen={setScreen}
        selectedMeasurement={editingSubmittedOrder}
      />
    );
  }

  if (screen === "history") {
    return (
      <HistoryScreen
        submittedOrders={submittedOrders}
        installHistorySnapshots={installHistorySnapshots}
        setScreen={setScreen}
        setSelectedOrder={setSelectedOrder}
        setSelectedInstall={setSelectedInstall}
        setLastCompletedInstall={setLastCompletedInstall}
        retrySyncOrder={retrySyncOrder}
        openHistoryOrder={openHistoryOrder}
        clearSubmittedOrderHistory={clearSubmittedOrderHistory}
        submitState={submitState}
      />
    );
  }

  if (screen === "submission-detail" && selectedOrder) {
    return (
      <SubmissionDetailScreen
        order={selectedOrder}
        setScreen={setScreen}
        retrySyncOrder={retrySyncOrder}
        submitState={submitState}
        openSubmittedOrderForEdit={openSubmittedOrderForEdit}
      />
    );
  }

  if (screen === "installer") {
    return (
      <InstallerScreen
        installs={installJobs}
        setSelectedInstall={setSelectedInstall}
        setScreen={setScreen}
        loadNewJobs={loadNewJobs}
        loadingJobs={loadingJobs}
        loadJobsMessage={loadJobsMessage}
        installerLastRefresh={installerLastRefresh}
      />
    );
  }

  if (screen === "installer-detail" && selectedInstall) {
    return (
      <InstallerDetailScreen
        selectedInstall={selectedInstall}
        setSelectedInstall={setSelectedInstall}
        setScreen={setScreen}
        setLastCompletedInstall={setLastCompletedInstall}
      />
    );
  }

  if (screen === "installer-completion" && selectedInstall) {
    return (
      <InstallerCompletionScreen
        selectedInstall={selectedInstall}
        setSelectedInstall={setSelectedInstall}
        onInstallReportSaved={(updatedInstall: any, snapshot: any) => {
          const normalizedCompletedInstall = {
            ...updatedInstall,
            originalJobId: updatedInstall?.originalJobId || updatedInstall?.id || "",
          };
          const normalizedSnapshot = {
            ...snapshot,
            originalJobId:
              snapshot?.originalJobId || updatedInstall?.originalJobId || updatedInstall?.id || "",
          };

          setSelectedInstall(normalizedCompletedInstall);
          setLastCompletedInstall(normalizedCompletedInstall);
          setInstallJobs((prev: any[]) =>
            removeCompletedInstallFromActiveJobs(prev, normalizedCompletedInstall)
          );
          setInstallHistorySnapshots((prev: any[]) =>
            upsertInstallHistorySnapshot(prev, normalizedSnapshot)
          );
        }}
        setScreen={setScreen}
      />
    );
  }

  if (screen === "installer-complete-success") {
    return (
      <InstallerCompleteSuccessScreen
        lastCompletedInstall={lastCompletedInstall}
        setScreen={setScreen}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        mainEmail={mainEmail}
        setMainEmail={setMainEmail}
        apiBaseUrl={apiBaseUrl}
        setApiBaseUrl={setApiBaseUrl}
        deviceName={deviceName}
        setDeviceName={setDeviceName}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        authUser={authUser}
        authUsers={authUsers}
        addAuthUser={addAuthUser}
        updateAuthUser={updateAuthUser}
        removeAuthUser={removeAuthUser}
        saveAuthUsersNow={saveAuthUsersNow}
        resetAuthUsers={resetAuthUsers}
        handleLogout={handleLogout}
        syncSharedAuthUsers={syncSharedAuthUsers}
        activeAuthSessions={activeAuthSessions}
        syncActiveAuthSessions={syncActiveAuthSessions}
        handleLogoutAllDevices={handleLogoutAllDevices}
        handleLogoutMyDevices={handleLogoutMyDevices}
        saveSettings={saveSettings}
        testBackendConnection={testBackendConnection}
        connectionState={connectionState}
        settingsMessage={settingsMessage}
        setScreen={setScreen}
        clearInstallerCache={clearInstallerCache}
        clearMeasurementCache={clearMeasurementCache}
        clearAllJobCaches={clearAllJobCaches}
        installerCacheCount={installJobs.length}
        measurementCacheCount={measurementJobs.length}
        historySnapshotCount={installHistorySnapshots.length}
      />
    );
  }

  if (screen === "app-guide") {
    return <AppGuideScreen setScreen={setScreen} />;
  }

  if (screen === "inquiry") {
    return (
      <InquiryScreen
        setScreen={setScreen}
        apiBaseUrl={apiBaseUrl}
        currentUser={currentUser}
        deviceName={deviceName}
      />
    );
  }
  
  return (
    <WizardScreen
      steps={steps}
      step={step}
      totalSteps={totalSteps}
      form={form}
      updateField={updateField}
      addPhotoEntry={addPhotoEntry}
      updatePhotoEntry={updatePhotoEntry}
      movePhotoEntry={movePhotoEntry}
      deletePhotoEntry={deletePhotoEntry}
      saveDraftNow={saveDraftNow}
      setStep={setStep}
      setScreen={setScreen}
      submitOrder={submitOrder}
      submitState={submitState}
      editingSubmittedOrder={editingSubmittedOrder}
      exitWizardToHome={exitWizardToHome}
      addProductionFiles={addProductionFiles}
      removeProductionFile={removeProductionFile}
      updateLineItem={updateLineItem}
      hasUnsavedChanges={hasUnsavedChanges}
    />
  );
}
