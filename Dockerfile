FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate --schema=app/infra/prisma/schema.prisma
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Fuso da aplicacao. No Alpine, sem o pacote tzdata o TZ cai silenciosamente
# em UTC — a variavel sozinha nao basta. Hoje nada depende do fuso do processo
# (todo calculo passa a zona explicita), isto e rede de seguranca para codigo
# futuro que use DateTime.now().startOf('day') ou getDate() sem zona.
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY app/infra/prisma ./app/infra/prisma

EXPOSE 3000
# Boot resiliente. O `&&` anterior fazia qualquer indisponibilidade momentanea
# do banco matar o processo, transformando 30s de rede fora em crash-loop
# infinito. Tenta 10x espacado de 5s (~50s de tolerancia); se o migrate falhar
# de verdade, sai com 1 em vez de subir a app contra um schema errado.
# `exec` troca o shell pelo node: assim o PID 1 e o processo Nest e o SIGTERM
# do Swarm chega nele, permitindo shutdown gracioso dos workers BullMQ.
CMD ["sh", "-c", "for i in 1 2 3 4 5 6 7 8 9 10; do npx prisma migrate deploy --schema=app/infra/prisma/schema.prisma && exec node dist/main; echo \"migrate falhou (tentativa $i/10), retry em 5s\"; sleep 5; done; echo 'migrate deploy falhou apos 10 tentativas'; exit 1"]
