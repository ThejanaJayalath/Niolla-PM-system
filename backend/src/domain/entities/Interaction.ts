export type InteractionType = 'CALL' | 'MEETING' | 'NOTE' | 'STATUS_CHANGE' | 'REQUIREMENT_UPDATE';
export type CallDirection = 'INBOUND' | 'OUTBOUND';
export type CallOutcome = 'ANSWERED' | 'NO_ANSWER' | 'VOICEMAIL' | 'FOLLOW_UP_REQUIRED' | 'CLOSED';

export interface CallMeta {
  direction?: CallDirection;
  durationSec?: number;
  outcome?: CallOutcome;
  nextFollowUpAt?: Date;
}

export interface Interaction {
  _id?: string;
  customerRef: string;
  inquiryRef?: string;
  type: InteractionType;
  summary: string;
  details?: string;
  occurredAt: Date;
  createdBy?: string;
  callMeta?: CallMeta;
  createdAt?: Date;
  updatedAt?: Date;
}
