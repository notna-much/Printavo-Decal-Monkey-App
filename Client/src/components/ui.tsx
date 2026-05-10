const green = "#7BC043";
const purple = "#4B257A";

export const Card = ({ children, className = "", onClick }: any) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-3xl shadow-lg border border-slate-200 ${className}`}
  >
    {children}
  </div>
);

export const Header = ({ title, subtitle }: any) => (
  <div
    className="px-6 py-5 rounded-t-3xl text-white"
    style={{ background: purple }}
  >
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-2xl font-bold">{title}</div>
        {subtitle ? (
          <div className="text-sm text-white/80 mt-1">{subtitle}</div>
        ) : null}
      </div>

      <div className="flex items-center justify-center">
        <img
          src="/dm-fieldapp-logo.png"
          alt="DM Field App"
          className="h-14 w-14 object-contain"
        />
      </div>
    </div>
  </div>
);

export const ActionButton = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
}: any) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`rounded-2xl px-5 py-4 font-semibold shadow transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    style={{
      background: variant === "primary" ? green : "white",
      color: variant === "primary" ? "white" : purple,
      border: variant === "primary" ? "none" : `2px solid ${purple}`,
    }}
  >
    {children}
  </button>
);

export const Tile = ({ label, active, onClick }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-2xl border p-4 text-left transition ${
      active ? "shadow-md" : ""
    }`}
    style={{
      borderColor: active ? green : "#CBD5E1",
      background: active ? "#F0FAE8" : "white",
    }}
  >
    <div className="font-semibold text-slate-800">{label}</div>
  </button>
);

export const Progress = ({ step, totalSteps, steps }: any) => (
  <div className="px-6 pt-5">
    <div className="flex justify-between text-sm text-slate-500 mb-2 gap-3">
      <span>
        Step {step} of {totalSteps}
      </span>
      <span className="text-right">{steps[step - 1]}</span>
    </div>
    <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          background: green,
          width: `${(step / totalSteps) * 100}%`,
        }}
      />
    </div>
  </div>
);

export const Shell = ({
  title,
  subtitle,
  children,
  showProgress = false,
  step,
  totalSteps,
  steps,
  showWatermark = true,
}: any) => (
  <div
    className="min-h-screen relative overflow-x-hidden"
    style={{
      background: "transparent",
    }}
  >
    {showWatermark ? (
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'url("/monkey-head-watermark.png")',
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "55%",
        }}
      />
    ) : null}

    <div className="relative z-10 max-w-5xl mx-auto p-4 md:p-6">
      <Card className="overflow-visible">
        <Header title={title} subtitle={subtitle} />

        {showProgress ? (
          <Progress step={step} totalSteps={totalSteps} steps={steps} />
        ) : null}

        <div className="p-6 overflow-visible">
          {children}
        </div>
      </Card>
    </div>
  </div>
);
