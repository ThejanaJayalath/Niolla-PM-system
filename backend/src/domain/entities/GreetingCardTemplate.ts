export type GreetingTemplateType = 'birthday' | 'anniversary' | 'festival';

export interface GreetingCardTemplate {
  _id?: string;
  templateType: GreetingTemplateType;
  /** For festival templates — e.g. new_year, christmas. Omit for a shared festival fallback. */
  festivalKey?: string;
  fileName: string;
  mimeType: string;
  storedFileName: string;
  uploadedAt: Date;
  uploadedBy?: string;
}
