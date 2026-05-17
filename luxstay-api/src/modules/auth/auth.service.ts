import {
  Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { StaffService } from '../staff/staff.service';
import { LoginDto, RefreshTokenDto } from './auth.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const staff = await this.staffService.getByEmail(dto.email);

    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, staff.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // generateTokens() hashes and persists the refresh token internally —
    // do NOT call saveRefreshToken here again or it overwrites the hash with plaintext.
    const tokens = await this.generateTokens(staff.id, staff.email, staff.role);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        propertyIds: staff.propertyIds,
        avatarUrl: staff.avatarUrl,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const staff = await this.staffService.getByEmail(payload.email);
      if (!staff || !staff.refreshToken) {
        throw new UnauthorizedException('Refresh token invalid');
      }

      const tokenMatch = await bcrypt.compare(
        dto.refreshToken,
        staff.refreshToken,
      );
      if (!tokenMatch) throw new UnauthorizedException('Refresh token invalid');

      // generateTokens() hashes and persists the new refresh token internally.
      const tokens = await this.generateTokens(staff.id, staff.email, staff.role);

      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token expired or invalid');
    }
  }

  async logout(staffId: string) {
    await this.staffService.clearRefreshToken(staffId);
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(id: string, email: string, role: string) {
    const payload: JwtPayload = { sub: id, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    // Store refresh token hashed
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.staffService.saveRefreshToken(id, hashedRefresh);

    return { accessToken, refreshToken };
  }
}
