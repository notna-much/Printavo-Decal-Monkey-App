import { useMemo, useState } from "react";
import { Card, ActionButton, Shell } from "../components/ui";
import { APP_VERSION } from "../config/version";

function getMeaningfulDraftDataCount(draftData: any) {
  if (!draftData || typeof draftData !== "object") return 0;

  let count = 0;

  const ignoreKeys = new Set([
    "customerOwner",
    "logoStatus",
    "mockupInstructions",
    "installSameAsCustomer",
    "photoEntries",
    "productTypes",
    "printedDecalFinish",
    "wallGraphicType",
    "wallGraphicFinish",
    "otherProductType",
  ]);

  Object.entries(draftData).forEach(([key, value]) => {
    if (ignoreKeys.has(key)) return;

    if (typeof value === "string" && value.trim() !== "") count += 1;
    if (typeof value === "boolean" && value === true) count += 1;
    if (Array.isArray(value) && value.length > 0) count += 1;
  });

  if (
    Array.isArray(draftData.productTypes) &&
    draftData.productTypes.length > 0
  ) {
    count += 1;
  }

  if (Array.isArray(draftData.photoEntries)) {
    const hasRealPhotoEntry = draftData.photoEntries.some((entry: any) =>
      [
        entry?.name,
        entry?.width,
        entry?.height,
        entry?.quantity,
        entry?.imageData,
        entry?.annotatedImageData,
        entry?.markupNotes,
      ].some((field) => String(field || "").trim() !== "")
    );
    if (hasRealPhotoEntry) count += 1;
  }

  return count;
}

export default function HomeScreen({
  setScreen,
  setSelectedInstall,
  draftStatus,
  currentUser,
  deviceName,
  submitState,
  savedDrafts,
  resumeDraft,
  deleteDraft,
  toggleFavoriteDraft,
  startFreshOrder,
}: any) {
  const [resumeModalOpen, setResumeModalOpen] = useState(false);

  const validDrafts = useMemo(() => {
    return (savedDrafts || [])
      .filter((draft: any) => getMeaningfulDraftDataCount(draft?.data) > 0)
      .sort((a: any, b: any) => {
        if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [savedDrafts]);

  const hasActiveDraft = validDrafts.length > 0;
  const newestDraft = validDrafts?.[0] || null;

  const handleNewOrderClick = () => {
    if (hasActiveDraft && newestDraft) {
      setResumeModalOpen(true);
      return;
    }

    startFreshOrder();
  };

  return (
    <>
      <Shell
        title="Outside Sales"
        subtitle="Field measurement and quote intake for iPad"
      >
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 p-6 bg-slate-50">
              <img
                src="/logo.png"
                alt="Decal Monkey logo"
                className="w-full h-auto object-contain"
              />
            </div>

            <div className="text-slate-600 text-lg">
              Fast, guided order capture for outside sales reps.
            </div>
          </div>

          <div className="space-y-4">
            <ActionButton
              className="w-full text-2xl"
              onClick={handleNewOrderClick}
            >
              New Order
            </ActionButton>

            <ActionButton
              className="w-full text-2xl"
              onClick={() => setScreen("existing")}
            >
              Measurements
            </ActionButton>

            <ActionButton
              className="w-full text-2xl"
              onClick={() => {
                setSelectedInstall(null);
                setScreen("installer");
              }}
            >
              Installation
            </ActionButton>

            <ActionButton
              className="w-full text-2xl"
              onClick={() => setScreen("inquiry")}
            >
              Inquiry
            </ActionButton>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <ActionButton
                variant="secondary"
                onClick={() => setScreen("history")}
              >
                Submission History
              </ActionButton>

              <ActionButton
                variant="secondary"
                onClick={() => setScreen("settings")}
              >
                Settings
              </ActionButton>
            </div>

            <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200 text-slate-600 text-sm space-y-2">
              <div className="font-semibold text-slate-800">{draftStatus}</div>

              <div>
                Logged in as{" "}
                <span className="font-semibold text-slate-800">
                  {currentUser}
                </span>{" "}
                on{" "}
                <span className="font-semibold text-slate-800">
                  {deviceName}
                </span>
              </div>

              {submitState?.message ? (
                <div className="text-slate-700">{submitState.message}</div>
              ) : null}

              <div className="text-xs text-slate-400 pt-1">
                Version {APP_VERSION}
              </div>
            </div>

            {validDrafts.length > 0 ? (
              <Card className="p-5">
                <div className="text-lg font-bold text-slate-800 mb-3">
                  Saved Drafts
                </div>

                <div className="space-y-3">
                  {validDrafts.map((draft: any) => (
                    <div
                      key={draft.id}
                      className="rounded-2xl border border-slate-200 p-3 bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleFavoriteDraft(draft.id)}
                              className={`text-lg leading-none ${
                                draft.isFavorite
                                  ? "text-yellow-500"
                                  : "text-slate-400"
                              }`}
                              title={
                                draft.isFavorite
                                  ? "Unfavorite draft"
                                  : "Favorite draft"
                              }
                            >
                              {draft.isFavorite ? "★" : "☆"}
                            </button>
                            <span>{draft.title}</span>
                          </div>
                          <div className="text-sm text-slate-500">
                            {draft.updatedAt}
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap justify-end">
                          <ActionButton
                            variant="secondary"
                            onClick={() => deleteDraft(draft.id)}
                          >
                            Delete
                          </ActionButton>
                          <ActionButton onClick={() => resumeDraft(draft)}>
                            Resume
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </Shell>

      {resumeModalOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200">
            <div className="p-6">
              <div className="text-2xl font-bold text-slate-800">
                Resume Draft?
              </div>

              <div className="mt-3 text-slate-600">
                You already have a saved draft in progress.
                {newestDraft ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-800">
                      {newestDraft.isFavorite ? "★ " : ""}
                      {newestDraft.title}
                    </div>
                    <div className="text-sm text-slate-500">
                      {newestDraft.updatedAt}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex gap-3 justify-end flex-wrap">
                <ActionButton
                  variant="secondary"
                  onClick={() => setResumeModalOpen(false)}
                >
                  Cancel
                </ActionButton>

                <ActionButton
                  variant="secondary"
                  onClick={() => {
                    setResumeModalOpen(false);
                    startFreshOrder();
                  }}
                >
                  Start New
                </ActionButton>

                <ActionButton
                  onClick={() => {
                    setResumeModalOpen(false);
                    if (newestDraft) {
                      resumeDraft(newestDraft);
                    } else {
                      startFreshOrder();
                    }
                  }}
                >
                  Resume Draft
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
