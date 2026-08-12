import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { MessageLogService } from '@application/message_log_module/message-log.service';
import { PaginationQueryDto, Paginated } from '@api/dto/shared/pagination';

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class GlobalMessageLogController {
  constructor(private readonly logs: MessageLogService) {}

  @Get('messaging/logs')
  @ApiOperation({ summary: 'Listar logs de mensagens de todos os eventos do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs com evento' })
  async findLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.logs.listForUser(user.id, page, limit);
    return { data, total, page, limit };
  }
}
