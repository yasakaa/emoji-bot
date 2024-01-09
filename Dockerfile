


FROM node:20.10.0-slim as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY --link . ./emoji-bot
WORKDIR /emoji-bot

RUN pnpm install
CMD ["pnpm", "start"]