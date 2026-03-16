FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3800
EXPOSE 3800
CMD ["node", "src/server.js"]
