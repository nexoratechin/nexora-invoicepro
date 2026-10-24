/** GST state codes used for place of supply. */
export const GST_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
} as const;

export type GstStateCode = keyof typeof GST_STATE_CODES;

export const GST_STATE_CODE_LIST: { code: string; name: string }[] = Object.entries(
  GST_STATE_CODES,
).map(([code, name]) => ({ code, name }));

/** Standard GST slabs in basis points: 0%, 5%, 12%, 18%, 28%. */
export const GST_SLABS_BP = [0, 500, 1200, 1800, 2800] as const;

export const DEFAULT_TAX_RATE_BP = 1800;
export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_INVOICE_PREFIX = 'NXP';
export const DEFAULT_PAYMENT_TERMS_DAYS = 15;
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export const INVOICE_STATUSES = ['draft', 'issued', 'void'] as const;
export const PAYMENT_STATES = ['unpaid', 'partial', 'paid'] as const;
export const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'] as const;
export const MEMBERSHIP_ROLES = ['owner', 'admin', 'staff'] as const;
export const CUSTOMER_STATUSES = ['active', 'archived'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type PaymentState = (typeof PAYMENT_STATES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
};
