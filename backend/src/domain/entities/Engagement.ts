export type FestivalKey = 'new_year' | 'christmas' | 'vesak' | 'deepavali' | 'general';

export interface AnniversaryTodayRow {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  email?: string;
  phone?: string;
  milestoneDate: string;
  latestCardId?: string;
  latestCardImageUrl?: string;
  lastSentAt?: string;
  lastSentChannel?: 'email' | 'whatsapp';
}

export interface FestivalProspectRow {
  inquiryId: string;
  customerName: string;
  phoneNumber: string;
  email?: string;
  status: string;
}

export interface EngagementStatRow {
  subjectType: string;
  subjectId: string;
  personName: string;
  sends: number;
  responses: number;
  responseRate: number;
  lastSentAt?: string;
  campaignTypes: string[];
}

export interface EngagementRecentRow {
  cardId: string;
  personName: string;
  campaignType: string;
  sentAt: string;
  sentChannel?: 'email' | 'whatsapp';
  respondedAt?: string;
  subjectType: string;
}

export interface EngagementOverview {
  summary: {
    totalSends: number;
    totalReplies: number;
    responseRate: number;
    awaitingReply: number;
  };
  leaderboard: EngagementStatRow[];
  recent: EngagementRecentRow[];
}
