export interface ProjectTask {
  _id?: string;
  projectId: string;
  /** Optional link to a software requirement on the same project. */
  requirementId?: string;
  /** When created from an update ticket assignment. */
  updateTicketId?: string;
  title: string;
  description?: string;
  assigneeIds: string[];
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  /** Populated in API responses */
  projectName?: string;
  requirementTitle?: string;
  ticketId?: string;
}
