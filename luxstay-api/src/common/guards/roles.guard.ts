import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY } from '../decorators/roles.decorator';
import { Role, Permission, ROLE_PERMISSIONS } from '../enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No restrictions on this route
    if (!requiredRoles && !requiredPermissions) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No authenticated user');

    const userPermissions: Permission[] = ROLE_PERMISSIONS[user.role as Role] ?? [];

    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Role '${user.role}' is not allowed`);
    }

    if (requiredPermissions) {
      const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));
      if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
