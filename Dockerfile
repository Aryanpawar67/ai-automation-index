FROM node:20-bookworm-slim

# Minimal tools needed before playwright can run apt
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

# playwright install-deps installs the exact system packages for this OS version
# (handles libasound2 vs libasound2t64 and any other Bookworm renames automatically)
RUN npx playwright install-deps chromium && npx playwright install chromium

COPY . .

RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "start"]
