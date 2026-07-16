import { Injectable } from '@nestjs/common';
import { EvolutionInstancesRepository } from '@modules/evolution-instances/evolution-instances.repository';

@Injectable()
export class EvolutionInstancesService {
  constructor(private readonly repo: EvolutionInstancesRepository) {}

  list() {
    return this.repo.list();
  }
}
