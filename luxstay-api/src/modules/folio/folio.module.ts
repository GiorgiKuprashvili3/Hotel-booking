import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FolioEntity } from './folio.entity';
import { FolioItemEntity } from './folio-item.entity';
import { ReservationEntity } from '../reservations/reservation.entity';
import { FolioService } from './folio.service';
import { FolioController } from './folio.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FolioEntity,
      FolioItemEntity,
      ReservationEntity,
    ]),
  ],
  providers: [FolioService],
  controllers: [FolioController],
  exports: [FolioService],
})
export class FolioModule {}
