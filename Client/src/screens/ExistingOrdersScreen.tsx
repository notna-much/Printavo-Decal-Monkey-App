import { Card, ActionButton, Shell } from "../components/ui";

function getInvoiceLine(order: any) {
  return `${
    order.printavoQuoteNumber ||
    order.invoiceNumber ||
    String(order.id || "").replace("#", "")
  } - ${order.nickname || order.customer || "Untitled"}`;
}

function getNameLine(order: any) {
  return (
    [order.firstName, order.lastName].filter(Boolean).join(" ") ||
    order.contact ||
    order.customer ||
    "Unknown Customer"
  );
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

export default function ExistingOrdersScreen({
  filteredExisting,
  setScreen,
  openMeasurementJobForMeasurement,
  openMeasurementJobForEdit,
  loadMeasurementJobs,
  loadingMeasurementJobs,
  measurementJobsMessage,
  measurementLastRefresh,
}: any) {
  const syncMeta = getSyncMeta(measurementLastRefresh);

  return (
    <Shell
      title="Offsite Measurements"
      subtitle="Quotes in OFFSITE - MEASUREMENT ready for field photos and measurements"
    >
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

        {measurementJobsMessage ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            {measurementJobsMessage}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="text-xl font-bold text-slate-800">
            Offsite Measurement Jobs
          </div>

          {filteredExisting.length === 0 ? (
            <Card className="p-5">
              <div className="text-slate-600">
                No offsite measurement jobs found.
              </div>
            </Card>
          ) : null}

          {filteredExisting.map((order: any) => (
            <Card key={order.id} className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="text-xl font-bold text-slate-800">
                    {getInvoiceLine(order)}
                  </div>
                  <div className="text-slate-700 font-medium">
                    {getNameLine(order)}
                  </div>
                  <div className="text-slate-500 text-sm mt-1">
                    {[order.address, order.city, order.state, order.zip]
                      .filter(Boolean)
                      .join(", ") || "No address available"}
                  </div>
                  {order.phone ? (
                    <div className="text-slate-500 text-sm">{order.phone}</div>
                  ) : null}

                  {order.modifiedAt ? (
                    <div className="text-sky-700 text-sm mt-2">
                      Last measurement update: {order.modifiedAt}
                    </div>
                  ) : null}

                  {(order.photoEntries || []).length ? (
                    <div className="text-amber-700 text-sm mt-2">
                      Saved measurement photos: {(order.photoEntries || []).length}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 flex-wrap items-center justify-end">
                  <div
                    className="rounded-md px-4 py-2 text-white font-semibold w-fit"
                    style={{ background: "#4B257A" }}
                  >
                    {order.status || "Quote"}
                  </div>

                  <ActionButton
                    variant="secondary"
                    onClick={() =>
                      openMeasurementJobForEdit({
                        ...order,
                        __source: "measurement",
                      })
                    }
                  >
                    View / Edit Order
                  </ActionButton>

                  <ActionButton
                    onClick={() =>
                      openMeasurementJobForMeasurement({
                        ...order,
                        __source: "measurement",
                      })
                    }
                  >
                    Take Measurements
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

          <ActionButton
            onClick={loadMeasurementJobs}
            disabled={loadingMeasurementJobs}
          >
            {loadingMeasurementJobs ? "Refreshing..." : "Refresh Jobs"}
          </ActionButton>
        </div>
      </div>
    </Shell>
  );
}
