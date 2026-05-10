import { Card, ActionButton, Shell } from "../components/ui";

function getInvoiceLine(item: any) {
  const invoice =
    item.printavoQuoteNumber ||
    item.invoiceNumber ||
    String(item.id || "").replace("#", "");
  const nickname = item.nickname || item.company || item.customer || "Untitled";
  return `${invoice} - ${nickname}`;
}

function getNameLine(item: any) {
  const fullName = [item.firstName, item.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || item.customer || item.company || "Unknown Customer";
}

function isReadyForInstaller(item: any) {
  const status = String(item?.status || "")
    .trim()
    .toLowerCase();

  return status === "order ready for install";
}

function getSyncMeta(lastRefresh: string) {
  if (!lastRefresh) {
    return {
      label: "Not Synced",
      color: "#64748B",
      detail: "No refresh has been run yet.",
    };
  }

  const ageMs = Date.now() - new Date(lastRefresh).getTime();
  const staleAfterMs = 1000 * 60 * 10;

  if (ageMs > staleAfterMs) {
    return {
      label: "Stale",
      color: "#F59E0B",
      detail: `Last synced ${new Date(lastRefresh).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`,
    };
  }

  return {
    label: "Synced",
    color: "#7BC043",
    detail: `Last synced ${new Date(lastRefresh).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  };
}

export default function InstallerScreen({
  installs,
  setSelectedInstall,
  setScreen,
  loadNewJobs,
  loadingJobs,
  loadJobsMessage,
  installerLastRefresh,
}: any) {
  const syncMeta = getSyncMeta(installerLastRefresh);

  const activeInstalls = (installs || [])
    .filter((item: any) => isReadyForInstaller(item))
    .sort((a: any, b: any) => {
      const aReady =
        String(a.status || "").toLowerCase() === "order ready for install";
      const bReady =
        String(b.status || "").toLowerCase() === "order ready for install";
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return 0;
    });

  return (
    <Shell title="Installer" subtitle="Active install-ready jobs">
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="rounded-full px-3 py-1 text-white text-sm font-semibold"
            style={{ background: syncMeta.color }}
          >
            {syncMeta.label}
          </div>
          <div className="text-sm text-slate-500">{syncMeta.detail}</div>
        </div>

        {loadJobsMessage ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            {loadJobsMessage}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="text-xl font-bold text-slate-800">Active Jobs</div>

          {activeInstalls.length === 0 ? (
            <Card className="p-5">
              <div className="text-slate-600">
                No active install-ready jobs loaded.
              </div>
            </Card>
          ) : null}

          {activeInstalls.map((item: any) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="text-xl font-bold text-slate-800">
                    {getInvoiceLine(item)}
                  </div>
                  <div className="text-slate-700 font-medium">
                    {getNameLine(item)}
                  </div>
                  <div className="text-slate-500 text-sm mt-1">
                    {[item.address, item.city, item.state, item.zip]
                      .filter(Boolean)
                      .join(", ") || "No address available"}
                  </div>
                  {item.phone ? (
                    <div className="text-slate-500 text-sm">{item.phone}</div>
                  ) : null}

                  {item.installCompletion?.completedAt ? (
                    <div className="text-amber-700 text-sm mt-2">
                      Previous install report saved{" "}
                      {new Date(
                        item.installCompletion.completedAt
                      ).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className="rounded-md px-4 py-2 text-white font-semibold w-fit"
                    style={{ background: "#4B257A" }}
                  >
                    {item.status || "Job"}
                  </div>

                  <ActionButton
                    onClick={() => {
                      setSelectedInstall(item);
                      setScreen("installer-detail");
                    }}
                  >
                    Open Job
                  </ActionButton>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="pt-4 flex items-center justify-between gap-4 flex-wrap">
          <ActionButton variant="secondary" onClick={() => setScreen("home")}>
            Back to Home
          </ActionButton>

          <ActionButton onClick={loadNewJobs} disabled={loadingJobs}>
            {loadingJobs ? "Refreshing..." : "Refresh Jobs"}
          </ActionButton>
        </div>
      </div>
    </Shell>
  );
}