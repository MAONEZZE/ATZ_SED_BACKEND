import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappInstancesRepository } from '@modules/whatsapp-instances/whatsapp-instances.repository';
import { WhatsappAdapter } from '@infra/integrations/whatsapp.adapter';

@Injectable()
export class WhatsappInstancesService {
  constructor(
    private readonly repo: WhatsappInstancesRepository,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsappAdapter,
  ) {}

  // `active` reflete a conexão real: GET /instance/status na Whatsapp; conectado
  // quando status === 'connected'. Consulta por instância em paralelo e tolerante
  // a falha por item (offline/erro → active:false, sem derrubar a listagem).
  async list() {
    const rows = await this.repo.list();
    return Promise.all(
      rows.map(async ({ token, ...rest }) => {
        let active = false;
        if (token && token.trim()) {
          try {
            active = (await this.whatsapp.getInstanceStatus(token)) === 'connected';
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
    if (!token) throw new NotFoundException('Whatsapp instance token not found');
    return token;
  }

  // Registra na Whatsapp o webhook de status de entrega apontando para esta app.
  async registerWebhook(id: string): Promise<{ url: string }> {
    const token = await this.getToken(id);
    const base = this.config.get<string>('APP_PUBLIC_URL')!;
    const secret = this.config.get<string>('WHATSAPP_WEBHOOK_SECRET')!;
    const url = `${base.replace(/\/$/, '')}/public/webhooks/whatsapp?secret=${encodeURIComponent(secret)}`;
    await this.whatsapp.setWebhook(token, url, ['messages_update']);
    return { url };
  }
}
