FROM node:22-alpine

# App directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY app.js ./
COPY public ./public

# Environment
ENV NODE_ENV=production

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["node", "app.js"]

