export interface Project {
  _id?: string;
  clientId: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  startDate?: Date;
  endDate?: Date;
  assignedEmployees?: string[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}
