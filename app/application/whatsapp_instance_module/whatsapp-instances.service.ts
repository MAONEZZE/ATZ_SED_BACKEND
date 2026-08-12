import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WHATSAPP_INSTANCE_REPOSITORY_PORT,
  WhatsappInstanceRepositoryPort,
} from '@domain/whatsapp_instance_module/i-repository-whatsapp-instance';
import { WHATSAPP_PORT, WhatsappPort } from '@domain/shared/i-whatsapp';

@Injectable()
export class WhatsappInstancesService {
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY_PORT)
    private readonly repo: WhatsappInstanceRepositoryPort,
    private readonly config: ConfigService,
    @Inject(WHATSAPP_PORT) private readonly whatsapp: WhatsappPort,
  ) {}

  // `active` reflete a conexão real: GET /instance/status na Whatsapp; conectado
  // quando status === 'connected'. Consulta por instância em paralelo e tolerante
  // a falha por item (offline/erro → active:false, sem derrubar a listagem).
  async list() {
    const instances = await this.repo.list();
    return Promise.all(
      instances.map(async (instance) => {
        let active = false;
        if (instance.hasToken()) {
          try {
            active = (await this.whatsapp.getInstanceStatus(instance.token!)) === 'connected';
          } catch {
            active = false;
          }
        }
        return { id: instance.id, nickname: instance.nickname, active };
      }),
    );
  }

  async getToken(id: string): Promise<string> {
    const instance = await this.repo.findById(id);
    if (!instance?.hasToken()) throw new NotFoundException('Whatsapp instance token not found');
    return instance.token!;
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
