
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "https://brandshield-jxp0.onrender.com").replace(/\/$/, "");


export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { detail?: string | { loc?: unknown[]; msg?: string }[] };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        message = body.detail
          .map((issue) => `${issue.loc?.slice(1).join(".") || "Request"}: ${issue.msg || "Invalid value"}`)
          .join("; ");
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}