FROM node:22-alpine

# App directory
WORKDIR /app

# Copy only what we need at runtime (no build step)
COPY server.js ./
COPY public ./public

# Environment
ENV NODE_ENV=production

# Expose the app port
EXPOSE 3000

# Start the zero-dependency server
CMD ["node", "server.js"]

