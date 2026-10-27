/**
 * Thin client for the MedPredict Python backend (see /backend).
 *
 * All Gemini calls now happen server-side, so no API key ever reaches the browser.
 * In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.ts).
 * To point at a deployed backend instead, set VITE_API_URL (e.g. https://api.example.com).
 */
import { AnalysisResult, LabReportSummary, UserProfile } from "../types";

const API_BASE: string = ((import.meta as any).env?.VITE_API_URL ?? '').replace(/\/$/, '');

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      if (typeof err?.detail === 'string') message = err.detail;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const analyzeSymptoms = (symptoms: string, profile?: UserProfile): Promise<AnalysisResult> =>
  post<AnalysisResult>('/api/analyze-symptoms', { symptoms, profile });

export const analyzeLabReport = (base64Image: string, profile?: UserProfile): Promise<LabReportSummary> =>
  post<LabReportSummary>('/api/analyze-lab-report', { image: base64Image, profile });

export const findSpecializedCare = (
  specialization: string,
  lat: number,
  lng: number
): Promise<{ text: string; links: any[] }> =>
  post('/api/find-care', { specialization, lat, lng });

/** WebSocket URL for the live voice consult (proxied through the backend). */
export const getLiveSocketUrl = (): string => {
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + '/api/live';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/live`;
};
