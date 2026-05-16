import { AuditAction, AuditEntityType } from './enums';

export interface AuditLog {
  id: string;
  entityType: AuditEntityType | string;
  entityId: string;
  action: AuditAction | string;
  userId: string;           // staff id who performed the action
  details?: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Date;
}
