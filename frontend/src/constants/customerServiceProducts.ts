/** Stored on customer `serviceCategories[]` — aligned with NIOLLA NEXA product lines. */
export const SOFTWARE_PRODUCT_OPTIONS = [
  { value: 'POS', label: 'POS' },
  { value: 'ERP', label: 'ERP' },
  { value: 'Website', label: 'Website' },
  { value: 'Mobile App', label: 'Mobile App' },
  { value: 'E-Commerce', label: 'E-Commerce' },
  { value: 'CRM', label: 'CRM' },
  { value: 'Custom Software', label: 'Custom Software' },
  { value: 'Other', label: 'Other' },
] as const;

export type SoftwareProductValue = (typeof SOFTWARE_PRODUCT_OPTIONS)[number]['value'];
