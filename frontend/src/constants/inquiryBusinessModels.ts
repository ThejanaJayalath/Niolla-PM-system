/** Allowed values for prospect / inquiry business model (keep in sync with backend). */
export const INQUIRY_BUSINESS_MODEL_VALUES = [
  'ERP',
  'POS',
  'Inventory',
  'E-commerce',
  'Restaurant / F&B',
  'Website',
  'Mobile App',
  'Custom',
  'Other',
] as const;

export type InquiryBusinessModel = (typeof INQUIRY_BUSINESS_MODEL_VALUES)[number];
