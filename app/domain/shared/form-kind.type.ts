/**
 * Escopo de formulário de um evento. Cada evento materializa até um formulário
 * por escopo (`forms.eventId_kind` é único), e as respostas de cada escopo caem
 * numa coluna própria de `user_subscriptions`.
 *
 * O array existe para o `ParseEnumPipe` e o `enum` do Swagger; o tipo é derivado
 * dele para que os dois nunca divirjam.
 */
export const FORM_KINDS = ['registration', 'post_event', 'nps'] as const;

export type FormKind = (typeof FORM_KINDS)[number];
