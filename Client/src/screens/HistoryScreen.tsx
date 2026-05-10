import { useState } from "react";
import { Card, ActionButton, Shell } from "../components/ui";

const green = "#7BC043";
const amber = "#F59E0B";
const purple = "#4B257A";
const red = "#DC2626";

function getDisplayQuoteNumber(item: any) {
  return (
    item.printavoQuoteNumber ||
    item.invoiceNumber ||
    String(item.id || "").replace("#", "")
  );
}

function getInvoiceLine(item: any) {
  const invoice = getDisplayQuoteNumber(item);
  const nickname = item.nickname || item.company || item.customer || "Untitled";
  return `${invoice} - ${nickname}`;
}

function getNameLine(item: any) {
  const fullName = [item.firstName, item.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || item.customer || "Unknown Customer";
}

function formatCompletedOutcome(outcome: string) {
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

function isInstallIssue(item: any) {
  const status = String(item?.status || "")
    .trim()
    .toUpperCase();
  const outcome = String(item?.installCompletion?.outcome || "").trim();

  return status === "INSTALL ISSUE" || outcome === "unable_to_complete";
}

function getCompletedInstallBadge(item: any) {
  const status = String(item?.status || "").trim();
  if (status) return status;
  return formatCompletedOutcome(item?.installCompletion?.outcome || "");
}

function getCompletedInstallBadgeColor(item: any) {
  const status = String(item?.status || "")
    .trim()
    .toUpperCase();
  const outcome = String(item?.installCompletion?.outcome || "").trim();

  if (status === "INSTALLED") return green;
  if (status === "INSTALL ISSUE") return red;
  if (outcome === "unable_to_complete") return red;
  return purple;
}

export default function HistoryScreen({
  submittedOrders,
  installHistorySnapshots,
  setScreen,
  setSelectedOrder,
  setSelectedInstall,
  setLastCompletedInstall,
  retrySyncOrder,
  clearSubmittedOrderHistory,
  submitState,
}: any) {
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  const completedInstalls = (installHistorySnapshots || []).sort(
    (a: any, b: any) => {
      const aTime = new Date(
        a?.installCompletion?.completedAt || a?.snapshotCreatedAt || 0
      ).getTime();
      const bTime = new Date(
        b?.installCompletion?.completedAt || b?.snapshotCreatedAt || 0
      ).getTime();
      return bTime - aTime;
    }
  );

  const orderSubmissions = (submittedOrders || []).filter(
    (item: any) => !item.installCompletion
  );

  return (
    <Shell
      title="Submission History"
      subtitle="Track orders sent from iPad and completed install reports"
    >
      <div className="space-y-6">
        {submitState?.message ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            {submitState.message}
          </div>
        ) : null}

        {completedInstalls.length > 0 ? (
          <div className="space-y-4">
            <div className="text-xl font-bold text-slate-800">
              Completed Installs
            </div>

            {completedInstalls.map((item: any) => (
              <Card
                key={`completed-${item.id}-${item.snapshotCreatedAt || ""}`}
                className="p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-xl font-bold text-slate-800">
                      {getInvoiceLine(item)}
                    </div>
                    <div className="text-slate-700 font-medium">
                      {getNameLine(item)}
                    </div>
                    <div className="text-slate-500 text-sm">
                      {item.installCompletion?.completedAt
                        ? `Completed ${new Date(
                            item.installCompletion.completedAt
                          ).toLocaleString()}`
                        : "Install report submitted"}
                    </div>

                    {item.installCompletion?.issuePriority &&
                    item.installCompletion.issuePriority !== "none" ? (
                      <div className="text-sm text-amber-700 mt-2">
                        Priority: {String(item.installCompletion.issuePriority)
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </div>
                    ) : null}

                    {item.installCompletion?.issueSummary ? (
                      <div className="text-sm text-slate-600 mt-2">
                        {item.installCompletion.issueSummary}
                      </div>
                    ) : null}

                    {item.installCompletion?.printavoStatusUpdateMessage ? (
                      <div className="text-sm text-slate-600 mt-2">
                        {item.installCompletion.printavoStatusUpdateMessage}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className="rounded-md px-4 py-2 text-white font-semibold w-fit"
                      style={{
                        background: getCompletedInstallBadgeColor(item),
                      }}
                    >
                      {getCompletedInstallBadge(item)}
                    </div>

                    <ActionButton
                      variant="secondary"
                      onClick={() => {
                        if (typeof setSelectedInstall === "function") {
                          setSelectedInstall(item);
                        }
                        if (typeof setLastCompletedInstall === "function") {
                          setLastCompletedInstall(item);
                        }
                        setScreen("installer-detail");
                      }}
                    >
                      Open Job
                    </ActionButton>

                    <ActionButton
                      onClick={() => {
                        if (typeof setSelectedInstall === "function") {
                          setSelectedInstall(item);
                        }
                        setScreen("installer-completion");
                      }}
                    >
                      Edit Report
                    </ActionButton>

                    {isInstallIssue(item) ? (
                      <ActionButton
                        variant="secondary"
                        onClick={() => {
                          if (typeof setSelectedInstall === "function") {
                            setSelectedInstall({
                              ...item,
                              installCompletion: null,
                            });
                          }
                          setScreen("installer-completion");
                        }}
                      >
                        Reattempt Install
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="text-xl font-bold text-slate-800">
            Order Submissions
          </div>

          {orderSubmissions.length === 0 ? (
            <Card className="p-5">
              <div className="text-slate-600">No order submissions yet.</div>
            </Card>
          ) : null}

          {orderSubmissions.map((item: any) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div
                  className="cursor-pointer flex-1"
                  onClick={() => {
                    setSelectedOrder(item);
                    setScreen("submission-detail");
                  }}
                >
                  <div className="text-xl font-bold text-slate-800">
                    {getInvoiceLine(item)}
                  </div>
                  <div className="text-slate-700 font-medium">
                    {getNameLine(item)}
                  </div>
                  <div className="text-slate-500 text-sm">
                    Sent by {item.by}
                  </div>

                  {item.printavoQuoteId ? (
                    <div className="text-sm text-slate-500 mt-1">
                      Printavo ID: {item.printavoQuoteId}
                    </div>
                  ) : null}

                  {item.wasModified ? (
                    <div className="text-sm text-sky-700 mt-2">
                      Modified and resubmitted
                      {item.modifiedAt
                        ? ` on ${new Date(item.modifiedAt).toLocaleString()}`
                        : ""}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className="rounded-full px-4 py-2 text-white font-semibold w-fit"
                    style={{
                      background:
                        item.status === "Pending Sync" ? amber : green,
                    }}
                  >
                    {item.status}
                  </div>

                  {item.status === "Pending Sync" ? (
                    <ActionButton
                      variant="secondary"
                      onClick={() => retrySyncOrder(item)}
                      disabled={submitState?.loading}
                    >
                      Retry Sync
                    </ActionButton>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm text-slate-500">
              Clear History removes sent items and completed installs, but keeps Pending Sync jobs safe.
            </div>

            <ActionButton
              variant="secondary"
              onClick={() => setShowClearHistoryConfirm(true)}
            >
              Clear Sent History
            </ActionButton>
          </div>

          <ActionButton variant="secondary" onClick={() => setScreen("home")}>
            Back to Home
          </ActionButton>
        </div>
      </div>

      {showClearHistoryConfirm ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div className="text-2xl font-bold text-slate-800">
                Clear Sent History?
              </div>
              <div className="text-slate-600 mt-2">
                This will remove completed installs and sent order history from this screen.
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                Pending Sync jobs will stay safe and will not be removed.
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                Use this when you want to clean up old completed history without risking unsynced jobs.
              </div>

              <div className="flex items-center justify-end gap-3 flex-wrap pt-2">
                <ActionButton
                  variant="secondary"
                  onClick={() => setShowClearHistoryConfirm(false)}
                >
                  Cancel
                </ActionButton>

                <ActionButton
                  onClick={() => {
                    if (typeof clearSubmittedOrderHistory === "function") {
                      clearSubmittedOrderHistory();
                    }
                    setShowClearHistoryConfirm(false);
                  }}
                >
                  Yes, Clear Sent History
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}