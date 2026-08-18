FROM node:20-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    libwayland-client0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production=false
COPY . .
RUN npx playwright install chromium

EXPOSE 3000
CMD ["npm", "start"]
