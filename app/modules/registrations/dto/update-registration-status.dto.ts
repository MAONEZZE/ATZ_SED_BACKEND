import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FunnelStatus } from '@modules/registrations/entities/registration.entity';

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    enum: ['pending', 'approved', 'rejected'],
    example: 'approved',
  })
  @IsEnum(['pending', 'approved', 'rejected'])
  status!: FunnelStatus;
}
