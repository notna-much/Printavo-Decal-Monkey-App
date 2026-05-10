export const getStored = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

export const setStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
