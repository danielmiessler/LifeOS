FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build to reduce image size
RUN npm prune --production

# Set environment variables
ENV NODE_ENV=production
ENV TRANSPORT_TYPE=stdio

# Run in production mode
CMD ["node", "dist/index.js"]


