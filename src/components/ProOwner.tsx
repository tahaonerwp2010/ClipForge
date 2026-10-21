import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, ArrowLeft, ArrowRight, Crown, ShieldCheck, Loader2, Lock } from 'lucide-react';
import { PAY_METHODS, PRO_PLAN_NAME, PRO_PRICE_USD, PRO_PERIOD, PRO_DETAILS, CONTACTS } from '../config/proConfig';
import { LicenseService, useLicense } from '../services/licenseService';

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ onClose, children, wide }) => (
  <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} bg-[#0b1410] border border-[#1d3228] rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto`}>{children}</div>
  </div>
);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className = '', ...p }) => (
  <button type="button" {...p} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${primary ? 'bg-[#bef264] hover:bg-[#a3e635] text-black' : 'bg-[#111e18] hover:bg-[#192c23] text-neutral-200 border border-[#1d3228]'} ${className}`} />
);
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }} className="text-neutral-400 hover:text-white cursor-pointer shrink-0" title="Copy">{ok ? <Check className="w-3.5 h-3.5 text-[#bef264]" /> : <Copy className="w-3.5 h-3.5" />}</button>;
};

// ---------------- Buy Pro: plan (price + what you get) -> payment details (+ socials + device ID) ----------------
export const BuyProModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lic = useLicense();
  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState(PAY_METHODS[0]?.id);
  const [id, setId] = useState(lic.id);
  const m = PAY_METHODS.find(x => x.id === method) || PAY_METHODS[0];
  const open = (url: string) => { if (url) window.electronAPI?.openExternal?.(url); };
  useEffect(() => { (async () => { try { const r = await window.electronAPI?.licenseRegister?.(); if (r?.id) setId(r.id); } catch {} })(); }, []);
  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-[#bef264]/15 text-[#bef264] flex items-center justify-center"><Crown className="w-4 h-4" /></div>
          <h3 className="text-base font-bold text-white">{step === 1 ? 'ClipForge Pro' : 'Payment details'}</h3></div>
        <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
      </div>

      {step === 1 && (<>
        <div className="rounded-2xl border border-[#2a4a35] bg-gradient-to-b from-[#12201a] to-[#0b1410] p-5 text-center space-y-1">
          <div className="inline-block px-3 py-0.5 rounded-full bg-[#bef264] text-black text-[10px] font-extrabold uppercase tracking-widest">{PRO_PLAN_NAME}</div>
          <div className="flex items-end justify-center gap-1.5 pt-2"><span className="text-5xl font-black text-white leading-none">${PRO_PRICE_USD}</span><span className="text-xs text-neutral-400 pb-1">{PRO_PERIOD}</span></div>
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">What you get</h4>
          <ul className="space-y-2">
            {PRO_DETAILS.map(d => <li key={d} className="flex items-start gap-2 text-xs text-neutral-200"><Check className="w-3.5 h-3.5 text-[#bef264] shrink-0 mt-0.5" /><span>{d}</span></li>)}
          </ul>
        </div>
        <div className="flex justify-between pt-1"><Btn onClick={onClose}>Close</Btn><Btn primary onClick={() => setStep(2)}>Payment details <ArrowRight className="w-3.5 h-3.5" /></Btn></div>
      </>)}

      {step === 2 && (<>
        <div className="grid grid-cols-2 gap-2">
          {PAY_METHODS.map(x => (
            <button key={x.id} type="button" onClick={() => setMethod(x.id)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left cursor-pointer border ${method === x.id ? 'bg-[#12201a] border-[#3f9a5a] text-[#8fd0a4]' : 'bg-[#0f1c16] border-[#1d3228] text-neutral-300 hover:text-white'}`}>{x.name}</button>
          ))}
        </div>
        {m && (
          <div className="rounded-xl bg-[#09100d] border border-[#17291f] p-3 space-y-2">
            {m.lines.map(l => (
              <div key={l.label} className="flex items-center justify-between gap-3 text-xs"><span className="text-neutral-500">{l.label}</span><span className="flex items-center gap-2 text-neutral-100 font-mono break-all text-right">{l.value}<CopyBtn text={l.value} /></span></div>
            ))}
            {m.note && <p className="text-[11px] text-amber-300/90">{m.note}</p>}
          </div>
        )}
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">After paying, send the screenshot here</h4>
          <div className="space-y-2">
            {Object.values(CONTACTS).map(c => (
              <div key={c.label} className="flex items-center justify-between gap-3 rounded-xl bg-[#09100d] border border-[#17291f] px-3 py-2">
                <div><div className="text-xs font-bold text-white">{c.label}</div><div className="text-[11px] text-neutral-400 font-mono">{c.handle}</div></div>
                <div className="flex items-center gap-2"><CopyBtn text={c.handle} />{c.url && <Btn onClick={() => open(c.url)} className="!py-1.5">Open</Btn>}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Your unique device ID (send it with the screenshot)</h4>
          <div className="rounded-xl bg-[#09100d] border border-[#3f9a5a]/50 px-4 py-3 flex items-center justify-between gap-3"><span className="font-mono text-base text-[#bef264] tracking-wider">{id || lic.id || '...'}</span><CopyBtn text={id || lic.id} /></div>
          <p className="text-[11px] text-neutral-500 mt-1.5">Pro is switched on for this device after the payment is checked. It stays even if you reinstall ClipForge.</p>
          {!lic.configured && <p className="text-[11px] text-amber-300 mt-1">The licence server is not set up in this build yet.</p>}
        </div>
        <div className="flex justify-between pt-1"><Btn onClick={() => setStep(1)}><ArrowLeft className="w-3.5 h-3.5" /> Back</Btn><Btn primary onClick={() => { LicenseService.refresh(); onClose(); }}>Done</Btn></div>
      </>)}
    </Overlay>
  );
};

