import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, ArrowLeft, ArrowRight, Gem, ShieldCheck, Loader2, Lock, Smartphone, ExternalLink, KeyRound, CreditCard, Wallet } from 'lucide-react';
import solLogo from '../assets/pay/sol.png';
import kelviqLogo from '../assets/pay/kelviq.png';
import gumroadLogo from '../assets/pay/gumroad.png';
import { PAY_METHODS, PRO_PLANS, PRO_HIGHLIGHTS, CONTACTS } from '../config/proConfig';
import { LicenseService, useLicense } from '../services/licenseService';

const Overlay: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ onClose, children, wide }) => (
  <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} relative bg-[#0b1410] border border-[#1d3228] rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto`}>{children}</div>
  </div>
);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className = '', ...p }) => (
  <button type="button" {...p} className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 ${primary ? 'bg-[#bef264] hover:bg-[#a3e635] text-black' : 'bg-[#111e18] hover:bg-[#192c23] text-neutral-200 border border-[#1d3228]'} ${className}`} />
);
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }} className="text-neutral-400 hover:text-white cursor-pointer shrink-0" title="Copy">{ok ? <Check className="w-3.5 h-3.5 text-[#bef264]" /> : <Copy className="w-3.5 h-3.5" />}</button>;
};

// Easypaisa logo: drop the official logo file into src/assets/pay/ as easypaisa.png (or .svg / .webp / .jpg); until then a neutral wallet icon is shown.
const epLogos = import.meta.glob('../assets/pay/easypaisa.{png,svg,webp,jpg,jpeg}', { eager: true, import: 'default' }) as Record<string, string>;
const easypaisaLogo: string | undefined = Object.values(epLogos)[0];
const PayLogo: React.FC<{ kind: 'easypaisa' | 'crypto'; size?: number }> = ({ kind, size = 28 }) => {
  if (kind === 'crypto') return <img src={solLogo} alt="SOL" width={size} height={size} className="rounded-full shrink-0" style={{ width: size, height: size }} />;
  if (easypaisaLogo) return <img src={easypaisaLogo} alt="Easypaisa" className="rounded-md object-contain shrink-0 bg-white" style={{ width: size, height: size }} />;
  return <span className="rounded-md bg-[#1f9d55] text-white flex items-center justify-center shrink-0" style={{ width: size, height: size }}><Smartphone className="w-4 h-4" /></span>;
};

// ---------------- Buy Pro: pick a plan -> pick a payment method (Easypaisa / Crypto / Kelviq / Gumroad) ----------------
type PayId = 'easypaisa' | 'crypto' | 'kelviq' | 'gumroad';
const METHOD_TABS: { id: PayId; name: string }[] = [{ id: 'easypaisa', name: 'Easypaisa' }, { id: 'crypto', name: 'Crypto' }, { id: 'kelviq', name: 'Kelviq' }, { id: 'gumroad', name: 'Gumroad' }];
const MethodIcon: React.FC<{ id: PayId; size?: number }> = ({ id, size = 24 }) => {
  if (id === 'easypaisa' || id === 'crypto') return <PayLogo kind={id} size={size} />;
  return <img src={id === 'kelviq' ? kelviqLogo : gumroadLogo} alt={id} className={`shrink-0 ${id === 'kelviq' ? 'rounded-md' : 'rounded-full'}`} style={{ width: size, height: size }} />;
};

export const BuyProModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const lic = useLicense();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [planId, setPlanId] = useState<'month' | 'year'>('month');
  const plan = PRO_PLANS.find(p => p.id === planId) || PRO_PLANS[0];
  const [method, setMethod] = useState<PayId | null>(null);
  const [id, setId] = useState(lic.id);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const gr = (lic as any).gumroad as { has: boolean; active: boolean; reason: string; last4: string } | undefined;
  const open = (url: string) => { if (url) window.electronAPI?.openExternal?.(url); };
  useEffect(() => { (async () => { try { const r = await window.electronAPI?.licenseRegister?.(); if (r?.id) setId(r.id); } catch {} })(); }, []);
  useEffect(() => { setMsg(null); }, [method]);
  const activate = async () => {
    if (!key.trim() || busy) return; setBusy(true); setMsg(null);
    try { const r = await (window.electronAPI as any)?.licenseGumroadActivate?.(key.trim()); if (r?.ok) { setMsg({ ok: true, t: 'Pro is on. Thank you!' }); setKey(''); await LicenseService.refresh(); } else setMsg({ ok: false, t: r?.error || 'Could not activate this key.' }); }
    catch { setMsg({ ok: false, t: 'Could not activate this key.' }); }
    setBusy(false);
  };
  const removeKey = async () => { setBusy(true); try { await (window.electronAPI as any)?.licenseGumroadRemove?.(); await LicenseService.refresh(); setMsg({ ok: true, t: 'The key was removed from this computer.' }); } catch {} setBusy(false); };

  const manual = PAY_METHODS.find(x => x.id === method);
  const mt = METHOD_TABS.find(t => t.id === method);   // Easypaisa / Crypto details
  const cardUrl = !method ? '' : method === 'kelviq' ? plan.kelviqUrl : method === 'gumroad' ? plan.gumroadUrl : '';
  const cardName = method === 'kelviq' ? 'Kelviq' : 'Gumroad';

  const KeyBox = (
    <div className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Already paid? Paste your licence key</h4>
      {gr?.has && gr.active ? (
        <div className="flex items-center justify-between gap-3 text-xs rounded-xl bg-[#09100d] border border-[#3f9a5a]/50 px-3 py-2.5"><span className="text-[#bef264] flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Pro is active (key ...{gr.last4})</span><Btn onClick={removeKey} disabled={busy} className="!py-1.5">Remove key</Btn></div>
      ) : (<>
        {gr?.has && !gr.active && <p className="text-[11px] text-amber-300">{gr.reason || 'This key is not active.'}</p>}
        <div className="flex gap-2"><input value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') activate(); }} placeholder="Paste your licence key here" spellCheck={false}
          className="flex-1 min-w-0 bg-[#0d1712] border border-[#1d3228] focus:border-[#3f9a5a] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none" />
          <Btn primary onClick={activate} disabled={busy || !key.trim()}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />} Activate</Btn></div>
      </>)}
      {msg && <p className={`text-[11px] ${msg.ok ? 'text-[#bef264]' : 'text-red-300'}`}>{msg.t}</p>}
    </div>
  );

  const stepLabels = ['Plan', 'Payment method', 'Pay'];
  return (
    <Overlay onClose={onClose} wide>
      <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer absolute right-4 top-4" title="Close"><X className="w-4 h-4" /></button>
      <div className="text-center space-y-1">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#d9f99d] to-[#65a30d] text-black flex items-center justify-center shadow-lg shadow-[#bef264]/20"><Gem className="w-6 h-6" /></div>
        <h3 className="text-lg font-extrabold text-white pt-1.5">ClipForge Pro</h3>
      </div>
      <div className="flex items-center justify-center gap-2">
        {stepLabels.map((l, i) => { const n = i + 1; const done = step > n; const on = step === n; return (
          <React.Fragment key={l}>
            {i > 0 && <span className={`h-px w-8 ${step >= n ? 'bg-[#3f9a5a]' : 'bg-[#1d3228]'}`} />}
            <div className="flex items-center gap-1.5"><span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${on ? 'bg-[#bef264] text-black' : done ? 'bg-[#3f9a5a] text-black' : 'bg-[#111e18] text-neutral-500 border border-[#1d3228]'}`}>{done ? <Check className="w-3 h-3" /> : n}</span><span className={`text-[11px] font-bold max-sm:hidden ${on ? 'text-white' : 'text-neutral-500'}`}>{l}</span></div>
          </React.Fragment>); })}
      </div>

      {step === 1 && (<>
        <h4 className="text-center text-sm font-bold text-white pt-1">Choose your plan</h4>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {PRO_PLANS.map(p => {
            const on = p.id === planId;
            return (
              <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                className={`relative text-left rounded-2xl border px-4 py-4 cursor-pointer transition-colors ${on ? 'bg-[#12201a] border-[#bef264] shadow-[0_0_0_1px_#bef264]' : 'bg-[#0d1712] border-[#1d3228] hover:border-[#3f9a5a]'}`}>
                {p.badge && <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-[#bef264] text-black text-[10px] font-extrabold">{p.badge}</span>}
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-neutral-200">{p.label}</span>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${on ? 'border-[#bef264] bg-[#bef264]' : 'border-neutral-600'}`}>{on && <Check className="w-3 h-3 text-black" />}</span></div>
                <div className="flex items-end gap-1 pt-2"><span className="text-3xl font-black text-white leading-none">${p.price}</span><span className="text-[11px] text-neutral-400 pb-0.5">{p.per}</span></div>
                <div className="text-[11px] text-neutral-500 pt-1">{p.note}</div>
              </button>
            );
          })}
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-[#09100d] border border-[#17291f] px-4 py-3">
          {PRO_HIGHLIGHTS.map(d => <li key={d} className="flex items-center gap-2 text-[11px] text-neutral-300"><Check className="w-3 h-3 text-[#bef264] shrink-0" /><span>{d}</span></li>)}
        </ul>
        <div className="flex justify-end pt-1"><Btn primary onClick={() => setStep(2)} className="!px-8">Next <ArrowRight className="w-3.5 h-3.5" /></Btn></div>
      </>)}

      {step === 2 && (<>
        <h4 className="text-center text-sm font-bold text-white pt-1">Choose how to pay <span className="text-[#bef264]">· {plan.label} ${plan.price}</span></h4>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {METHOD_TABS.map(x => (
            <button key={x.id} type="button" onClick={() => setMethod(x.id)}
              className={`px-4 py-4 rounded-2xl text-sm font-bold cursor-pointer border flex items-center gap-3 ${method === x.id ? 'bg-[#12201a] border-[#bef264] shadow-[0_0_0_1px_#bef264] text-white' : 'bg-[#0d1712] border-[#1d3228] text-neutral-300 hover:border-[#3f9a5a] hover:text-white'}`}><MethodIcon id={x.id} size={32} />{x.name}</button>
          ))}
        </div>
        <div className="flex justify-between pt-1"><Btn onClick={() => setStep(1)}><ArrowLeft className="w-3.5 h-3.5" /> Back</Btn><Btn primary disabled={!method} onClick={() => setStep(3)} className="!px-8">Next <ArrowRight className="w-3.5 h-3.5" /></Btn></div>
      </>)}

      {step === 3 && method && mt && (<>
        <div className="rounded-2xl bg-[#09100d] border border-[#17291f] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><MethodIcon id={method} size={32} /><div className="text-sm font-bold text-white">{mt.name}</div></div>
            <div className="text-right"><div className="text-sm font-extrabold text-[#bef264]">${plan.price} <span className="text-[11px] font-normal text-neutral-400">{plan.per}</span></div><div className="text-[10px] text-neutral-500">{plan.label} plan</div></div>
          </div>

          {manual && (<>
            {manual.lines.map(l => (
              <div key={l.label} className="flex items-center justify-between gap-3 text-xs"><span className="text-neutral-500">{l.label}</span><span className="flex items-center gap-2 text-neutral-100 font-mono break-all text-right">{l.value}<CopyBtn text={l.value} /></span></div>
            ))}
            <p className="text-[11px] text-amber-300/90">Amount to send: <b>${plan.price}</b> ({plan.label.toLowerCase()}). {manual.note}</p>
            <div className="border-t border-[#17291f] pt-3 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Your device ID (send it with the proof)</h4>
              <div className="rounded-xl bg-[#0d1712] border border-[#3f9a5a]/50 px-4 py-2.5 flex items-center justify-between gap-3"><span className="font-mono text-sm text-[#bef264] tracking-wider">{id || lic.id || '...'}</span><CopyBtn text={id || lic.id} /></div>
              <p className="text-[11px] text-neutral-500">Pro is switched on for this device after the payment is checked. It stays even if you reinstall ClipForge.</p>
              {!lic.configured && <p className="text-[11px] text-amber-300">The licence server is not set up in this build yet.</p>}
            </div>
            <div className="border-t border-[#17291f] pt-3 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">After paying, send the screenshot (proof) to</h4>
              {Object.values(CONTACTS).map(c => (
                <div key={c.label} className="flex items-center justify-between gap-3 rounded-xl bg-[#0d1712] border border-[#17291f] px-3 py-2">
                  <div>
                    <div className="text-xs font-bold text-white">{c.label}</div>
                    {c.url
                      ? <button type="button" onClick={() => open(c.url)} className="text-[11px] text-[#8fd0a4] hover:text-[#bef264] font-mono underline underline-offset-2 cursor-pointer flex items-center gap-1" title={`Open ${c.label}`}>{c.handle}<ExternalLink className="w-3 h-3" /></button>
                      : <div className="text-[11px] text-neutral-300 font-mono">{c.handle}</div>}
                  </div>
                  <div className="flex items-center gap-2"><CopyBtn text={c.handle} />{c.url && <Btn onClick={() => open(c.url)} className="!py-1.5">Send proof</Btn>}</div>
                </div>
              ))}
            </div>
          </>)}

          {!manual && (<>
            {cardUrl
              ? <Btn primary onClick={() => open(cardUrl)} className="w-full !py-3 !text-sm"><ExternalLink className="w-4 h-4" /> Pay with {cardName} · ${plan.price} {plan.per}</Btn>
              : <p className="text-[11px] text-amber-300 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">Card checkout for the {plan.label.toLowerCase()} plan on {cardName} is not ready yet. Go back and choose the monthly plan, or pay with Easypaisa or crypto.</p>}
            <p className="text-[11px] text-neutral-500 text-center">Secure checkout by {cardName}. After paying you get a licence key by email.</p>
            <div className="border-t border-[#17291f] pt-3">{KeyBox}</div>
          </>)}
        </div>
        <div className="flex justify-between pt-1"><Btn onClick={() => setStep(2)}><ArrowLeft className="w-3.5 h-3.5" /> Back</Btn><Btn primary onClick={() => { LicenseService.refresh(); onClose(); }} className="!px-8">Done</Btn></div>
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
      {features.map(f => <li key={f} className="flex items-center gap-2 text-xs text-neutral-100"><Gem className="w-3.5 h-3.5 text-[#bef264] shrink-0" />{f}</li>)}
    </ul>
    <p className="text-[11px] text-neutral-400">Turn these off, or get Pro to use them. You can still preview them in the studio.</p>
    <div className="flex justify-between gap-2 pt-1"><Btn onClick={() => { onClose(); LicenseService.openBuy(); }}><Gem className="w-3.5 h-3.5" /> Get Pro</Btn><Btn primary onClick={onClose}>Cancel</Btn></div>
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
