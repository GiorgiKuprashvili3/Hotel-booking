/**
 * Demo login personas — IDs and details match the seed JSON exactly
 * (staff-1…staff-5). When the real backend ships, replace loginAsDemo()
 * in auth.service.ts with a real /auth/login call.
 */
import { Role } from '../../../domain/enums';
import { AuthUser } from './auth-user.model';

export const DEMO_USERS: Record<Role, AuthUser> = {
  [Role.Admin]: {
    id: 'staff-1',
    firstName: 'Elena',
    lastName: 'Morozova',
    email: 'elena.morozova@luxstay.demo',
    role: Role.Admin,
    propertyIds: ['prop-1', 'prop-2', 'prop-3'],
  },
  [Role.Manager]: {
    id: 'staff-2',
    firstName: 'Henri',
    lastName: 'Beaumont',
    email: 'henri.beaumont@luxstay.demo',
    role: Role.Manager,
    propertyIds: ['prop-1', 'prop-2', 'prop-3'],
  },
  [Role.Receptionist]: {
    id: 'staff-3',
    firstName: 'Sofia',
    lastName: 'Chen',
    email: 'sofia.chen@luxstay.demo',
    role: Role.Receptionist,
    propertyIds: ['prop-3'],
  },
  [Role.Housekeeper]: {
    id: 'staff-4',
    firstName: 'Mateo',
    lastName: 'Diaz',
    email: 'mateo.diaz@luxstay.demo',
    role: Role.Housekeeper,
    propertyIds: ['prop-1'],
  },
  [Role.Accountant]: {
    id: 'staff-5',
    firstName: 'Aiko',
    lastName: 'Tanaka',
    email: 'aiko.tanaka@luxstay.demo',
    role: Role.Accountant,
    propertyIds: ['prop-2'],
  },
};
