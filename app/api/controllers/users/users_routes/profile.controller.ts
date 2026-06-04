import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { PrismaService } from '@database/prisma/prisma.service';
import { UpdateProfileDto } from '../users_dto/profile.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      include: { roles: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.profile.update({
      where: { userId: user.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.evolutionInstance !== undefined && { evolutionInstance: dto.evolutionInstance }),
        ...(dto.evolutionToken !== undefined && { evolutionToken: dto.evolutionToken }),
      },
    });
  }

  @Post('ensure')
  async ensureProfile(@CurrentUser() user: AuthenticatedUser) {
    const existing = await this.prisma.profile.findUnique({
      where: { userId: user.id },
      include: { roles: true },
    });
    if (existing) return existing;

    return this.prisma.profile.create({
      data: {
        userId: user.id,
        name: user.email.split('@')[0],
        email: user.email,
        roles: {
          create: [{ role: 'organizer' }],
        },
      },
      include: { roles: true },
    });
  }
}
