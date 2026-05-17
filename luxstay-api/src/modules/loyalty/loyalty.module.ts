import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyLedgerEntity } from './loyalty-ledger.entity';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { GuestEntity } from '../guests/guest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoyaltyLedgerEntity, GuestEntity])],
  providers: [LoyaltyService],
  controllers: [LoyaltyController],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
