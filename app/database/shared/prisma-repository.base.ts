import { PrismaService } from '@database/prisma/prisma.service';

/**
 * Shared base for Prisma-backed repositories. Holds the PrismaService and
 * offers reusable query fragments so repositories don't re-implement the same
 * filters. Entity mapping stays per-repository (it's genuinely entity-specific).
 */
export abstract class PrismaRepositoryBase {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Case-insensitive OR-contains filter across the given string fields.
   * Returns an empty object when no term is given, so it can be spread into a `where`.
   */
  protected containsSearch(fields: string[], term?: string): Record<string, unknown> {
    if (!term) return {};
    return {
      OR: fields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' as const } })),
    };
  }
}
