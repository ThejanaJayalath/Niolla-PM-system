import { pushSystemToast } from '../lib/systemToast';

const API_BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  warnings?: string[];
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
    // Do not clear session on failed login/register — that breaks sign-in UX and can loop.
    const isAuthPublic = path === '/auth/login' || path === '/auth/register';
    if (res.status === 401 && !isAuthPublic) {
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
  getProposalTemplateInfo: () =>
    request<{ hasTemplate: boolean; fileName?: string; uploadedAt?: string; isDefault?: boolean }>(
      '/proposals/template'
    ),
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
  listGreetingTemplates: () =>
    request<
      {
        _id: string;
        templateType: 'birthday' | 'anniversary' | 'festival';
        festivalKey?: string;
        fileName: string;
        uploadedAt: string;
      }[]
    >('/engagement/templates'),
  getGreetingTemplateInfo: (templateType: string, festivalKey?: string) => {
    const qs = festivalKey ? `?festivalKey=${encodeURIComponent(festivalKey)}` : '';
    return request<{
      hasTemplate: boolean;
      fileName?: string;
      uploadedAt?: string;
      isDefault?: boolean;
      templateType?: string;
      festivalKey?: string;
    }>(`/engagement/templates/${templateType}${qs}`);
  },
  uploadGreetingTemplate: async (
    templateType: string,
    file: File,
    festivalKey?: string
  ): Promise<ApiResponse<{ fileName: string; message: string }>> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('template', file);
    if (festivalKey) formData.append('festivalKey', festivalKey);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/engagement/templates/${templateType}`, {
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
          message: json?.error?.message || 'Card template upload failed',
        },
      };
    }
    return json as ApiResponse<{ fileName: string; message: string }>;
  },
  deleteGreetingTemplate: (templateType: string, festivalKey?: string) => {
    const qs = festivalKey ? `?festivalKey=${encodeURIComponent(festivalKey)}` : '';
    return request<{ deleted: boolean }>(`/engagement/templates/${templateType}${qs}`, { method: 'DELETE' });
  },
  fetchGreetingTemplatePreview: async (templateType: string, festivalKey?: string): Promise<string | null> => {
    const token = getToken();
    const qs = festivalKey ? `?festivalKey=${encodeURIComponent(festivalKey)}` : '';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/engagement/templates/${templateType}/preview${qs}`, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
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
    const contentType = res.headers.get('Content-Type') || '';
    let downloadFilename = (serverFilename || filename)
      .replace(/[/\\?%*:|"<>]/g, '-')
      .trim();
    if (contentType.includes('wordprocessingml') && !downloadFilename.toLowerCase().endsWith('.docx')) {
      downloadFilename = downloadFilename.replace(/\.pdf$/i, '') + '.docx';
    } else if (contentType.includes('pdf') && !downloadFilename.toLowerCase().endsWith('.pdf')) {
      downloadFilename = downloadFilename.replace(/\.docx$/i, '') + '.pdf';
    }
    const mimeType = blob.type || 'application/octet-stream';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (isMobile && typeof navigator.share === 'function' && typeof File !== 'undefined') {
      try {
        const file = new File([blob], downloadFilename, { type: mimeType });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: downloadFilename });
          const serverMessage = res.headers.get('X-Message');
          if (serverMessage) {
            setTimeout(() => pushSystemToast(serverMessage, 'warning'), 300);
          }
          return;
        }
      } catch (shareErr) {
        if ((shareErr as Error)?.name === 'AbortError') return;
      }
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // iOS Safari often ignores programmatic downloads — open the blob so the user can save/share.
    if (isMobile && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 2000);

    const serverMessage = res.headers.get('X-Message');
    if (serverMessage) {
      setTimeout(() => pushSystemToast(serverMessage, 'warning'), 300);
    }
  },
};

export function getPdfDownloadUrl(proposalId: string): string {
  const token = getToken();
  return `${API_BASE}/proposals/${proposalId}/pdf${token ? `?token=${token}` : ''}`;
}
