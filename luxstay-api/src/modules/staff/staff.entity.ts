import { Entity, Column, BeforeInsert, BeforeUpdate } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiProperty } from '@nestjs/swagger';
import { AbstractEntity } from '../../common/entities/abstract.entity';
import { Role } from '../../common/enums';

@Entity('staff')
export class StaffEntity extends AbstractEntity {
  @ApiProperty()
  @Column()
  firstName: string;

  @ApiProperty()
  @Column()
  lastName: string;

  @ApiProperty()
  @Column({ unique: true })
  email: string;

  @Column({ select: false }) // never returned in queries by default
  password: string;

  @ApiProperty()
  @Column({ nullable: true })
  phone: string;

  @ApiProperty({ enum: Role })
  @Column({ type: 'enum', enum: Role })
  role: Role;

  @ApiProperty()
  @Column('text', { array: true, default: [] })
  propertyIds: string[];

  @ApiProperty()
  @Column({ nullable: true })
  avatarUrl: string;

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty()
  @Column({ type: 'timestamptz' })
  hiredAt: Date;

  @ApiProperty()
  @Column({ nullable: true })
  shift: string;

  @ApiProperty()
  @Column('text', { array: true, default: [] })
  languages: string[];

  @ApiProperty()
  @Column({ nullable: true, type: 'text' })
  notes: string;

  @ApiProperty()
  @Column({ nullable: true })
  inviteStatus: string; // 'pending' | 'accepted'

  @ApiProperty()
  @Column({ nullable: true, type: 'timestamptz' })
  invitedAt: Date;

  @ApiProperty()
  @Column({ nullable: true })
  invitedBy: string;

  // Refresh token stored hashed
  @Column({ nullable: true, select: false })
  refreshToken: string;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async validatePassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.password);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
