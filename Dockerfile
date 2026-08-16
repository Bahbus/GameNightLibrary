FROM node:24.19.0-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY service ./service
COPY shared ./shared
RUN npm run service:build

FROM node:24.19.0-alpine3.24 AS runtime
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=8787
WORKDIR /app
COPY --from=build --chown=node:node /app/build/setup-service.cjs ./build/setup-service.cjs
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/healthz`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "build/setup-service.cjs"]
