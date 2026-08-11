export abstract class DomainEvent {
  readonly occurredAt: Date;
  constructor() {
    this.occurredAt = new Date();
  }
  abstract get eventName(): string;
}
