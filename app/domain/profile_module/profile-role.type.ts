/**
 * Papel do usuário na plataforma. `team` é gente da empresa e pode consultar
 * o RAG com dados confidenciais; `user` é todo o resto (inclusive cliente
 * externo).
 */
export type ProfileRole = 'team' | 'user';
