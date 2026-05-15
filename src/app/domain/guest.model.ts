import { LoyaltyTier } from './enums';

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  idType: 'passport' | 'national_id' | 'driver_license';
  idNumber: string;
  idPhotoUrl?: string;
  dateOfBirth?: Date;
  address?: string;
  isVip: boolean;
  loyaltyTier?: LoyaltyTier;
  loyaltyPoints: number;
  preferences: GuestPreferences;
  tags: string[];           // ['Allergic to nuts','Late checkout requested']
  notes?: string;
  totalStays: number;
  totalSpent: number;
  lastStayDate?: Date;
  createdAt: Date;
}

export interface GuestPreferences {
  preferredRoomType?: string;
  preferredFloor?: 'low' | 'mid' | 'high';
  preferredBed?: 'king' | 'queen' | 'twin';
  smokingPreference: boolean;
  dietary: string[];        // ['Vegetarian','Gluten-free']
  newspaper?: string;
  wakeUpCall?: string;      // '07:00'
}