// ---------------- Shown when a render uses Pro features but the PC has no Pro / trial ----------------
export const ProBlockedModal: React.FC<{ features: string[]; onClose: () => void }> = ({ features, onClose }) => (
  <Overlay onClose={onClose}>
    <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center"><Lock className="w-4 h-4" /></div><h3 className="text-base font-bold text-white">Pro features in use</h3></div>
    <p className="text-xs text-neutral-300">Some of the things you picked are Pro features, so these clips cannot be generated:</p>
    <ul className="space-y-1.5 rounded-xl bg-[#09100d] border border-[#17291f] p-3">
      {features.map(f => <li key={f} className="flex items-center gap-2 text-xs text-neutral-100"><Crown className="w-3.5 h-3.5 text-[#bef264] shrink-0" />{f}</li>)}
    </ul>
    <p className="text-[11px] text-neutral-400">Turn these off, or get Pro to use them. You can still preview them in the studio.</p>
    <div className="flex justify-between gap-2 pt-1"><Btn onClick={() => { onClose(); LicenseService.openBuy(); }}><Crown className="w-3.5 h-3.5" /> Get Pro</Btn><Btn primary onClick={onClose}>Cancel</Btn></div>
  </Overlay>
);

// ---------------- Owner: password popup ----------------
export const OwnerLogin: React.FC<{ onClose: () => void; onOk: () => void }> = ({ onClose, onOk }) => {
  const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const go = async () => {
    if (!pw) return;
    setBusy(true); setErr('');
    const r = await window.electronAPI?.ownerCheck?.(pw);
    setBusy(false);
    if (r?.ok) { LicenseService.setOwner(pw); onOk(); }
    else setErr(r?.error === 'not-configured' ? 'The licence server is not set up in this build.' : 'Wrong password.');
  };
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#bef264]" /><h3 className="text-sm font-bold text-white">Owner access</h3></div>
      <input ref={ref} type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} placeholder="Password"
        className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn primary onClick={go} disabled={busy || !pw}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Enter</Btn></div>
    </Overlay>
  );
};

// ---------------- Owner: CMS panel ----------------
type Info = { exists?: boolean; pro?: boolean; forever?: boolean; proUntil?: string | null; proDaysLeft?: number | null; trialActive?: boolean; trialDaysLeft?: number; trialStart?: string | null };
const PLANS: { id: 'month' | 'year' | 'forever'; label: string; txt: string }[] = [
  { id: 'month', label: '1 month', txt: '1 month of Pro' }, { id: 'year', label: '1 year', txt: '1 year of Pro' }, { id: 'forever', label: 'Forever', txt: 'Pro forever' },
];
const fmtDate = (iso?: string | null) => { try { return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch { return ''; } };

const Confirm: React.FC<{ text: React.ReactNode; yes: string; busy?: boolean; onNo: () => void; onYes: () => void }> = ({ text, yes, busy, onNo, onYes }) => (
  <div className="fixed inset-0 z-[410] bg-black/70 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onNo(); }}>
    <div className="w-full max-w-sm bg-[#0b1410] border border-amber-500/40 rounded-2xl p-5 space-y-3 shadow-2xl">
      <h4 className="text-sm font-bold text-white">Are you sure?</h4>
      <p className="text-xs text-amber-100/90">{text}</p>
      <div className="flex justify-end gap-2"><Btn onClick={onNo} disabled={busy}>No</Btn><Btn primary onClick={onYes} disabled={busy}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}{yes}</Btn></div>
    </div>
  </div>
);

