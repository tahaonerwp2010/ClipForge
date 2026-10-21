// Everything the buyer sees in the "Buy Pro" window comes from this file.
export const PRO_PLAN_NAME = 'Monthly';
export const PRO_PRICE_USD = 5;                 // shown big in the Buy Pro window
export const PRO_PERIOD = 'per month';
export const PRO_DETAILS = [
  'Dynamic captions: 40+ animated styles, including the word behind the speaker',
  'Split / dual screen layout',
  'Custom framing (your own scale and position) in the studio',
  'AI Auto Hook: a hook title on every clip',
  'Auto sound and visual effects (SFX / VFX)',
  'Works on this device. 30 days of access.',
];

export interface PayMethod { id: string; name: string; lines: { label: string; value: string }[]; note?: string }
export const PAY_METHODS: PayMethod[] = [
  { id: 'easypaisa', name: 'Easypaisa', lines: [{ label: 'Account name', value: 'YOUR NAME' }, { label: 'Number', value: '03XX-XXXXXXX' }] },
  { id: 'bank', name: 'Bank account', lines: [{ label: 'Bank', value: 'YOUR BANK' }, { label: 'Account title', value: 'YOUR NAME' }, { label: 'Account number', value: 'XXXXXXXXXXXX' }, { label: 'IBAN', value: 'PKXX XXXX XXXX XXXX XXXX XXXX' }] },
];

// Where the buyer sends the payment proof. Leave a link empty ('') to hide that button.
export const CONTACTS = {
  discord: { label: 'Discord', handle: 'your_discord_name', url: '' },
  whatsapp: { label: 'WhatsApp', handle: '+92 3XX XXXXXXX', url: 'https://wa.me/923XXXXXXXXX' },
  instagram: { label: 'Instagram', handle: '@your_instagram', url: 'https://www.instagram.com/your_instagram/' },
};

// ---- Pro switches (both are OFF: right now everybody can use everything and nothing about Pro is shown) ----
// PRO_ENFORCED = true  -> the Pro system starts: Pro tags, Buy Pro button, locking after the trial.
// TRIAL_ENABLED = true -> (needs PRO_ENFORCED) every device gets a 7-day trial that starts on its first launch of that build.
export const PRO_ENFORCED = false;
export const TRIAL_ENABLED = false;
export const TRIAL_DAYS = 7;

// The features that need Pro (during the trial and with Pro they all work; after the trial they can be previewed but not rendered).
export const PRO_FEATURES: Record<string, string> = {
  dynamicCaptions: 'Dynamic captions',
  split: 'Split / dual screen',
  customFormat: 'Custom framing',
  autoHook: 'AI Auto Hook',
  fx: 'Sound & visual effects (SFX / VFX)',
};
