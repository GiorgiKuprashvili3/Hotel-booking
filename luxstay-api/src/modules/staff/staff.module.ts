import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffEntity } from './staff.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StaffEntity])],
  providers: [StaffService],
  controllers: [StaffController],
  exports: [StaffService], // exported so AuthModule can use it
})
export class StaffModule {}
