import { useEffect, useState } from "react";
import { Card, ActionButton, Shell } from "../components/ui";
import { getApiBaseUrl } from "../utils/api";
import { htmlToPlainText } from "../utils/text";

function formatOutcome(outcome: string) {
  switch (outcome) {
    case "completed_successfully":
      return "Completed Successfully";
    case "completed_with_issues":
      return "Completed with Issues";
    case "unable_to_complete":
      return "Unable to Complete";
    default:
      return "Unknown";
  }
}

function formatIssuePriority(priority: string) {
  switch (priority) {
    case "follow_up":
      return "Needs Follow-Up";
    case "must_resolve":
      return "Must Resolve";
    case "critical":
      return "Critical";
    case "none":
      return "No Issues";
    default:
      return "";
  }
}

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

function getInvoiceDisplay(selectedInstall: any) {
  return (
    selectedInstall?.printavoQuoteNumber ||
    selectedInstall?.invoiceNumber ||
    String(selectedInstall?.id || "").replace(/^PRINTAVO-/, "")
  );
}

function getInstallInstructionText(selectedInstall: any) {
  const lineItemInstructions = (selectedInstall?.lineItems || [])
    .map((item: any, index: number) => {
      const parts = [item?.description, item?.otherDetails]
        .map((value) => htmlToPlainText(value))
        .filter(Boolean)
        .join("\n");
      if (!parts) return "";
      return `Line Item ${item?.itemNumber || index + 1}\n${parts}`;
    })
    .filter(Boolean)
    .join("\n\n-----\n\n");

  return (
    lineItemInstructions ||
    htmlToPlainText(selectedInstall?.mockup) ||
    htmlToPlainText(selectedInstall?.productionNote) ||
    "No install instructions were loaded for this job."
  );
}

function getLineItemSections(selectedInstall: any) {
  const lineItems = Array.isArray(selectedInstall?.lineItems)
    ? selectedInstall.lineItems
    : [];
  const photoEntries = Array.isArray(selectedInstall?.photoEntries)
    ? selectedInstall.photoEntries
    : [];

  if (lineItems.length) {
    return lineItems.map((item: any, index: number) => {
      const itemNumberText = String(item?.itemNumber || index + 1).toLowerCase();
      const categoryText = String(item?.category || "").toLowerCase();

      const matchingPhoto =
        photoEntries.find((entry: any) => {
          const entryName = String(entry?.name || "").toLowerCase();
          return (
            (entryName && categoryText && entryName.includes(categoryText)) ||
            entryName.includes(`line item ${itemNumberText}`)
          );
        }) ||
        photoEntries[index] ||
        null;

      return {
        id: item?.id || `install-line-${index + 1}`,
        heading: item?.category || `Line Item ${item?.itemNumber || index + 1}`,
        itemNumber: item?.itemNumber || String(index + 1),
        quantity: item?.quantity || "",
        color: item?.color || "",
        description: htmlToPlainText(item?.description),
        otherDetails: htmlToPlainText(item?.otherDetails),
        sizeLabel: item?.sizeLabel || "",
        width: matchingPhoto?.width || "",
        height: matchingPhoto?.height || "",
        imageData:
          matchingPhoto?.annotatedImageData ||
          matchingPhoto?.imageData ||
          item?.imageUrl ||
          "",
        notes: htmlToPlainText(matchingPhoto?.markupNotes),
      };
    });
  }

  return photoEntries.map((entry: any, index: number) => ({
    id: entry?.id || `install-photo-${index + 1}`,
    heading: entry?.name || `Line Item ${index + 1}`,
    itemNumber: String(index + 1),
    quantity: entry?.quantity || "",
    color: "",
    description: "",
    otherDetails: "",
    sizeLabel: "",
    width: entry?.width || "",
    height: entry?.height || "",
    imageData: entry?.annotatedImageData || entry?.imageData || "",
    notes: htmlToPlainText(entry?.markupNotes),
  }));
}

