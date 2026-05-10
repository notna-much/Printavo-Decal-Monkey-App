import React, { useState } from "react";
import { ActionButton, Card, Shell } from "../components/ui";
import { APP_VERSION } from "../config/version";

const purple = "#4B257A";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58A2 2 0 0013.42 13.42" />
        <path d="M9.88 5.09A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 8a11.83 11.83 0 01-4.16 5.94" />
        <path d="M6.61 6.61A11.84 11.84 0 001 12c1.73 4.89 6 8 11 8a10.94 10.94 0 005.09-1.12" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LoginScreen({ onLogin, loginMessage }: any) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <Shell
      title="Decal Monkey Field App"
      subtitle="Sign in to continue"
      showWatermark
    >
      <div className="w-full max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_0.92fr] gap-5 items-start">
          <Card className="p-5 md:p-6 bg-white/95">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-white"
                  style={{ background: purple }}
                >
                  Decal Monkey Live
                </div>

                <div className="text-sm text-slate-500">
                  Version {APP_VERSION}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 shrink-0">
                  <img
                    src="/dm-fieldapp-logo.png"
                    alt="Decal Monkey Field App"
                    className="h-16 w-16 md:h-20 md:w-20 object-contain"
                  />
                </div>

                <div>
                  <div className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                    Welcome to the
                    <br />
                    Decal Monkey field system.
                  </div>
                  <div className="mt-2 text-slate-600 leading-6">
                    Orders, measurements, installs, and closeout flow in one clean place.
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">Fast order entry</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Capture jobs cleanly from the field.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">Measurement workflow</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Photos, notes, and clean handoff.
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">Install-ready tools</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Open jobs, finish work, and close out cleanly.
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 md:p-6 bg-white/95">
            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <div className="text-2xl md:text-3xl font-black text-slate-900">Sign in</div>
                <div className="mt-1 text-sm text-slate-500">
                  Use your shared Decal Monkey app username and password
                </div>
              </div>

              {loginMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {loginMessage}
                </div>
              ) : null}

              <div>
                <div className="mb-2 font-semibold text-slate-800">Username</div>
                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-slate-500 bg-white"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <div className="mb-2 font-semibold text-slate-800">Password</div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-14 text-slate-800 outline-none focus:border-slate-500 bg-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={!showPassword} />
                  </button>
                </div>
              </div>

              <ActionButton type="submit" className="w-full justify-center text-base">
                Enter Field App
              </ActionButton>

              <div
                className="rounded-2xl px-4 py-3 text-sm text-white"
                style={{ background: purple }}
              >
                Secure app login only. Updates roll out automatically, so there is no update button to babysit.
              </div>

            </form>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
