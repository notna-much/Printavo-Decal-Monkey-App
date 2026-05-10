import { useEffect } from "react";
import { Card, ActionButton, Shell } from "../components/ui";

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

function ConfettiBurst() {
  useEffect(() => {
    const container = document.getElementById("dm-install-confetti");
    if (!container) return;

    container.innerHTML = "";

    const pieces = Array.from({ length: 80 }).map((_, index) => {
      const el = document.createElement("div");
      el.className = "dm-confetti-piece";
      el.style.left = `${Math.random() * 100}%`;
      el.style.animationDelay = `${Math.random() * 0.5}s`;
      el.style.animationDuration = `${2.4 + Math.random() * 1.8}s`;
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.style.opacity = "0.95";
      el.style.top = `${-10 - Math.random() * 20}px`;
      el.style.width = `${8 + Math.random() * 8}px`;
      el.style.height = `${10 + Math.random() * 12}px`;
      const palette = ["#7BC043", "#4B257A", "#F59E0B", "#0EA5E9", "#EF4444"];
      el.style.background = palette[index % palette.length];
      container.appendChild(el);
      return el;
    });

    return () => {
      pieces.forEach((piece) => piece.remove());
    };
  }, []);

  return (
    <>
      <style>{`
        #dm-install-confetti {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 9999;
        }

        .dm-confetti-piece {
          position: absolute;
          border-radius: 3px;
          animation-name: dmConfettiFall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }

        @keyframes dmConfettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(540deg);
            opacity: 0;
          }
        }
      `}</style>
      <div id="dm-install-confetti" />
    </>
  );
}

export default function InstallerCompleteSuccessScreen({
  lastCompletedInstall,
  setScreen,
}: any) {
  if (!lastCompletedInstall) return null;

  const completion = lastCompletedInstall.installCompletion || null;
  const contactLine =
    lastCompletedInstall.contact ||
    [lastCompletedInstall.firstName, lastCompletedInstall.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    lastCompletedInstall.customer ||
    "N/A";
  const addressLine = [
    lastCompletedInstall.address,
    lastCompletedInstall.city,
    lastCompletedInstall.state,
    lastCompletedInstall.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const showConfetti = completion?.outcome === "completed_successfully";

  return (
    <Shell
      title="Completed Install"
      subtitle="Install report submitted and saved"
    >
      {showConfetti ? <ConfettiBurst /> : null}

      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="p-6 text-center space-y-4">
          <div className="text-3xl font-bold text-green-600">
            ✔ Install Report Submitted
          </div>

          <div className="text-slate-700 text-lg">
            {lastCompletedInstall?.printavoQuoteNumber ||
              lastCompletedInstall?.invoiceNumber ||
              lastCompletedInstall?.id}{" "}
            — {lastCompletedInstall?.customer || lastCompletedInstall?.company}
          </div>

          <div className="text-slate-500">
            The job has been removed from the active install queue and saved to
            history.
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xl font-bold text-slate-800 mb-3">Job Info</div>
          <div className="space-y-2 text-slate-700">
            <div>
              <span className="font-semibold">Customer:</span>{" "}
              {lastCompletedInstall.customer || lastCompletedInstall.company}
            </div>
            <div>
              <span className="font-semibold">Invoice:</span>{" "}
              {lastCompletedInstall.printavoQuoteNumber ||
                lastCompletedInstall.invoiceNumber ||
                lastCompletedInstall.id}
            </div>
            <div>
              <span className="font-semibold">Contact:</span> {contactLine}
            </div>
            <div>
              <span className="font-semibold">Phone:</span>{" "}
              {lastCompletedInstall.phone || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Address:</span>{" "}
              {addressLine || "N/A"}
            </div>
          </div>
        </Card>

        {completion ? (
          <Card className="p-5">
            <div className="text-xl font-bold text-slate-800 mb-3">
              Completion Report
            </div>
            <div className="space-y-3 text-slate-700">
              <div>
                <span className="font-semibold">Outcome:</span>{" "}
                {formatOutcome(completion.outcome)}
              </div>

              {completion.completedAt ? (
                <div>
                  <span className="font-semibold">Completed At:</span>{" "}
                  {new Date(completion.completedAt).toLocaleString()}
                </div>
              ) : null}

              {completion.completionNotes ? (
                <div className="whitespace-pre-wrap">
                  <span className="font-semibold">Completion Notes:</span>{" "}
                  {completion.completionNotes}
                </div>
              ) : null}

              {completion.issuePriority &&
              completion.issuePriority !== "none" ? (
                <div>
                  <span className="font-semibold">Issue Priority:</span>{" "}
                  {completion.issuePriority}
                </div>
              ) : null}

              {completion.issueSummary ? (
                <div className="whitespace-pre-wrap">
                  <span className="font-semibold">Issue Summary:</span>{" "}
                  {completion.issueSummary}
                </div>
              ) : null}

              {completion.recommendedNextStep ? (
                <div className="whitespace-pre-wrap">
                  <span className="font-semibold">Recommended Next Step:</span>{" "}
                  {completion.recommendedNextStep}
                </div>
              ) : null}
            </div>

            {completion.completionImages?.length ? (
              <div className="grid md:grid-cols-2 gap-5 mt-5">
                {completion.completionImages.map(
                  (image: string, index: number) => (
                    <div
                      key={`completed-image-${index}`}
                      className="rounded-3xl overflow-hidden border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={image}
                        alt={`Completed Install ${index + 1}`}
                        className="w-full h-56 object-cover"
                      />
                    </div>
                  )
                )}
              </div>
            ) : null}
          </Card>
        ) : null}

        <div className="flex flex-col md:flex-row gap-4">
          <ActionButton
            className="w-full text-lg"
            onClick={() => setScreen("home")}
          >
            Go Home
          </ActionButton>

          <ActionButton
            variant="secondary"
            className="w-full text-lg"
            onClick={() => setScreen("installer")}
          >
            Find Next Install
          </ActionButton>

          <ActionButton
            variant="secondary"
            className="w-full text-lg"
            onClick={() => setScreen("history")}
          >
            Back to History
          </ActionButton>
        </div>
      </div>
    </Shell>
  );
}
