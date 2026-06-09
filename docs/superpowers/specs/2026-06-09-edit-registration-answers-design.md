# Edit Registration Answers — Design Spec

**Date:** 2026-06-09  
**Status:** Approved

## Overview

Add a PATCH endpoint that lets the event organizer edit all form field answers for a registration, including synchronizing the fixed columns (`name`, `email`, `phone`) when those fields are present in the answers payload.

## Endpoint

```
PATCH /events/:eventId/registrations/:id
```

**Guards:** JwtAuthGuard + OwnershipGuard (verifies `event.ownerId === authenticatedUser.id`)

## Request Body

```json
{
  "answers": {
    "Nome": "João Silva",
    "E-mail": "joao@example.com",
    "Telefone": "11999999999",
    "Cidade": "São Paulo"
  }
}
```

`answers` must be provided (required). It is the complete replacement for the current answers object.

## Behavior

1. **Ownership check** — OwnershipGuard ensures the event belongs to the authenticated user.
2. **Registration scope** — Controller verifies `registration.eventId === eventId`; throws 404 if not found, 403 if mismatch.
3. **FormField validation** — Load the event's `FormField` rows. For each field where `required = true`, verify the corresponding key exists in `answers` with a non-null, non-empty value. Unknown extra keys in `answers` are accepted (backwards-compatibility with old form versions).
4. **Fixed-column sync** — Inspect FormFields (`isFixed = true`) to find the fixed fields. Mapping rule: `type = 'email'` → `registration.email`; `type = 'phone'` → `registration.phone`; `type = 'text'` with `isFixed = true` → `registration.name`. For each fixed field found, look up its `label` as the key in `answers` and extract the string value. Only update a fixed column if the corresponding key is present in `answers`.
5. **Persist** — `prisma.registration.update({ where: { id }, data: { answers, name?, email?, phone? } })`
6. **Response** — Returns the full updated registration object (same shape as `GET /events/:eventId/registrations/:id`).

## DTO

```ts
// update-registration-answers.dto.ts
class UpdateRegistrationAnswersDto {
  @IsObject()
  answers: Record<string, unknown>;
}
```

## Repository Change

Add to `RegistrationRepositoryPort`:

```ts
updateAnswers(
  id: string,
  data: {
    answers: Record<string, unknown>;
    name?: string;
    email?: string;
    phone?: string;
  }
): Promise<RegistrationEntity>;
```

Implement via `prisma.registration.update`.

## Error Cases

| Condition | HTTP |
|-----------|------|
| Registration not found | 404 |
| Registration belongs to different event | 404 |
| Required answer missing or empty | 400 |
| `answers` not an object | 400 (ValidationPipe) |

## Files to Change

| File | Action |
|------|--------|
| `registrations.controller.ts` | Add PATCH `:id` handler |
| `update-registration-answers.dto.ts` | Create new DTO |
| `registration-repository.port.ts` | Add `updateAnswers` method |
| `prisma-registration.repository.ts` | Implement `updateAnswers` |

No schema migration needed — `answers` column already exists as Json.
