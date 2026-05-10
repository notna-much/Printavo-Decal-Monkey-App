export type AppUserRole = "admin" | "sales" | "installer" | "field";

export type AppUser = {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: AppUserRole;
  isActive: boolean;
  sessionToken?: string;
  sessionId?: string;
  deviceName?: string;
};

const SESSION_STORAGE_KEY = "dm_app_auth_session";

const DEFAULT_USERS: AppUser[] = [];

function safeJsonParse<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function clean(value: any) {
  return String(value || "").trim();
}

function normalizeRole(role: any): AppUserRole {
  const safeRole = clean(role).toLowerCase();
  if (
    safeRole === "admin" ||
    safeRole === "sales" ||
    safeRole === "installer" ||
    safeRole === "field"
  ) {
    return safeRole;
  }
  return "sales";
}

export function normalizeUser(user: Partial<AppUser>, index = 0): AppUser {
  return {
    id: clean(user?.id) || `dm-user-${Date.now()}-${index}`,
    username: clean(user?.username),
    password: clean(user?.password),
    displayName: clean(user?.displayName),
    role: normalizeRole(user?.role),
    isActive: user?.isActive !== false,
    sessionToken: clean(user?.sessionToken),
    sessionId: clean(user?.sessionId),
    deviceName: clean(user?.deviceName),
  };
}

export function getDefaultAuthUsers(): AppUser[] {
  return DEFAULT_USERS.map((user, index) => normalizeUser(user, index));
}

export function loadStoredAuthUsers(): AppUser[] {
  return getDefaultAuthUsers();
}

export function saveStoredAuthUsers(users: AppUser[]) {
  return (Array.isArray(users) ? users : [])
    .map((user, index) => normalizeUser(user, index))
    .filter((user) => user.username && user.password && user.displayName);
}

export function resetStoredAuthUsersToDefaults() {
  return getDefaultAuthUsers();
}

export function loadStoredAuthSession(): AppUser | null {
  const session = safeJsonParse<AppUser | null>(
    localStorage.getItem(SESSION_STORAGE_KEY),
    null
  );
  return session ? normalizeUser(session) : null;
}

