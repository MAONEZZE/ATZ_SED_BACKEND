import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UazapiInstancesRepository } from '@modules/uazapi-instances/uazapi-instances.repository';
import { UazapiAdapter } from '@infra/integrations/uazapi.adapter';

@Injectable()
export class UazapiInstancesService {
  constructor(
    private readonly repo: UazapiInstancesRepository,
    private readonly config: ConfigService,
    private readonly uazapi: UazapiAdapter,
  ) {}

  // `active` reflete a conexão real: GET /instance/status na Uazapi; conectado
  // quando status === 'connected'. Consulta por instância em paralelo e tolerante
  // a falha por item (offline/erro → active:false, sem derrubar a listagem).
  async list() {
    const rows = await this.repo.list();
    return Promise.all(
      rows.map(async ({ token, ...rest }) => {
        let active = false;
        if (token && token.trim()) {
          try {
            active = (await this.uazapi.getInstanceStatus(token)) === 'connected';
          } catch {
            active = false;
          }
        }
        return { ...rest, active };
      }),
    );
  }

  async getToken(id: string): Promise<string> {
    const token = await this.repo.findTokenById(id);
    if (!token) throw new NotFoundException('Uazapi instance token not found');
    return token;
  }

  // Registra na Uazapi o webhook de status de entrega apontando para esta app.
  async registerWebhook(id: string): Promise<{ url: string }> {
    const token = await this.getToken(id);
    const base = this.config.get<string>('APP_PUBLIC_URL')!;
    const secret = this.config.get<string>('UAZAPI_WEBHOOK_SECRET')!;
    const url = `${base.replace(/\/$/, '')}/public/webhooks/uazapi?secret=${encodeURIComponent(secret)}`;
    await this.uazapi.setWebhook(token, url, ['messages_update']);
    return { url };
  }
}
