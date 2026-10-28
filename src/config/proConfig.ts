// Everything the buyer sees in the "Buy Pro" window comes from this file.
export const PRO_PLAN_NAME = 'Monthly';
export const PRO_PRICE_USD = 5;                 // shown big in the Buy Pro window
export const PRO_PERIOD = 'per month';
export const PRO_DETAILS = [
  'AI Boost: AI-picked moments, titles, hooks, descriptions and translated captions',
  'Dynamic captions: 40+ animated styles, including the word behind the speaker',
  'AI Auto Hook: a hook title on every clip',
  'Auto sound and visual effects (SFX / VFX)',
  'Custom framing (your own zoom and position)',
  'AI Auto-Reframing: follows the speaker\'s face',
  'Split / dual screen layout',
  'Export sizes above 1080p (1440p and 4K)',
  'Works on this device. 30 days of access.',
];

export interface PayMethod { id: string; name: string; kind: 'easypaisa' | 'crypto'; lines: { label: string; value: string }[]; note?: string }
export const PAY_METHODS: PayMethod[] = [
  { id: 'easypaisa', name: 'Easypaisa', kind: 'easypaisa',
    lines: [{ label: 'Account name', value: 'Rashida begum' }, { label: 'Easypaisa number', value: '03195094240' }],
    note: 'Plan price: $5 per month. Send the equivalent amount in PKR.' },
  { id: 'crypto', name: 'Crypto (SOL)', kind: 'crypto',
    lines: [{ label: 'Coin', value: 'SOL (Solana)' }, { label: 'Wallet address', value: '8qSAHJsiy3A4MDFqqbz5XetW47NmQLmu4rk4JLPCfvPu' }],
    note: 'Plan price: $5 per month. Send SOL on the Solana network only. Anything sent on another network is lost.' },
];

// Where the buyer sends the payment proof. Leave a link empty ('') to hide that button.
export const CONTACTS = {
  whatsapp: { label: 'WhatsApp', handle: '+92 317 0322042', url: 'https://wa.me/923170322042' },
  instagram: { label: 'Instagram', handle: '@taha.ai.editor', url: 'https://www.instagram.com/taha.ai.editor/' },
  discord: { label: 'Discord', handle: 'evil_technoblade', url: '' },     // a Discord username has no direct link: it is copied instead
};

// ---- Pro switches. PRO_ENFORCED is ON (the Pro system is live). The 7-day trial is ON for every device (it starts on that device's first launch of this version). ----
// PRO_ENFORCED = true  -> the Pro system starts: Pro tags, Buy Pro button, locking after the trial.
// TRIAL_ENABLED = true -> (needs PRO_ENFORCED) every device gets a 7-day trial that starts on its first launch of that build.
export const PRO_ENFORCED = true;
export const TRIAL_ENABLED = true;
export const TRIAL_DAYS = 7;

// The features that need Pro (during the trial and with Pro they all work; after the trial they can be previewed but not rendered).
export const PRO_FEATURES: Record<string, string> = {
  dynamicCaptions: 'Dynamic captions',
  split: 'Split / dual screen',
  customFormat: 'Custom framing',
  autoHook: 'AI Auto Hook',
  fx: 'Sound & visual effects (SFX / VFX)',
  autoReframe: 'AI Auto-Reframing',
  ai: 'AI Boost',
  highRes: 'Export above 1080p',
};
