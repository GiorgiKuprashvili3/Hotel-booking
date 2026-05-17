import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatePlanEntity } from './rate-plan.entity';
import { RatePlansService } from './rate-plans.service';
import { RatePlansController } from './rate-plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RatePlanEntity])],
  providers: [RatePlansService],
  controllers: [RatePlansController],
  exports: [RatePlansService], // ReservationsModule will use this
})
export class RatePlansModule {}
