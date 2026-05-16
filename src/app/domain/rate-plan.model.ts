export interface RatePlan {
  id: string;
  name: string;
  code: string;
  description?: string;
  isRefundable: boolean;
  cancellationHours: number;   // free cancellation up to N hours before arrival
  depositPct: number;          // deposit % required at booking (0–100)
  isActive: boolean;
}

export interface PropertySettings {
  theme: 'light' | 'dark';
  defaultPropertyId: string;
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  notifications: {
    newReservation: boolean;
    checkInReminder: boolean;
    maintenanceAlert: boolean;
    housekeepingComplete: boolean;
    lowOccupancyAlert: boolean;
    lowOccupancyThreshold: number;
  };
  dashboard: {
    defaultView: string;
    kpiCards: string[];
    refreshIntervalSeconds: number;
  };
}
