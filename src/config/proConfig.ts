// Fill in your own details here. Everything the buyer sees in the "Buy Pro" window comes from this file.
export const PRO_PRICE = 'Price: set it in src/config/proConfig.ts';   // e.g. 'PKR 3,000 (one time)'

export interface PayMethod { id: string; name: string; lines: { label: string; value: string }[]; note?: string }
export const PAY_METHODS: PayMethod[] = [
  { id: 'easypaisa', name: 'Easypaisa', lines: [{ label: 'Account name', value: 'YOUR NAME' }, { label: 'Number', value: '03XX-XXXXXXX' }] },
  { id: 'jazzcash', name: 'JazzCash', lines: [{ label: 'Account name', value: 'YOUR NAME' }, { label: 'Number', value: '03XX-XXXXXXX' }] },
  { id: 'bank', name: 'Bank transfer', lines: [{ label: 'Bank', value: 'YOUR BANK' }, { label: 'Account title', value: 'YOUR NAME' }, { label: 'Account number', value: 'XXXXXXXXXXXX' }, { label: 'IBAN', value: 'PKXX XXXX XXXX XXXX XXXX XXXX' }] },
  { id: 'crypto', name: 'Crypto', lines: [{ label: 'Coin / network', value: 'USDT (TRC20)' }, { label: 'Address', value: 'YOUR_WALLET_ADDRESS' }], note: 'Send only on the network shown above.' },
];

// Where the buyer sends the payment proof. Leave a link empty ('') to hide that button.
export const CONTACTS = {
  discord: { label: 'Discord', handle: 'your_discord_name', url: '' },
  whatsapp: { label: 'WhatsApp', handle: '+92 3XX XXXXXXX', url: 'https://wa.me/923XXXXXXXXX' },
  instagram: { label: 'Instagram', handle: '@your_instagram', url: 'https://www.instagram.com/your_instagram/' },
};
