FROM node:20-bookworm-slim

# Install Chromium system libraries via apt (standard paths — no Nix ld.so issues)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libx11-6 \
    libxcb1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxcomposite1 \
    libxdamage1 \
    libgbm1 \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Download Playwright's Chromium binary (system deps installed above)
RUN npx playwright install chromium

COPY . .

RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
