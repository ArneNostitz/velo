FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev
RUN addgroup -S velo && adduser -S velo -G velo && mkdir -p /data && chown -R velo:velo /app /data
USER velo
EXPOSE 8787
CMD ["node", "server.mjs"]
