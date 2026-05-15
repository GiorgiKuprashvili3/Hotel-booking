import { Role } from '../../../domain/enums';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  propertyIds: string[];
  avatarUrl?: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;          // fake JWT for now; shape matches real impl
  refreshToken: string;
  expiresAt: number;      // epoch ms
}