export function saveStoredAuthSession(user: AppUser) {
  const normalized = normalizeUser(user);
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearStoredAuthSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function authenticateAppUser(
  users: AppUser[],
  username: string,
  password: string
):
  | { ok: true; user: AppUser }
  | { ok: false; message: string } {
  const safeUsername = clean(username).toLowerCase();
  const safePassword = clean(password);

  const match = (Array.isArray(users) ? users : []).find(
    (user) =>
      user.isActive !== false &&
      clean(user.username).toLowerCase() === safeUsername &&
      clean(user.password) === safePassword
  );

  if (!match) {
    return {
      ok: false,
      message: "Incorrect username or password.",
    };
  }

  return {
    ok: true,
    user: normalizeUser(match),
  };
}

function getApiBaseUrl(apiBaseUrl?: string) {
  return clean(apiBaseUrl || localStorage.getItem("dm_api_base_url") || "http://localhost:3001").replace(/\/+$/, "");
}

function authHeaders(sessionToken?: string): Record<string, string> {
  const token = clean(sessionToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseApiJson(response: Response) {
  const rawText = await response.text();

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(rawText || "Unexpected server response.");
  }
}

export async function fetchSharedAuthUsers(apiBaseUrl?: string, sessionToken?: string): Promise<AppUser[]> {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/users`, {
    headers: authHeaders(sessionToken),
  });
  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not load shared app users.");
  }

  return (Array.isArray(data.users) ? data.users : []).map((user: any, index: number) =>
    normalizeUser(user, index)
  );
}

export async function saveSharedAuthUsers(users: AppUser[], apiBaseUrl?: string, sessionToken?: string) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(sessionToken),
    },
    body: JSON.stringify({ users }),
  });

  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not save shared app users.");
  }

  return (Array.isArray(data.users) ? data.users : []).map((user: any, index: number) =>
    normalizeUser(user, index)
  );
}

export async function resetSharedAuthUsers(apiBaseUrl?: string, sessionToken?: string) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/users/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(sessionToken),
    },
  });

  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not reset shared app users.");
  }

  return (Array.isArray(data.users) ? data.users : []).map((user: any, index: number) =>
    normalizeUser(user, index)
  );
}

export async function loginSharedAuthUser({
  apiBaseUrl,
  username,
  password,
  deviceName,
}: {
  apiBaseUrl?: string;
  username: string;
  password: string;
  deviceName?: string;
}) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
      deviceName: clean(deviceName),
    }),
  });

  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    return {
      ok: false as const,
      message: data?.error || data?.message || "Login failed.",
    };
  }

  return {
    ok: true as const,
    user: normalizeUser(data.user),
  };
}

export async function logoutSharedAuthUser(
  sessionToken?: string,
  apiBaseUrl?: string
) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionToken: clean(sessionToken) }),
  });

  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not log out.");
  }

  return data;
}

export async function logoutAllSharedAuthUsers(apiBaseUrl?: string, sessionToken?: string) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/logout-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(sessionToken),
    },
  });

  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not log out all devices.");
  }

  return data;
}

export async function logoutMySharedAuthDevices({
  apiBaseUrl,
  userId,
  sessionToken,
}: {
  apiBaseUrl?: string;
  userId: string;
  sessionToken?: string;
}) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/logout-user-devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(sessionToken),
    },
    body: JSON.stringify({ userId: clean(userId) }),
  });

  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not log out this user on all devices.");
  }

  return data;
}


export async function fetchSharedAuthSessions(apiBaseUrl?: string, sessionToken?: string) {
  const response = await fetch(`${getApiBaseUrl(apiBaseUrl)}/api/auth/sessions`, {
    headers: authHeaders(sessionToken),
  });
  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Could not load active devices.");
  }

  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function validateStoredSession(
  sessionToken?: string,
  apiBaseUrl?: string
) {
  if (!clean(sessionToken)) {
    return null;
  }

  const response = await fetch(
    `${getApiBaseUrl(apiBaseUrl)}/api/auth/session/${encodeURIComponent(clean(sessionToken))}`
  );
  const data = await parseApiJson(response);

  if (!response.ok || !data?.ok || !data?.user) {
    return null;
  }

  return normalizeUser(data.user);
}

export function createEmptyAppUser(): AppUser {
  return {
    id: `dm-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    username: "",
    password: "",
    displayName: "",
    role: "sales",
    isActive: true,
  };
}

export function getDefaultScreenForRole(role: AppUserRole) {
  return role === "installer" ? "installer" : "home";
}

export function isScreenAllowedForRole(screen: string, role: AppUserRole) {
  const adminScreens = new Set([
    "home",
    "existing",
    "measurement",
    "history",
    "submission-detail",
    "installer",
    "installer-detail",
    "installer-completion",
    "installer-complete-success",
    "settings",
    "app-guide",
    "wizard",
  ]);

  const salesScreens = new Set([
    "home",
    "existing",
    "measurement",
    "history",
    "submission-detail",
    "settings",
    "app-guide",
    "wizard",
  ]);

  const installerScreens = new Set([
    "home",
    "installer",
    "installer-detail",
    "installer-completion",
    "installer-complete-success",
    "history",
    "submission-detail",
    "settings",
    "app-guide",
  ]);

  const fieldScreens = new Set([
    "home",
    "existing",
    "measurement",
    "history",
    "submission-detail",
    "installer",
    "installer-detail",
    "installer-completion",
    "installer-complete-success",
    "settings",
    "app-guide",
    "wizard",
  ]);

  if (role === "admin") return adminScreens.has(screen);
  if (role === "sales") return salesScreens.has(screen);
  if (role === "installer") return installerScreens.has(screen);
  if (role === "field") return fieldScreens.has(screen);
  return false;
}
