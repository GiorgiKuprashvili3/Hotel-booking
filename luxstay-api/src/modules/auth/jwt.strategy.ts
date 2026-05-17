import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { StaffService } from '../staff/staff.service';

export interface JwtPayload {
  sub: string;   // staff id
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly staffService: StaffService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const staff = await this.staffService.getById(payload.sub);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Account is inactive or not found');
    }
    // Returned object is attached to request.user
    return { id: staff.id, email: staff.email, role: staff.role };
  }
}
