import {
  ConciergeRequestType, ConciergeStatus,
  HousekeepingStatus, MaintenancePriority, MaintenanceStatus,
  Role,
} from './enums';

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  propertyIds: string[];       // a staffer can be assigned to multiple props
  avatarUrl?: string;
  isActive: boolean;
  hiredAt: Date;
}

export interface HousekeepingTask {
  id: string;
  propertyId: string;
  roomId: string;
  assignedTo?: string;         // staff id
  status: HousekeepingStatus;
  priority: 'low' | 'normal' | 'high';
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;
  inspectedAt?: Date;
  inspectedBy?: string;
  notes?: string;
  durationMinutes?: number;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  roomId?: string;             // optional — could be common area
  location?: string;           // 'Pool deck', 'Lobby'
  reportedBy: string;          // staff id
  assignedTo?: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'other';
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string;
  reportedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface ConciergeRequest {
  id: string;
  propertyId: string;
  reservationId: string;
  guestId: string;
  roomId?: string;
  type: ConciergeRequestType;
  status: ConciergeStatus;
  details: string;
  scheduledFor?: Date;
  requestedAt: Date;
  completedAt?: Date;
  assignedTo?: string;
}

export interface NotificationItem {
  id: string;
  recipientStaffId?: string;
  type: 'reservation' | 'task' | 'maintenance' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  link?: string;               // route to navigate on click
}
