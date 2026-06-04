import {
  Controller, Get, Patch,
  Param, Body, UseGuards, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';
import { UpdateLandingSectionDto } from '../landing_dto/landing.dto';

@Controller('events/:eventId/landing')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class LandingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findOne(@Param('eventId') eventId: string) {
    const landing = await this.prisma.landingPage.findUnique({
      where: { eventId },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    });
    if (!landing) throw new NotFoundException('Landing page not found');
    return landing;
  }

  @Patch('sections/:sectionId')
  async updateSection(
    @Param('eventId') eventId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateLandingSectionDto,
  ) {
    // Verify section belongs to this event's landing page
    const section = await this.prisma.landingSection.findFirst({
      where: {
        id: sectionId,
        landingPage: { eventId },
      },
    });
    if (!section) throw new NotFoundException('Landing section not found');

    return this.prisma.landingSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.content !== undefined && { content: dto.content != null ? (dto.content as Prisma.InputJsonValue) : Prisma.JsonNull }),
      },
    });
  }
}
