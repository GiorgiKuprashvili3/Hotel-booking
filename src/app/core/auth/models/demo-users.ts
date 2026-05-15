import { Role } from '../../../domain/enums';
import { AuthUser } from './auth-user.model';

export const DEMO_USERS: Record<Role, AuthUser> = {
  [Role.Admin]: {
    id: 'staff-admin',
    firstName: 'Elena',
    lastName: 'Morozova',
    email: 'elena.morozova@luxstay.demo',
    role: Role.Admin,
    propertyIds: ['prop-1', 'prop-2', 'prop-3'],
  },
  [Role.Manager]: {
    id: 'staff-mgr',
    firstName: 'Henri',
    lastName: 'Beaumont',
    email: 'henri.beaumont@luxstay.demo',
    role: Role.Manager,
    propertyIds: ['prop-1', 'prop-2'],
  },
  [Role.Receptionist]: {
    id: 'staff-rec',
    firstName: 'Sofia',
    lastName: 'Chen',
    email: 'sofia.chen@luxstay.demo',
    role: Role.Receptionist,
    propertyIds: ['prop-1'],
  },
  [Role.Housekeeper]: {
    id: 'staff-hsk',
    firstName: 'Mateo',
    lastName: 'Diaz',
    email: 'mateo.diaz@luxstay.demo',
    role: Role.Housekeeper,
    propertyIds: ['prop-1'],
  },
  [Role.Accountant]: {
    id: 'staff-acc',
    firstName: 'Aiko',
    lastName: 'Tanaka',
    email: 'aiko.tanaka@luxstay.demo',
    role: Role.Accountant,
    propertyIds: ['prop-1', 'prop-2'],
  },
};
