import { Card, ActionButton, Shell } from "../components/ui";

function buildQuoteNumber(order: any) {
  return (
    order?.printavoQuoteNumber ||
    order?.invoiceNumber ||
    String(order?.id || "").replace("#", "")
  );
}

function buildCustomerName(order: any) {
  return (
    [order?.firstName, order?.lastName].filter(Boolean).join(" ").trim() ||
    order?.customer ||
    order?.company ||
    "Unknown Customer"
  );
}

function buildInstallAddressText(order: any) {
  if (!order?.installNeeded) return "No installation needed";

  if (order?.installSameAsCustomer) {
    return [order?.address, order?.city, order?.state, order?.zip]
      .filter(Boolean)
      .join(", ");
  }

  return [
    order?.installAddress,
    order?.installCity,
    order?.installState,
    order?.installZip,
  ]
    .filter(Boolean)
    .join(", ");
}

function getLineItemTitle(item: any, index: number) {
  return item?.category || `Line Item ${index + 1}`;
}

export default function SubmissionDetailScreen({
  order,
  setScreen,
  retrySyncOrder,
  submitState,
  openSubmittedOrderForEdit,
}: any) {
  if (!order) return null;

  const fromExisting = order.__source === "existing";
  const quoteNumber = buildQuoteNumber(order);
  const installAddressText = buildInstallAddressText(order);
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];

  return (
    <Shell
      title="Order Detail"
      subtitle={`${buildCustomerName(order)} #${quoteNumber}`}
    >
      <div className="space-y-6">
        {submitState?.message ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
            {submitState.message}
          </div>
        ) : null}

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-3">
            Submission Info
          </div>

          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Quote Number:</span> #
              {quoteNumber}
            </div>

            <div>
              <span className="font-semibold">App Record ID:</span> {order.id}
            </div>

            {order.printavoQuoteId ? (
              <div>
                <span className="font-semibold">Printavo ID:</span>{" "}
                {order.printavoQuoteId}
              </div>
            ) : null}

            <div>
              <span className="font-semibold">Status:</span> {order.status}
            </div>

            <div>
              <span className="font-semibold">
                {fromExisting ? "Owner:" : "Submitted By:"}
              </span>{" "}
              {order.by || order.owner || order.customerOwner || "N/A"}
            </div>

            {order.company ? (
              <div>
                <span className="font-semibold">Company:</span> {order.company}
              </div>
            ) : null}

            {order.printavoPublicUrl ? (
              <div>
                <span className="font-semibold">Printavo Quote:</span>{" "}
                <a
                  href={order.printavoPublicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-700 underline"
                >
                  Open Quote
                </a>
              </div>
            ) : null}

            {order.wasModified ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 mt-3">
                <div className="font-semibold">
                  {fromExisting ? "Updated Order" : "Modified Order"}
                </div>
                <div className="text-sm mt-1">
                  {order.modificationNote ||
                    order.note ||
                    "This order was modified and saved."}
                </div>
                {order.modifiedAt ? (
                  <div className="text-sm mt-1">
                    Last modified: {order.modifiedAt}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-3">
            Contact Info
          </div>
          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Name:</span>{" "}
              {buildCustomerName(order)}
            </div>
            <div>
              <span className="font-semibold">Phone:</span>{" "}
              {order.phone || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Email:</span>{" "}
              {order.email || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Customer Address:</span>{" "}
              {[order.address, order.city, order.state, order.zip]
                .filter(Boolean)
                .join(", ") || "N/A"}
            </div>
          </div>
        </Card>

        <Card className="p-5 border-2 border-slate-300 bg-slate-50">
          <div className="text-xl font-bold text-slate-800 mb-3">
            Install Details
          </div>

          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Installation Needed:</span>{" "}
              {order.installNeeded ? "Yes" : "No"}
            </div>

            {order.installNeeded ? (
              <>
                <div>
                  <span className="font-semibold">
                    Same as Customer Address:
                  </span>{" "}
                  {order.installSameAsCustomer ? "Yes" : "No"}
                </div>

                <div>
                  <span className="font-semibold">Install Address:</span>{" "}
                  {installAddressText || "N/A"}
                </div>
              </>
            ) : null}

            <div className="text-sm text-slate-600 pt-2">
              CSR should use this section to determine travel charges, install
              fees, scheduling, and any site-specific planning before finalizing
              the quote.
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-3">
              Order Setup
            </div>

            <div className="space-y-2 text-slate-700">
              <div>
                <span className="font-semibold">Owner:</span>{" "}
                {order.customerOwner || order.owner || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Making:</span>{" "}
                {(order.productTypes || []).join(", ") || "None selected"}
              </div>

              <div>
                <span className="font-semibold">Location Type:</span>{" "}
                {order.locationType || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Surface:</span>{" "}
                {order.surfaceType === "Other" && order.surfaceOther
                  ? order.surfaceOther
                  : order.surfaceType || "N/A"}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-3">
              Artwork & Design
            </div>

            <div className="space-y-2 text-slate-700">
              <div>
                <span className="font-semibold">Logo Status:</span>{" "}
                {order.logoStatus || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Color Notes:</span>{" "}
                {order.colorNotes || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Artwork Status:</span>{" "}
                {order.artworkStatus || "N/A"}
              </div>

              <div>
                <span className="font-semibold">Auto Artwork Request:</span>{" "}
                {order.sendArtworkRequest ? "Yes" : "No"}
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-3">
            Line Items
          </div>

          {lineItems.length ? (
            <div className="space-y-3">
              {lineItems.map((item: any, index: number) => (
                <div
                  key={item.id || `${item.category || "line-item"}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="font-semibold text-slate-800 text-lg">
                    {getLineItemTitle(item, index)}
                  </div>

                  <div className="text-slate-700 mt-1">
                    <span className="font-semibold">Quantity:</span>{" "}
                    {item.quantity || "N/A"}
                  </div>

                  {item.color ? (
                    <div className="text-slate-700 mt-1">
                      <span className="font-semibold">Color:</span> {item.color}
                    </div>
                  ) : null}

                  {item.finish ? (
                    <div className="text-slate-700 mt-1">
                      <span className="font-semibold">Finish:</span>{" "}
                      {item.finish}
                    </div>
                  ) : null}

                  {item.description ? (
                    <div className="text-slate-700 mt-1 whitespace-pre-wrap">
                      <span className="font-semibold">Description:</span>{" "}
                      {item.description}
                    </div>
                  ) : null}

                  {item.otherDetails ? (
                    <div className="text-slate-700 mt-1 whitespace-pre-wrap">
                      <span className="font-semibold">Other Details:</span>{" "}
                      {item.otherDetails}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-700">No line items added.</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-3">
            Mock Up Instructions
          </div>
          <div className="text-slate-700 whitespace-pre-wrap">
            {order.mockupInstructions || "None entered"}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-3">
            Additional Customer Inquiries
          </div>
          <div className="text-slate-700 whitespace-pre-wrap">
            {order.additionalInquiries || "None entered"}
          </div>
        </Card>

        {!!order.photoEntries?.length ? (
          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-3">
              Photo Entries
            </div>

            <div className="space-y-4">
              {order.photoEntries.map((entry: any, index: number) => {
                const entryImage =
                  entry.imageData ||
                  entry.uploadedPhotoUrl ||
                  entry.photoUrl ||
                  "";

                return (
                  <div
                    key={entry.id || `photo-entry-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="font-semibold text-slate-800">
                      {entry.name || `Location ${index + 1}`}
                    </div>

                    {entryImage ? (
                      <img
                        src={entryImage}
                        alt={entry.name || `Location ${index + 1}`}
                        className="w-full max-w-xl h-56 object-cover rounded-xl border border-slate-200 mt-3"
                      />
                    ) : null}

                    <div className="text-slate-700 mt-3">
                      <span className="font-semibold">Size:</span>{" "}
                      {[entry.width, entry.height].filter(Boolean).join(" × ") ||
                        "N/A"}
                    </div>

                    <div className="text-slate-700 mt-1">
                      <span className="font-semibold">Quantity:</span>{" "}
                      {entry.quantity || "N/A"}
                    </div>

                    {entry.markupNotes ? (
                      <div className="text-slate-700 mt-1 whitespace-pre-wrap">
                        <span className="font-semibold">Notes:</span>{" "}
                        {entry.markupNotes}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}


        {order.offlineQueued ? (
          <Card className="p-5 border-2 border-amber-300 bg-amber-50">
            <div className="text-xl font-bold text-amber-900 mb-2">
              Saved Offline
            </div>
            <div className="text-amber-900">
              This order was saved locally while the device was offline. It is safe in
              Submission History as Pending Sync. Reconnect to the internet and tap
              <span className="font-semibold"> Sync Now </span>
              to send it to Printavo.
            </div>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!fromExisting ? (
            <ActionButton onClick={() => openSubmittedOrderForEdit(order)}>
              Edit Order
            </ActionButton>
          ) : (
            <ActionButton onClick={() => openSubmittedOrderForEdit(order)}>
              Edit Existing Order
            </ActionButton>
          )}

          {String(order.status || "").toLowerCase() === "pending sync" ? (
            <ActionButton
              variant="secondary"
              onClick={() => retrySyncOrder(order)}
              disabled={!!submitState?.loading}
            >
              {submitState?.loading ? "Syncing..." : "Sync Now"}
            </ActionButton>
          ) : null}

          <ActionButton
            variant="secondary"
            onClick={() => setScreen("history")}
          >
            Back to History
          </ActionButton>
        </div>
      </div>
    </Shell>
  );
}
