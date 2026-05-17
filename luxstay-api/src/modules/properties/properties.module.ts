import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyEntity } from './property.entity';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PropertyEntity])],
  providers: [PropertiesService],
  controllers: [PropertiesController],
  exports: [PropertiesService], // other modules will scope queries by propertyId
})
export class PropertiesModule {}
