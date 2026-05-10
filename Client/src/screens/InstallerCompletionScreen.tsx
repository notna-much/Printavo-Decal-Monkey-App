import { useMemo, useState } from "react";
import { Card, ActionButton, Shell } from "../components/ui";

const outcomeOptions = [
  {
    value: "completed_successfully",
    label: "Completed Successfully",
    description: "Job finished with no issues identified.",
  },
  {
    value: "completed_with_issues",
    label: "Completed with Issues",
    description: "Job finished, but something needs follow-up.",
  },
  {
    value: "unable_to_complete",
    label: "Unable to Complete",
    description: "Job could not be completed as planned.",
  },
];

const issuePriorityOptions = [
  {
    value: "follow_up",
    label: "Needs Follow-Up",
  },
  {
    value: "must_resolve",
    label: "Must Resolve",
  },
  {
    value: "critical",
    label: "Critical",
  },
];

const PRINTAVO_STATUS_INSTALLED = "400075";
const PRINTAVO_STATUS_INSTALL_ISSUE = "533842";

function formatDateTime(dateString: string) {
  if (!dateString) return "";
  try {
    return new Date(dateString).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getApiBaseUrl() {
  try {
    return String(
      localStorage.getItem("dm_api_base_url") || "http://localhost:3001"
    )
      .trim()
      .replace(/\/+$/, "");
  } catch {
    return "http://localhost:3001";
  }
}

function getTargetPrintavoStatusId(outcome: string): string | null {
  switch (outcome) {
    case "completed_successfully":
      return PRINTAVO_STATUS_INSTALLED;
    case "completed_with_issues":
      return PRINTAVO_STATUS_INSTALL_ISSUE;
    case "unable_to_complete":
      return PRINTAVO_STATUS_INSTALL_ISSUE;
    default:
      return null;
  }
}

function formatOutcome(outcome: string) {
  switch (outcome) {
    case "completed_successfully":
      return "Completed Successfully";
    case "completed_with_issues":
      return "Completed With Issues";
    case "unable_to_complete":
      return "Unable To Complete";
    default:
      return "Completed";
  }
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

function buildInstallNoteAppend({
  selectedInstall,
  outcome,
  completionNotes,
  issuePriority,
  issueSummary,
  recommendedNextStep,
  uploadedCompletionImageUrls,
  completedAt,
}: any) {
  const lines = [];

  lines.push(
    `Installer Report (${new Date(completedAt).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })})`
  );
  lines.push(`Outcome: ${formatOutcome(outcome)}`);

  if (completionNotes) {
    lines.push(`Completion Notes: ${completionNotes}`);
  }

  if (issuePriority && issuePriority !== "none") {
    lines.push(
      `Issue Priority: ${String(issuePriority)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())}`
    );
  }

  if (issueSummary) {
    lines.push(`Issue Summary: ${issueSummary}`);
  }

  if (recommendedNextStep) {
    lines.push(`Recommended Next Step: ${recommendedNextStep}`);
  }

  if (uploadedCompletionImageUrls?.length) {
    lines.push(`Completion Photos:\n${uploadedCompletionImageUrls.join("\n")}`);
  }

  if (selectedInstall?.printavoQuoteNumber || selectedInstall?.invoiceNumber) {
    lines.push(
      `Source Job: ${
        selectedInstall.printavoQuoteNumber ||
        selectedInstall.invoiceNumber ||
        selectedInstall.id
      }`
    );
  }

  return lines.filter(Boolean).join("\n\n");
}

export default function InstallerCompletionScreen({
  selectedInstall,
  setSelectedInstall,
  onInstallReportSaved,
  setScreen,
}: any) {
  const existingReport = selectedInstall?.installCompletion || null;

  const [outcome, setOutcome] = useState(
    existingReport?.outcome || "completed_successfully"
  );
  const [completionNotes, setCompletionNotes] = useState(
    existingReport?.completionNotes || ""
  );
  const [issuePriority, setIssuePriority] = useState(
    existingReport?.issuePriority || "follow_up"
  );
  const [issueSummary, setIssueSummary] = useState(
    existingReport?.issueSummary || ""
  );
  const [recommendedNextStep, setRecommendedNextStep] = useState(
    existingReport?.recommendedNextStep || ""
  );
  const [completionImages, setCompletionImages] = useState(
    existingReport?.completionImages || []
  );
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showIssueFields =
    outcome === "completed_with_issues" || outcome === "unable_to_complete";

  const titleLine = useMemo(() => {
    const invoice =
      selectedInstall?.invoiceNumber ||
      String(selectedInstall?.id || "").replace("#", "");
    const nickname =
      selectedInstall?.nickname ||
      selectedInstall?.company ||
      selectedInstall?.customer ||
      "Untitled";
    return `${invoice} - ${nickname}`;
  }, [selectedInstall]);

  const handleImageUpload = (event: any) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (loadEvent: any) => {
        setCompletionImages((prev: string[]) => [
          ...prev,
          loadEvent.target.result,
        ]);
      };
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  };

  const removeCompletionImage = (indexToRemove: number) => {
    setCompletionImages((prev: string[]) =>
      prev.filter((_: string, index: number) => index !== indexToRemove)
    );
  };

  const uploadCompletionImages = async (imageSources: string[]) => {
    const existingUrls = uniqueStrings(
      imageSources.filter((item: any) => /^https?:\/\//i.test(String(item || "")))
    );
    const dataUrls = imageSources.filter((item: any) =>
      /^data:/i.test(String(item || ""))
    );

    if (!dataUrls.length) {
      return existingUrls;
    }

    const formData = new FormData();

    dataUrls.forEach((dataUrl: string, index: number) => {
      const file = dataUrlToFile(dataUrl, `install-photo-${index + 1}`);
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
      throw new Error(data?.error || "Install photo upload failed.");
    }

    return uniqueStrings([...(data.urls || []), ...existingUrls]);
  };

  const saveInstallReport = async () => {
    if (submitting) return;

    if (!confirmationChecked) {
      setSaveMessage("Please confirm the install report before submitting.");
      return;
    }

    if (outcome === "unable_to_complete" && !completionNotes.trim()) {
      setSaveMessage(
        "Completion notes are required when the job could not be completed."
      );
      return;
    }

    if (showIssueFields && !issueSummary.trim()) {
      setSaveMessage(
        "Please provide an issue summary for this install report."
      );
      return;
    }

    setSubmitting(true);
    setSaveMessage("Submitting install report...");

    const completedAt = new Date().toISOString();

    let uploadedCompletionImageUrls: string[] = [];

    try {
      uploadedCompletionImageUrls = await uploadCompletionImages(
        completionImages || []
      );
    } catch (uploadErr: any) {
      setSaveMessage(uploadErr?.message || "Install photo upload failed.");
      setSubmitting(false);
      return;
    }

    const installCompletion: any = {
      outcome,
      noIssuesIdentified: outcome === "completed_successfully",
      completionNotes,
      issuePriority: showIssueFields ? issuePriority : "none",
      issueSummary: showIssueFields ? issueSummary : "",
      recommendedNextStep: showIssueFields ? recommendedNextStep : "",
      completionImages,
      completionImageUrls: uploadedCompletionImageUrls,
      completedAt,
      updatedAt: completedAt,
      printavoStatusUpdateAttempted: false,
      printavoStatusUpdateSuccess: false,
      printavoStatusUpdateMessage: "",
    };

    const isInvoiceJob = selectedInstall?.printavoOrderType === "Invoice";
    const hasPrintavoId = !!selectedInstall?.printavoQuoteId;

    const targetStatusId =
      isInvoiceJob && hasPrintavoId ? getTargetPrintavoStatusId(outcome) : null;

    let nextStatus = selectedInstall?.status || "Job";

    if (targetStatusId) {
      installCompletion.printavoStatusUpdateAttempted = true;

      try {
        const installNoteAppend = buildInstallNoteAppend({
          selectedInstall,
          outcome,
          completionNotes,
          issuePriority,
          issueSummary,
          recommendedNextStep,
          uploadedCompletionImageUrls,
          completedAt,
        });

        const response = await fetch(
          `${getApiBaseUrl()}/api/printavo/mark-installed`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              printavoQuoteId: selectedInstall.printavoQuoteId,
              statusId: targetStatusId,
              installNoteAppend,
            }),
          }
        );

        const rawText = await response.text();
        const data = parseMaybeJson(response, rawText);

        if (!response.ok || !data.ok) {
          throw new Error(
            data?.error || "Printavo did not accept the status update."
          );
        }

        installCompletion.printavoStatusUpdateSuccess = true;
        installCompletion.printavoStatusUpdateMessage =
          data?.warning ||
          data?.message ||
          "Printavo status updated.";
        installCompletion.printavoInstalledStatusName =
          data?.updated?.status?.name ||
          data?.statusUpdate?.status?.name ||
          "UPDATED";

        nextStatus =
          data?.updated?.status?.name ||
          data?.statusUpdate?.status?.name ||
          "UPDATED";
      } catch (error: any) {
        installCompletion.printavoStatusUpdateSuccess = false;
        installCompletion.printavoStatusUpdateMessage =
          error?.message ||
          "Install report was not saved because Printavo status update failed.";

        setSaveMessage(installCompletion.printavoStatusUpdateMessage);
        setSubmitting(false);
        return;
      }
    } else if (isInvoiceJob && !hasPrintavoId) {
      setSaveMessage(
        "This invoice is missing a Printavo ID, so it could not be updated."
      );
      setSubmitting(false);
      return;
    } else if (!isInvoiceJob) {
      installCompletion.printavoStatusUpdateMessage =
        "Install report saved locally. Printavo status was not changed because this job is not an invoice.";
    }

    const updatedInstall = {
      ...selectedInstall,
      status: nextStatus,
      installCompletion,
    };

    const snapshot = {
      ...updatedInstall,
      id: String(selectedInstall?.id || ""),
      originalJobId: String(selectedInstall?.originalJobId || selectedInstall?.id || ""),
      snapshotCreatedAt: completedAt,
    };

    if (typeof setSelectedInstall === "function") {
      setSelectedInstall(updatedInstall);
    }

    if (typeof onInstallReportSaved === "function") {
      onInstallReportSaved(updatedInstall, snapshot);
    }

    setSaveMessage(
      installCompletion.printavoStatusUpdateMessage || "Install report saved."
    );

    setSubmitting(false);

    setTimeout(() => {
      setScreen("installer-complete-success");
    }, 350);
  };

  return (
    <Shell title="Install Report" subtitle={titleLine}>
      <div className="space-y-6">
        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-4">
            Job Outcome
          </div>

          <div className="grid gap-3">
            {outcomeOptions.map((option) => {
              const active = outcome === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setOutcome(option.value)}
                  className="rounded-2xl border p-4 text-left transition"
                  style={{
                    borderColor: active ? "#7BC043" : "#CBD5E1",
                    background: active ? "#F0FAE8" : "white",
                    boxShadow: active ? "0 6px 16px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  <div className="font-semibold text-slate-800">
                    {option.label}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-4">
            Completion Photos
          </div>

          <label
            className="inline-flex items-center rounded-2xl px-5 py-4 font-semibold shadow transition active:scale-[0.98] cursor-pointer text-white"
            style={{ background: "#7BC043" }}
          >
            Upload Completion Photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>

          {completionImages.length ? (
            <div className="grid md:grid-cols-2 gap-5 mt-5">
              {completionImages.map((image: string, index: number) => (
                <div
                  key={`completion-image-${index}`}
                  className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50"
                >
                  <img
                    src={image}
                    alt={`Completion ${index + 1}`}
                    className="w-full h-56 object-cover"
                  />
                  <div className="p-4">
                    <ActionButton
                      variant="secondary"
                      className="w-full"
                      onClick={() => removeCompletionImage(index)}
                    >
                      Remove Photo
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
              No completion photos added yet.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-4">
            Completion Notes
          </div>
          <textarea
            className="w-full rounded-2xl border border-slate-300 p-4 text-slate-700 outline-none focus:border-slate-500"
            rows={6}
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            placeholder="Document work completed, installation details, customer interactions, or anything the shop should know."
          />
        </Card>

        {showIssueFields ? (
          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-4">
              Issue Details
            </div>

            <div className="space-y-4">
              <div>
                <div className="font-semibold text-slate-800 mb-2">
                  Issue Priority
                </div>
                <div className="grid gap-3">
                  {issuePriorityOptions.map((option) => {
                    const active = issuePriority === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setIssuePriority(option.value)}
                        className="rounded-2xl border p-4 text-left transition"
                        style={{
                          borderColor: active ? "#7BC043" : "#CBD5E1",
                          background: active ? "#F0FAE8" : "white",
                          boxShadow: active
                            ? "0 6px 16px rgba(0,0,0,0.08)"
                            : "none",
                        }}
                      >
                        <div className="font-semibold text-slate-800">
                          {option.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-800 mb-2">
                  Issue Summary
                </div>
                <textarea
                  className="w-full rounded-2xl border border-slate-300 p-4 text-slate-700 outline-none focus:border-slate-500"
                  rows={4}
                  value={issueSummary}
                  onChange={(e) => setIssueSummary(e.target.value)}
                  placeholder="Describe the issue clearly so CSR and production know what happened."
                />
              </div>

              <div>
                <div className="font-semibold text-slate-800 mb-2">
                  Recommended Next Step
                </div>
                <textarea
                  className="w-full rounded-2xl border border-slate-300 p-4 text-slate-700 outline-none focus:border-slate-500"
                  rows={4}
                  value={recommendedNextStep}
                  onChange={(e) => setRecommendedNextStep(e.target.value)}
                  placeholder="What should happen next to resolve or follow up on this job?"
                />
              </div>
            </div>
          </Card>
        ) : null}

        {existingReport?.completedAt ? (
          <Card className="p-5">
            <div className="text-lg font-bold text-slate-800 mb-2">
              Existing Report on File
            </div>
            <div className="text-slate-700">
              Last saved: {formatDateTime(existingReport.updatedAt || existingReport.completedAt)}
            </div>
            <div className="text-sm text-slate-500 mt-2">
              Saving again will update the existing history card for this job and refresh its timestamp.
            </div>
          </Card>
        ) : null}

        <Card className="p-5">
          <label className="flex items-start gap-3 text-slate-700">
            <input
              type="checkbox"
              checked={confirmationChecked}
              onChange={(e) => setConfirmationChecked(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span>
              I confirm this install report reflects the outcome of the job.
            </span>
          </label>

          {saveMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              {saveMessage}
            </div>
          ) : null}
        </Card>

        <div className="flex flex-wrap gap-3">
          <ActionButton onClick={saveInstallReport} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Install Report"}
          </ActionButton>

          <ActionButton
            variant="secondary"
            onClick={() => setScreen("installer-detail")}
            disabled={submitting}
          >
            Cancel
          </ActionButton>
        </div>
      </div>
    </Shell>
  );
}
