import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConciergeRequestEntity } from './concierge-request.entity';
import { ConciergeService } from './concierge.service';
import { ConciergeController } from './concierge.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConciergeRequestEntity])],
  providers: [ConciergeService],
  controllers: [ConciergeController],
  exports: [ConciergeService],
})
export class ConciergeModule {}