export const OwnerPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { ownerPw: pw } = useLicense();
  const [id, setId] = useState('');
  const [sugg, setSugg] = useState<{ id: string; pro: boolean }[]>([]);
  const [info, setInfo] = useState<Info | null>(null);
  const [plan, setPlan] = useState<'month' | 'year' | 'forever'>('month');
  const [ask, setAsk] = useState<null | 'grant' | 'remove'>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const clean = id.trim().toUpperCase();
  const complete = /^CF-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(clean);

  const lookup = async (my = ++seq.current) => {
    if (!pw || !complete) return;
    const l = await window.electronAPI?.ownerLookup?.(pw, clean);
    if (my !== seq.current) return;
    if (l?.ok) setInfo(l as Info);
  };
  useEffect(() => {
    setMsg(null); setAsk(null);
    if (!pw || clean.length < 2) { setSugg([]); setInfo(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      const s = await window.electronAPI?.ownerSuggest?.(pw, clean);
      if (my !== seq.current) return;
      setSugg(s?.list || []);
      if (complete) await lookup(my); else setInfo(null);
    }, 350);
    return () => clearTimeout(t);
  }, [clean, pw, complete]);

  const run = async () => {
    if (!pw || !ask) return;
    setBusy(true);
    const r = ask === 'grant' ? await window.electronAPI?.ownerGrant?.(pw, clean, plan) : await window.electronAPI?.ownerRemove?.(pw, clean);
    setBusy(false); const was = ask; setAsk(null);
    if (r?.ok) { setMsg({ ok: true, t: was === 'grant' ? `Done. ${PLANS.find(p => p.id === plan)!.txt} given to ${clean}.` : `Done. Pro removed from ${clean}.` }); await lookup(); LicenseService.refresh(); }
    else setMsg({ ok: false, t: r?.error === 'denied' ? 'Access denied (wrong password).' : `Could not save: ${r?.error || 'unknown error'}` });
  };

  let analysis: { tone: 'ok' | 'warn' | 'mute'; t: string } | null = null;
  if (complete && info) {
    if (!info.exists) analysis = { tone: 'warn', t: 'This ID does not exist yet. Giving Pro will create it.' };
    else if (info.forever) analysis = { tone: 'ok', t: 'Pro: forever' };
    else if (info.pro) analysis = { tone: 'ok', t: `Pro: ${info.proDaysLeft ?? '?'} day${info.proDaysLeft === 1 ? '' : 's'} left (until ${fmtDate(info.proUntil)})` };
    else if (info.trialActive) analysis = { tone: 'warn', t: `Free trial: ${info.trialDaysLeft} day${info.trialDaysLeft === 1 ? '' : 's'} left` };
    else analysis = { tone: 'mute', t: info.trialStart ? 'Free · no Pro · trial finished' : 'Free · no Pro · trial not started' };
  }

  return (
    <Overlay onClose={onClose} wide>
      <div className="flex items-start justify-between"><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#bef264]" /><h3 className="text-sm font-bold text-white">Owner panel</h3></div>
        <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button></div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">ID</h4>
          <button type="button" disabled={!complete || busy} onClick={() => setAsk('remove')}
            className="px-3 py-1 rounded-lg text-[11px] font-bold border cursor-pointer border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500/10">Remove pro</button>
        </div>
        <input value={id} onChange={e => setId(e.target.value)} placeholder="CF-XXXX-XXXX-XXXX-XXXX" spellCheck={false}
          className="w-full bg-[#09100d] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-sm font-mono text-white uppercase focus:outline-none" />
        {!complete && clean.length >= 2 && sugg.length === 0 && <p className="text-[11px] text-neutral-500">No matching ID found.</p>}
        {sugg.length > 0 && !(complete && sugg.length === 1 && sugg[0].id === clean) && (
          <div className="rounded-lg border border-[#17291f] bg-[#09100d] divide-y divide-[#13231b] overflow-hidden">
            {sugg.map(s => (
              <button key={s.id} type="button" onClick={() => setId(s.id)} className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono text-neutral-200 hover:bg-[#10201a] cursor-pointer">
                <span>{s.id}</span><span className={s.pro ? 'text-[#bef264]' : 'text-neutral-500'}>{s.pro ? 'PRO' : 'free'}</span>
              </button>
            ))}
          </div>
        )}
        {analysis && (
          <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${analysis.tone === 'ok' ? 'border-[#3f9a5a]/60 bg-[#3f9a5a]/10 text-[#bef264]' : analysis.tone === 'warn' ? 'border-amber-500/40 bg-amber-500/5 text-amber-200' : 'border-[#1d3228] bg-[#09100d] text-neutral-400'}`}>{analysis.t}</div>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Pro</h4>
        <select value={plan} onChange={e => setPlan(e.target.value as 'month' | 'year' | 'forever')} disabled={!complete}
          className="w-full bg-[#09100d] border border-[#1d3228] rounded-lg px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50">
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </section>

      {msg && <p className={`text-xs ${msg.ok ? 'text-[#8fd0a4]' : 'text-red-400'}`}>{msg.t}</p>}
      <div className="flex justify-end"><Btn primary disabled={!complete || busy} onClick={() => setAsk('grant')}>Confirm</Btn></div>

      {ask === 'grant' && <Confirm yes="Yes, give Pro" busy={busy} onNo={() => setAsk(null)} onYes={run}
        text={<>Give <b>{PLANS.find(p => p.id === plan)!.txt}</b> to <span className="font-mono">{clean}</span>? A running free trial ends and the paid time starts now.</>} />}
      {ask === 'remove' && <Confirm yes="Yes, remove" busy={busy} onNo={() => setAsk(null)} onYes={run}
        text={<>Remove all Pro access from <span className="font-mono">{clean}</span>? This device goes back to the free plan.</>} />}
    </Overlay>
  );
};
