export interface Property {
  id: string;
  name: string;
  brand?: string;
  city: string;
  country: string;
  address: string;
  starRating: 3 | 4 | 5;
  timezone: string;
  currency: string;
  taxRate: number;       // 0.18 = 18%
  checkInTime: string;   // '14:00'
  checkOutTime: string;  // '11:00'
  photoUrl?: string;
  totalRooms: number;
  createdAt: Date;
}
