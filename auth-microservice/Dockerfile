FROM node:20-alpine AS prod

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /app
WORKDIR /app

RUN npm install -g @nestjs/cli

FROM prod AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM prod AS build
COPY --from=prod-deps /app/node_modules /app/node_modules
RUN pnpm run build

FROM prod
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

EXPOSE 3001

CMD [ "pnpm", "start" ]