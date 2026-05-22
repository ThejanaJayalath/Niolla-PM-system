export type BirthdaySubjectType = 'customer' | 'employee' | 'inquiry';

export interface BirthdayPerson {
  subjectType: BirthdaySubjectType;
  subjectId: string;
  name: string;
  email?: string;
  phone?: string;
  roleLabel: string;
  dateOfBirth: string;
  latestCardId?: string;
  latestCardImageUrl?: string;
  lastSentAt?: string;
  lastSentChannel?: 'email' | 'whatsapp';
}

export interface BirthdayCardRecord {
  _id?: string;
  subjectType: BirthdaySubjectType;
  subjectId: string;
  personName: string;
  fileName: string;
  mimeType: string;
  greetingMessage: string;
  aiGenerated: boolean;
  sentAt?: Date;
  sentChannel?: 'email' | 'whatsapp';
  createdAt?: Date;
}
