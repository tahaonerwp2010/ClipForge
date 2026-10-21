import { useEffect, useState } from 'react';
import { PRO_ENFORCED, TRIAL_ENABLED, PRO_FEATURES } from '../config/proConfig';

export interface LicenseState {
  id: string; pro: boolean; forever: boolean; proDaysLeft: number | null; trial: boolean; trialDaysLeft: number;
  configured: boolean; online: boolean; loaded: boolean; ownerPw: string | null; buyOpen: boolean; blocked: string[] | null;
}
let state: LicenseState = { id: '', pro: false, forever: false, proDaysLeft: null, trial: false, trialDaysLeft: 0, configured: false, online: false, loaded: false, ownerPw: null, buyOpen: false, blocked: null };
const subs = new Set<() => void>();
const set = (p: Partial<LicenseState>) => { state = { ...state, ...p }; subs.forEach(f => f()); };

export interface ProUsage { dynamicCaptions?: boolean; split?: boolean; customFormat?: boolean; autoHook?: boolean; fx?: boolean }

export const LicenseService = {
  get: () => state,
  async refresh() {
    try { const s = await window.electronAPI?.licenseStatus?.({ trial: PRO_ENFORCED && TRIAL_ENABLED }); if (s) set({ ...s, loaded: true }); else set({ loaded: true }); } catch { set({ loaded: true }); }
  },
  setOwner: (pw: string | null) => set({ ownerPw: pw }),
  openBuy: () => set({ buyOpen: true, blocked: null }),
  closeBuy: () => set({ buyOpen: false }),
  closeBlocked: () => set({ blocked: null }),
  /** Can this PC render Pro features right now? Yes while the Pro system is off, with Pro, inside the trial, and for the owner. */
  allowed: () => !PRO_ENFORCED || state.pro || (TRIAL_ENABLED && state.trial) || !!state.ownerPw,
  locked: () => !LicenseService.allowed(),
  /** Call right before a render starts. Returns true (and opens the "Pro features in use" window) when it must NOT start. */
  blockIfLocked: (u: ProUsage): boolean => {
    if (LicenseService.allowed()) return false;
    const used = (Object.keys(u) as (keyof ProUsage)[]).filter(k => u[k]).map(k => PRO_FEATURES[k]);
    if (!used.length) return false;
    set({ blocked: used }); return true;
  },
};
export function useLicense(): LicenseState {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return state;
}
