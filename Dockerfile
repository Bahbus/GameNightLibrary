FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY service ./service
COPY scripts ./scripts
COPY shared ./shared
RUN npm run service:build

FROM node:24-alpine AS runtime
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=8787
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/build/setup-service.mjs ./build/setup-service.mjs
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/healthz`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "build/setup-service.mjs"]
