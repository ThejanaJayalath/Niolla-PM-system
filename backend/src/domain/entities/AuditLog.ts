export interface AuditLog {
  _id?: string;
  userId: string;
  action: string;
  tableName: string;
  recordId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  createdAt?: Date;
}
