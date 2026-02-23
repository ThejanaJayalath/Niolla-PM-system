const API_BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const json = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const message =
      json?.error?.message ||
      (res.status === 502 || res.status === 503
        ? 'Server unavailable. Check backend and env (MONGODB_URI, JWT_SECRET).'
        : res.status === 404
          ? 'API not found. Check deployment (e.g. /api/v1 route).'
          : `Request failed (${res.status})`);
    return { success: false, error: { code: json?.error?.code || 'UNKNOWN', message } };
  }

  return json as ApiResponse<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<unknown>(path, { method: 'DELETE' }),
  uploadTemplate: async (file: File): Promise<ApiResponse<{ fileName: string; message: string }>> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('template', file);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/proposals/template`, {
      method: 'POST',
      body: formData,
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: {
          code: json?.error?.code || 'UPLOAD_FAILED',
          message: json?.error?.message || 'Template upload failed',
        },
      };
    }
    return json as ApiResponse<{ fileName: string; message: string }>;
  },
  getProposalTemplateInfo: () => request<{ hasTemplate: boolean; fileName?: string; uploadedAt?: string }>('/proposals/template'),
  uploadBillingTemplate: async (file: File): Promise<ApiResponse<{ fileName: string; message: string }>> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('template', file);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/billing/template`, {
      method: 'POST',
      body: formData,
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: {
          code: json?.error?.code || 'UPLOAD_FAILED',
          message: json?.error?.message || 'Billing template upload failed',
        },
      };
    }
    return json as ApiResponse<{ fileName: string; message: string }>;
  },
  getBillingTemplateInfo: () => request<{ hasTemplate: boolean; fileName?: string; uploadedAt?: string }>('/billing/template'),
  /** Download proposal as PDF (or DOCX if format=docx). Uses uploaded template when available. */
  download: async (path: string, filename: string): Promise<void> => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      let message = `Download failed (${res.status})`;
      try {
        const json = JSON.parse(text);
        if (json?.error?.message) message = json.error.message;
      } catch {
        /* use default message */
      }
      throw new Error(message);
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    const serverFilename = disposition?.match(/filename="?([^";]+)"?/)?.[1]?.trim();
    const downloadFilename = serverFilename || filename;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Revoke after a delay so the browser can start the download
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 500);

    const serverMessage = res.headers.get('X-Message');
    if (serverMessage) setTimeout(() => alert(serverMessage), 300);
  },
};

export function getPdfDownloadUrl(proposalId: string): string {
  const token = getToken();
  return `${API_BASE}/proposals/${proposalId}/pdf${token ? `?token=${token}` : ''}`;
}