export default function InstallerDetailScreen({
  selectedInstall,
  setSelectedInstall,
  setScreen,
}: any) {
  const [job, setJob] = useState(selectedInstall);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [activeImage, setActiveImage] = useState<string>("");

  useEffect(() => {
    setJob(selectedInstall);
    setDetailsError("");

    const loadDetails = async () => {
      if (!selectedInstall?.printavoQuoteId) return;

      try {
        setLoadingDetails(true);

        const response = await fetch(
          `${getApiBaseUrl()}/api/printavo/install-job-details/${selectedInstall.printavoQuoteId}`
        );
        const rawText = await response.text();

        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(rawText || "Unexpected server response.");
        }

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || "Could not load install job details.");
        }

        if (data?.job) {
          setJob((prev: any) => ({
            ...(prev || {}),
            ...data.job,
            installCompletion: prev?.installCompletion || data.job.installCompletion,
            photoEntries:
              Array.isArray(prev?.photoEntries) && prev.photoEntries.length
                ? prev.photoEntries
                : Array.isArray(data.job.photoEntries)
                ? data.job.photoEntries
                : [],
          }));
        }
      } catch (error: any) {
        setDetailsError(
          error?.message || "Could not load line item details for this job."
        );
      } finally {
        setLoadingDetails(false);
      }
    };

    loadDetails();
  }, [selectedInstall]);

  if (!job) return null;

  const installCompletion = job?.installCompletion || null;
  const installInstructions = getInstallInstructionText(job);
  const lineItemSections = getLineItemSections(job);
  const invoiceDisplay = getInvoiceDisplay(job);
  const missingArtworkCount = lineItemSections.filter((entry: any) => !entry?.imageData).length;
  const phoneNumber = String(job?.phone || "").trim();
  const mapAddress = [job?.address, job?.city, job?.state, job?.zip]
    .filter(Boolean)
    .join(", ")
    .trim();
  const canCallCustomer = !!phoneNumber;
  const canOpenMaps = !!mapAddress;

  const handleCallCustomer = () => {
    if (!canCallCustomer) return;
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleOpenMaps = () => {
    if (!canOpenMaps) return;
    const encodedAddress = encodeURIComponent(mapAddress);
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      "_blank"
    );
  };

  return (
    <Shell
      title="Installer Detail"
      subtitle={`${invoiceDisplay} - ${job.customer || "Unknown Customer"}`}
    >
      <div className="space-y-6">
        {detailsError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            {detailsError}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-4">
              Job Information
            </div>
            <div className="space-y-3 text-slate-700">
              <div>
                <span className="font-semibold text-slate-800">Invoice:</span>{" "}
                {invoiceDisplay}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Status:</span>{" "}
                {job.status}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Customer:</span>{" "}
                {job.customer}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Contact:</span>{" "}
                {job.contact}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Phone:</span>{" "}
                {job.phone}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Address:</span>{" "}
                {[job.address, job.city, job.state, job.zip]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-4">
              Install Instructions
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700 whitespace-pre-wrap">
              {loadingDetails && !job?.lineItems?.length
                ? "Loading install instructions..."
                : installInstructions}
            </div>
          </Card>
        </div>

        {installCompletion ? (
          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-4">
              Install Report Summary
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 mb-4">
              This job already has an install report on file. Open the report editor to add missing notes, update photos, or revise the outcome without creating a duplicate history card.
            </div>

            <div className="space-y-3 text-slate-700">
              <div>
                <span className="font-semibold text-slate-800">Outcome:</span>{" "}
                {formatOutcome(installCompletion.outcome)}
              </div>

              <div>
                <span className="font-semibold text-slate-800">Saved:</span>{" "}
                {formatDateTime(installCompletion.completedAt)}
              </div>

              {installCompletion.completionNotes ? (
                <div className="whitespace-pre-wrap">
                  <span className="font-semibold text-slate-800">Notes:</span>{" "}
                  {installCompletion.completionNotes}
                </div>
              ) : null}

              {installCompletion.issuePriority &&
              installCompletion.issuePriority !== "none" ? (
                <div>
                  <span className="font-semibold text-slate-800">
                    Issue Priority:
                  </span>{" "}
                  {formatIssuePriority(installCompletion.issuePriority)}
                </div>
              ) : null}

              {installCompletion.issueSummary ? (
                <div className="whitespace-pre-wrap">
                  <span className="font-semibold text-slate-800">
                    Issue Summary:
                  </span>{" "}
                  {installCompletion.issueSummary}
                </div>
              ) : null}

              {installCompletion.recommendedNextStep ? (
                <div className="whitespace-pre-wrap">
                  <span className="font-semibold text-slate-800">
                    Recommended Next Step:
                  </span>{" "}
                  {installCompletion.recommendedNextStep}
                </div>
              ) : null}
            </div>

            {installCompletion.completionImages?.length ? (
              <div className="grid md:grid-cols-2 gap-5 mt-5">
                {installCompletion.completionImages.map(
                  (image: string, index: number) => (
                    <button
                      type="button"
                      key={`completion-summary-${index}`}
                      onClick={() => setActiveImage(image)}
                      className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50 text-left transition hover:shadow-md"
                    >
                      <img
                        decoding="async"
                        loading="lazy"
                        src={image}
                        alt={`Completion Summary ${index + 1}`}
                        className="w-full h-80 object-contain bg-white"
                      />
                    </button>
                  )
                )}
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-1">
            Line Item Photos & Details
          </div>
          <div className="text-sm text-slate-500 mb-4">
            Tap any image to view it larger.
          </div>

          {missingArtworkCount > 0 ? (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <div className="font-semibold text-base mb-1">
                Artwork Warning
              </div>
              <div className="text-sm leading-6">
                {missingArtworkCount} line item{missingArtworkCount === 1 ? "" : "s"} did not load artwork.
                Install artwork is expected to be attached in the imprint area before a job is moved to
                <span className="font-semibold"> Order Ready for Install</span>.
              </div>
            </div>
          ) : null}

          {loadingDetails && !lineItemSections.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600">
              Loading line item details...
            </div>
          ) : lineItemSections.length ? (
            <div className="space-y-5">
              {lineItemSections.map((entry: any, index: number) => (
                <div
                  key={`${job.id}-${entry.id || index}`}
                  className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50"
                >
                  {entry.imageData ? (
                    <button
                      type="button"
                      onClick={() => setActiveImage(entry.imageData)}
                      className="h-[28rem] w-full bg-white flex items-center justify-center p-4 transition hover:bg-slate-50"
                    >
                      <img
                        decoding="async"
                        loading="lazy"
                        src={entry.imageData}
                        alt={entry.heading || `Line Item ${index + 1}`}
                        className="max-w-full max-h-full object-contain rounded-xl"
                      />
                    </button>
                  ) : (
                    <div className="h-72 bg-gradient-to-br from-amber-100 to-slate-200 flex items-center justify-center text-center text-slate-600 px-6">
                      <div className="space-y-2">
                        <div className="font-semibold text-slate-700">
                          No install artwork loaded
                        </div>
                        <div className="text-sm leading-6">
                          Add the mockup in the imprint area in Printavo before moving this job to
                          Order Ready for Install.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-2 text-slate-700">
                    <div className="font-semibold text-slate-800 text-lg">
                      {entry.heading || `Line Item ${index + 1}`}
                    </div>
                    <div>
                      <span className="font-semibold">Line Item #:</span>{" "}
                      {entry.itemNumber || index + 1}
                    </div>
                    <div>
                      <span className="font-semibold">Quantity:</span>{" "}
                      {entry.quantity || "N/A"}
                    </div>
                    {entry.color ? (
                      <div>
                        <span className="font-semibold">Color:</span>{" "}
                        {entry.color}
                      </div>
                    ) : null}
                    {entry.sizeLabel ? (
                      <div>
                        <span className="font-semibold">Printavo Size:</span>{" "}
                        {entry.sizeLabel}
                      </div>
                    ) : null}
                    <div>
                      <span className="font-semibold">Final Size:</span>{" "}
                      {[entry.width, entry.height].filter(Boolean).join(" × ") ||
                        "See install instructions"}
                    </div>
                    {entry.description ? (
                      <div className="whitespace-pre-wrap">
                        <span className="font-semibold">Description:</span>{" "}
                        {entry.description}
                      </div>
                    ) : null}
                    {entry.otherDetails ? (
                      <div className="whitespace-pre-wrap">
                        <span className="font-semibold">Details:</span>{" "}
                        {entry.otherDetails}
                      </div>
                    ) : null}
                    {entry.notes ? (
                      <div className="text-sm text-slate-600 whitespace-pre-wrap">
                        <span className="font-semibold text-slate-700">
                          Notes:
                        </span>{" "}
                        {entry.notes}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
              No line item details were loaded for this job.
            </div>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <ActionButton
            onClick={() => {
              if (typeof setSelectedInstall === "function") {
                setSelectedInstall(job);
              }
              setScreen("installer-completion");
            }}
          >
            {installCompletion ? "Edit Install Report" : "Complete / Close Out Job"}
          </ActionButton>

          <ActionButton
            variant="secondary"
            onClick={handleCallCustomer}
            disabled={!canCallCustomer}
          >
            Call Customer
          </ActionButton>

          <ActionButton
            variant="secondary"
            onClick={handleOpenMaps}
            disabled={!canOpenMaps}
          >
            Open Maps
          </ActionButton>

          <ActionButton
            variant="secondary"
            onClick={() => setScreen("installer")}
          >
            Back to Installer List
          </ActionButton>
        </div>

        {activeImage ? (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setActiveImage("")}
          >
            <div
              className="relative max-w-6xl max-h-[90vh] w-full bg-white rounded-3xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setActiveImage("")}
                className="absolute top-3 right-3 z-10 rounded-full bg-black/70 text-white px-4 py-2 text-sm font-semibold"
              >
                Close
              </button>
              <div className="w-full h-[85vh] bg-slate-100 flex items-center justify-center p-4">
                <img
                  src={activeImage}
                  alt="Expanded view"
                  className="max-w-full max-h-full object-contain rounded-2xl"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
