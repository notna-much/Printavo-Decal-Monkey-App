const DEFAULT_API_BASE_URL = "https://api.decalmonkey.biz";
const API_BASE_URL_STORAGE_KEY = "dm_api_base_url";

function cleanBaseUrl(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

export function getApiBaseUrl(apiBaseUrl?: string) {
  try {
    return (
      cleanBaseUrl(apiBaseUrl) ||
      cleanBaseUrl(localStorage.getItem(API_BASE_URL_STORAGE_KEY)) ||
      DEFAULT_API_BASE_URL
    );
  } catch {
    return cleanBaseUrl(apiBaseUrl) || DEFAULT_API_BASE_URL;
  }
}
