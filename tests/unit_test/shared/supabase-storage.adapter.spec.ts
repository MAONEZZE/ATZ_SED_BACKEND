import { SupabaseStorageAdapter } from '@infra/storage/supabase-storage.adapter';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      }),
    },
  }),
}));

describe('SupabaseStorageAdapter.getPublicUrl', () => {
  it('builds a public url from bucket + path', () => {
    const cfg = { get: (k: string) => (k === 'SUPABASE_URL' ? 'https://x' : 'key') };
    const adapter = new SupabaseStorageAdapter(cfg as any);
    expect(adapter.getPublicUrl('ATZ_SED', 'message-attachments/u1/f.pdf')).toBe(
      'https://cdn.test/message-attachments/u1/f.pdf',
    );
  });
});
