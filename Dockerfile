FROM node:20.10.0-slim

RUN corepack enable

WORKDIR /emoji-bot

COPY --link pnpm-lock.yaml package.json ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
	pnpm install --frozen-lockfile --aggregate-output

COPY --link . ./

CMD ["pnpm", "start"]