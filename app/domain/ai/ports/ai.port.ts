export const AI_PORT = Symbol('AI_PORT');

export interface GenerateEmailStyleResult {
  professional: string;
  minimalist: string;
  elegant: string;
  warm: string;
}

export interface AiPort {
  generateEmailStyles(content: string): Promise<GenerateEmailStyleResult>;
  streamLandingChat(message: string, currentLanding: unknown): AsyncIterable<string>;
}
