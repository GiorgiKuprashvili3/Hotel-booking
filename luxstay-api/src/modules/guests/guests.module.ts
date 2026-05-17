import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestEntity } from './guest.entity';
import { GuestsService } from './guests.service';
import { GuestsController } from './guests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GuestEntity])],
  providers: [GuestsService],
  controllers: [GuestsController],
  exports: [GuestsService], // ReservationsModule will use this
})
export class GuestsModule {}
