import { useEffect, useState } from "react";
import { Card, ActionButton, Shell } from "../components/ui";
import { APP_VERSION, APP_ENV } from "../config/version";
import { CHANGELOG } from "../config/changelog";

const green = "#7BC043";
const red = "#DC2626";
const amber = "#F59E0B";
const purple = "#4B257A";

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "sales", label: "Sales" },
  { value: "installer", label: "Installer" },
  { value: "field", label: "Field Access" },
];

function formatRoleLabel(role: string) {
  const match = roleOptions.find((item) => item.value === role);
  return match?.label || role || "User";
}

export default function SettingsScreen({
  mainEmail,
  setMainEmail,
  apiBaseUrl,
  setApiBaseUrl,
  deviceName,
  setDeviceName,
  currentUser,
  authUser,
  authUsers,
  addAuthUser,
  updateAuthUser,
  removeAuthUser,
  saveAuthUsersNow,
  resetAuthUsers,
  handleLogout,
  syncSharedAuthUsers,
  activeAuthSessions,
  syncActiveAuthSessions,
  handleLogoutAllDevices,
  handleLogoutMyDevices,
  saveSettings,
  testBackendConnection,
  connectionState,
  settingsMessage,
  setScreen,
  clearInstallerCache,
  clearMeasurementCache,
  clearAllJobCaches,
  installerCacheCount,
  measurementCacheCount,
  historySnapshotCount,
}: any) {
  const [showChangelog, setShowChangelog] = useState(false);
  const [deviceSaveState, setDeviceSaveState] = useState("idle");
  const [connectionSaveState, setConnectionSaveState] = useState("idle");
  const [loginSaveState, setLoginSaveState] = useState("idle");

  const statusColor =
    connectionState.status === "connected"
      ? green
      : connectionState.status === "error"
      ? red
      : amber;

  const statusLabel =
    connectionState.status === "connected"
      ? "Connected"
      : connectionState.status === "error"
      ? "Connection Failed"
      : "Not Tested";

  const canManageUsers = authUser?.role === "admin";
  const canViewAdminSections = authUser?.role === "admin";

  useEffect(() => {
    if (!settingsMessage) return;

    const message = String(settingsMessage).toLowerCase();

    if (message.includes("settings saved for")) {
      setDeviceSaveState("saved");
      const timer = window.setTimeout(() => setDeviceSaveState("idle"), 2200);
      return () => window.clearTimeout(timer);
    }

    if (message.includes("app login")) {
      setLoginSaveState("saved");
      const timer = window.setTimeout(() => setLoginSaveState("idle"), 2200);
      return () => window.clearTimeout(timer);
    }
  }, [settingsMessage]);

  useEffect(() => {
    if (connectionState.loading) {
      setConnectionSaveState("testing");
      return;
    }

    if (connectionSaveState === "testing") {
      if (connectionState.status === "connected") {
        setConnectionSaveState("saved");
        const timer = window.setTimeout(() => setConnectionSaveState("idle"), 2200);
        return () => window.clearTimeout(timer);
      }

      if (connectionState.status === "error" || connectionState.status === "idle") {
        setConnectionSaveState("idle");
      }
    }
  }, [connectionState.loading, connectionState.status, connectionSaveState]);

  const handleSaveDeviceInfo = () => {
    setDeviceSaveState("saving");
    saveSettings();
    window.setTimeout(() => {
      setDeviceSaveState("saved");
      window.setTimeout(() => setDeviceSaveState("idle"), 2200);
    }, 50);
  };

  const handleSaveConnectionSettings = () => {
    setConnectionSaveState("saving");
    saveSettings();
    window.setTimeout(() => {
      setConnectionSaveState("saved");
      window.setTimeout(() => setConnectionSaveState("idle"), 2200);
    }, 50);
  };

  const handleSaveAppLogins = () => {
    setLoginSaveState("saving");
    saveAuthUsersNow();
    window.setTimeout(() => {
      setLoginSaveState("saved");
      window.setTimeout(() => setLoginSaveState("idle"), 2200);
    }, 50);
  };

  const getDeviceButtonLabel = () => {
    if (deviceSaveState === "saving") return "Saving...";
    if (deviceSaveState === "saved") return "Device & App Info Saved";
    return "Save Device & App Info";
  };

  const getConnectionButtonLabel = () => {
    if (connectionSaveState === "saving") return "Saving...";
    if (connectionSaveState === "saved") return "Connection Settings Saved";
    return "Save Connection Settings";
  };

  const getLoginButtonLabel = () => {
    if (loginSaveState === "saving") return "Saving...";
    if (loginSaveState === "saved") return "App Logins Saved";
    return "Save App Logins";
  };

  const goHome = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setScreen("home");
  };

  const goToGuide = () => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
      setTimeout(() => window.scrollTo(0, 0), 0);
    }
    setScreen("app-guide");
  };

  return (
    <>
      <Shell title="Settings" subtitle="Device, app, and connection setup">
        <div className="space-y-6">
          {settingsMessage ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              {settingsMessage}
            </div>
          ) : null}

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xl font-bold text-slate-800">Signed In</div>
                <div className="text-sm text-slate-500 mt-1">
                  App-based authentication is active on this device.
                </div>
              </div>

              <div
                className="rounded-full px-3 py-1 text-sm font-semibold text-white"
                style={{ background: purple }}
              >
                {formatRoleLabel(authUser?.role)}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-slate-500">Display Name</div>
                <div className="mt-1 font-semibold text-slate-800">
                  {currentUser || authUser?.displayName || "Unknown User"}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-slate-500">Username</div>
                <div className="mt-1 font-semibold text-slate-800">
                  {authUser?.username || "Unknown"}
                </div>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <ActionButton variant="secondary" onClick={handleLogout}>
                Log Out
              </ActionButton>
              <ActionButton variant="secondary" onClick={handleLogoutMyDevices}>
                Log Me Out of All Devices
              </ActionButton>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xl font-bold text-slate-800">Device & App Info</div>

              <ActionButton variant="secondary" onClick={goToGuide}>
                App Guide
              </ActionButton>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-semibold text-slate-800 mb-2">Device Name</div>
                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Leave blank to use this device's detected name"
                />
                <div className="mt-2 text-xs text-slate-500">
                  Leave this blank and save to auto-use the current device and browser name.
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-800 mb-2">Current Rep Name</div>
                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-slate-100 text-slate-500"
                  value={currentUser}
                  disabled
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-slate-500">App Version</div>
                <div className="mt-1 font-semibold text-slate-800">
                  {APP_VERSION}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-slate-500">Environment</div>
                <div className="mt-1 font-semibold text-slate-800">
                  {APP_ENV}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChangelog(true)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <div className="text-slate-500">Changelog</div>
                <div className="mt-1 font-semibold text-slate-800">
                  View updates
                </div>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 text-slate-600 text-sm">
              Customer owner defaults to the signed-in rep. Version details are shown
              here so you can quickly confirm what build is on this device.
            </div>

            <div className="flex gap-3 flex-wrap">
              <ActionButton onClick={handleSaveDeviceInfo}>
                {getDeviceButtonLabel()}
              </ActionButton>
            </div>
          </Card>

          {canViewAdminSections ? (
            <>
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xl font-bold text-slate-800">
                      Printavo Connection
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      Backend location and connection status for this iPad.
                    </div>
                  </div>

                  <div
                    className="rounded-full px-3 py-1 text-white text-sm font-semibold"
                    style={{ background: statusColor }}
                  >
                    {statusLabel}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-800 mb-2">Main Email</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                    placeholder="info@decalmonkey.biz"
                    value={mainEmail}
                    onChange={(e) => setMainEmail(e.target.value)}
                  />
                </div>

                <div>
                  <div className="font-semibold text-slate-800 mb-2">Backend URL</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="http://api.decalmonkey.biz"
                  />
                </div>

                <div>
                  <div className="font-semibold text-slate-800 mb-2">API Code</div>
                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 bg-slate-100 text-slate-500"
                    placeholder="Stored securely in backend"
                    type="password"
                    disabled
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 whitespace-pre-wrap">
                  {connectionState.message ||
                    "The backend keeps the real Printavo credentials under lock and key. This app only needs the backend URL and main email."}
                </div>

                <div className="flex gap-3 flex-wrap">
                  <ActionButton onClick={handleSaveConnectionSettings}>
                    {getConnectionButtonLabel()}
                  </ActionButton>

                  <ActionButton
                    variant="secondary"
                    onClick={testBackendConnection}
                    disabled={connectionState.loading}
                  >
                    {connectionState.loading ? "Testing..." : "Test Connection"}
                  </ActionButton>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xl font-bold text-slate-800">App Logins</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Manage shared usernames and passwords across all devices.
                    </div>
                  </div>

                  {canManageUsers ? (
                    <div className="flex gap-3 flex-wrap">
                    <ActionButton variant="secondary" onClick={addAuthUser}>
                      Add User
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={syncSharedAuthUsers}>
                      Refresh Shared Users
                    </ActionButton>
                  </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Bart and Heather are admins by default. Shared app logins are stored on the server so every device stays in sync, even after a restart.
                </div>

                <div className="space-y-4">
                  {(authUsers || []).map((user: any, index: number) => (
                    <div
                      key={user.id || index}
                      className="rounded-3xl border border-slate-200 p-4 bg-white"
                    >
                      <div className="grid lg:grid-cols-4 gap-4">
                        <div>
                          <div className="font-semibold text-slate-800 mb-2">
                            Display Name
                          </div>
                          <input
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500"
                            value={user.displayName || ""}
                            disabled={!canManageUsers}
                            onChange={(e) =>
                              updateAuthUser(user.id, "displayName", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <div className="font-semibold text-slate-800 mb-2">
                            Username
                          </div>
                          <input
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500"
                            value={user.username || ""}
                            disabled={!canManageUsers}
                            onChange={(e) =>
                              updateAuthUser(user.id, "username", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <div className="font-semibold text-slate-800 mb-2">
                            Password
                          </div>
                          <input
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500"
                            value={user.password || ""}
                            disabled={!canManageUsers}
                            onChange={(e) =>
                              updateAuthUser(user.id, "password", e.target.value)
                            }
                          />
                        </div>

                        <div>
                          <div className="font-semibold text-slate-800 mb-2">
                            Role
                          </div>
                          <select
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 disabled:bg-slate-100 disabled:text-slate-500"
                            value={user.role || "sales"}
                            disabled={!canManageUsers}
                            onChange={(e) =>
                              updateAuthUser(user.id, "role", e.target.value)
                            }
                          >
                            {roleOptions.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={user.isActive !== false}
                            disabled={!canManageUsers}
                            onChange={(e) =>
                              updateAuthUser(user.id, "isActive", e.target.checked)
                            }
                          />
                          Active login
                        </label>

                        {canManageUsers ? (
                          <ActionButton
                            variant="secondary"
                            onClick={() => removeAuthUser(user.id)}
                          >
                            Remove User
                          </ActionButton>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {canManageUsers ? (
                  <div className="flex gap-3 flex-wrap">
                    <ActionButton onClick={handleSaveAppLogins}>
                      {getLoginButtonLabel()}
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={resetAuthUsers}>
                      Reset to Default Users
                    </ActionButton>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Only admins can change app login users.
                  </div>
                )}
              </Card>
            </>
          ) : null}
                        {canViewAdminSections ? (
<Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xl font-bold text-slate-800">Session Controls</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Admins can view active devices and clear sessions for the whole field app.
                    </div>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <ActionButton variant="secondary" onClick={syncActiveAuthSessions}>
                      Refresh Active Devices
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={handleLogoutAllDevices}>
                      Log Out All Devices
                    </ActionButton>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Only admins can view who is signed in across the shop. Everyone else can still log themselves out on all devices from the Signed In card above.
                </div>

                {(activeAuthSessions || []).length ? (
                  <div className="space-y-3">
                    {(activeAuthSessions || []).map((session: any, index: number) => (
                      <div
                        key={session.sessionToken || session.id || index}
                        className="rounded-3xl border border-slate-200 p-4 bg-white"
                      >
                        <div className="grid md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-slate-500">Display Name</div>
                            <div className="mt-1 font-semibold text-slate-800">
                              {session.displayName || session.username || "Unknown"}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500">Username</div>
                            <div className="mt-1 font-semibold text-slate-800">
                              {session.username || "Unknown"}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500">Device</div>
                            <div className="mt-1 font-semibold text-slate-800">
                              {session.deviceName || "Unknown Device"}
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500">Last Seen</div>
                            <div className="mt-1 font-semibold text-slate-800">
                              {session.lastSeenAt
                                ? new Date(session.lastSeenAt).toLocaleString()
                                : "Unknown"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No active devices are currently signed in.
                  </div>
                )}
              </Card>
          ) : null}

          <Card className="p-5 space-y-4">
            <div className="text-xl font-bold text-slate-800">Cache Controls</div>

            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                Installer cache: {installerCacheCount || 0}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                Measurement cache: {measurementCacheCount || 0}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                Install snapshots: {historySnapshotCount || 0}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <ActionButton variant="secondary" onClick={clearInstallerCache}>
                Clear Installer Cache
              </ActionButton>

              <ActionButton variant="secondary" onClick={clearMeasurementCache}>
                Clear Measurement Cache
              </ActionButton>

              <ActionButton variant="secondary" onClick={clearAllJobCaches}>
                Clear All Job Cache
              </ActionButton>
            </div>
          </Card>

          <div className="flex gap-3 flex-wrap">
            <ActionButton variant="secondary" onClick={goHome}>
              Back to Home
            </ActionButton>
          </div>
        </div>
      </Shell>

      {showChangelog ? (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowChangelog(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-6 py-4 text-white flex items-center justify-between"
              style={{ background: purple }}
            >
              <div>
                <div className="text-2xl font-black">Changelog</div>
                <div className="text-sm text-white/80">
                  Recent updates for Decal Monkey Field App
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChangelog(false)}
                className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5 bg-slate-50">
              {(CHANGELOG || []).map((entry: any) => (
                <div
                  key={entry.version}
                  className="rounded-3xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xl font-bold text-slate-800">
                      Version {entry.version}
                    </div>
                    {entry.label ? (
                      <div
                        className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                        style={{ background: purple }}
                      >
                        {entry.label}
                      </div>
                    ) : null}
                  </div>

                  {entry.date ? (
                    <div className="mt-1 text-sm text-slate-500">{entry.date}</div>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {(entry.changes || []).map((change: string, index: number) => (
                      <div
                        key={`${entry.version}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700"
                      >
                        {change}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
