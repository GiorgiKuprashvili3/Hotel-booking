import {
  ConciergeRequestType, ConciergeStatus,
  HousekeepingStatus, MaintenancePriority, MaintenanceStatus,
  Role, Permission,
} from './enums';

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  propertyIds: string[];
  avatarUrl?: string;
  isActive: boolean;
  hiredAt: Date;
  shift?: 'day' | 'evening' | 'night';
  languages?: string[];
  notes?: string;
  /** Pending invite: staff created but not yet accepted */
  inviteStatus?: 'pending' | 'accepted';
  invitedAt?: Date;
  invitedBy?: string;          // staff id
}

export interface RolePermissionMatrix {
  [role: string]: Permission[];
}

/** Default RBAC — overrideable per property in a real backend. */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  [Role.Admin]: [
    Permission.ViewReservations, Permission.ManageReservations,
    Permission.ViewGuests,       Permission.ManageGuests,
    Permission.ViewHousekeeping, Permission.ManageHousekeeping,
    Permission.ViewMaintenance,  Permission.ManageMaintenance,
    Permission.ViewFinance,      Permission.ManageFinance,
    Permission.ViewStaff,        Permission.ManageStaff,
  ],
  [Role.Manager]: [
    Permission.ViewReservations, Permission.ManageReservations,
    Permission.ViewGuests,       Permission.ManageGuests,
    Permission.ViewHousekeeping, Permission.ManageHousekeeping,
    Permission.ViewMaintenance,  Permission.ManageMaintenance,
    Permission.ViewFinance,
    Permission.ViewStaff,
  ],
  [Role.Receptionist]: [
    Permission.ViewReservations, Permission.ManageReservations,
    Permission.ViewGuests,       Permission.ManageGuests,
    Permission.ViewHousekeeping,
    Permission.ViewMaintenance,
  ],
  [Role.Housekeeper]: [
    Permission.ViewHousekeeping, Permission.ManageHousekeeping,
    Permission.ViewMaintenance,  Permission.ManageMaintenance,
  ],
  [Role.Accountant]: [
    Permission.ViewReservations,
    Permission.ViewGuests,
    Permission.ViewFinance,      Permission.ManageFinance,
  ],
};

export interface HousekeepingTask {
  id: string;
  propertyId: string;
  roomId: string;
  assignedTo?: string;
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
  roomId?: string;
  location?: string;
  reportedBy: string;
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
  estimatedCost?: number;
  actualCost?: number;
  guestRating?: number;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  recipientStaffId?: string;
  type: 'reservation' | 'task' | 'maintenance' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  link?: string;
}
