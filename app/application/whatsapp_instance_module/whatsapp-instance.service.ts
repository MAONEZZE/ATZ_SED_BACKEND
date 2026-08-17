import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WHATSAPP_INSTANCE_REPOSITORY_PORT,
  WhatsappInstanceRepositoryPort,
} from '@domain/whatsapp_instance_module/i-repository-whatsapp-instance';
import { WHATSAPP_PORT, WhatsappPort } from '@domain/shared/i-whatsapp';

@Injectable()
export class WhatsappInstanceService {
  constructor(
    @Inject(WHATSAPP_INSTANCE_REPOSITORY_PORT)
    private readonly repo: WhatsappInstanceRepositoryPort,
    private readonly config: ConfigService,
    @Inject(WHATSAPP_PORT) private readonly whatsapp: WhatsappPort,
  ) {}

  // `active` reflete a conexão real: GET /instance/status na Whatsapp; conectado
  // quando status === 'connected'. Consulta por instância em paralelo e tolerante
  // a falha por item (offline/erro → active:false, sem derrubar a listagem).
  async list(profileId: string) {
    const instances = await this.repo.listForProfile(profileId);
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

  /**
   * `profileId` restringe à lista fixa do usuário. Omitido só em uso interno
   * (webhook/worker), onde não existe usuário na requisição.
   */
  async getToken(id: string, profileId?: string): Promise<string> {
    if (profileId) await this.assertAllowed(id, profileId);
    const instance = await this.repo.findById(id);
    if (!instance?.hasToken()) throw new NotFoundException('Whatsapp instance token not found');
    return instance.token!;
  }

  async assertAllowed(instanceId: string, profileId: string): Promise<void> {
    const allowed = await this.repo.isAllowedForProfile(instanceId, profileId);
    if (!allowed) {
      throw new ForbiddenException('Esta instância WhatsApp não está liberada para o seu usuário');
    }
  }

  // Registra na Whatsapp o webhook de status de entrega apontando para esta app.
  async registerWebhook(id: string, profileId: string): Promise<{ url: string }> {
    const token = await this.getToken(id, profileId);
    const base = this.config.get<string>('APP_PUBLIC_URL')!;
    const secret = this.config.get<string>('WHATSAPP_WEBHOOK_SECRET')!;
    const url = `${base.replace(/\/$/, '')}/public/webhooks/whatsapp?secret=${encodeURIComponent(secret)}`;
    await this.whatsapp.setWebhook(token, url, ['messages_update']);
    return { url };
  }
}
