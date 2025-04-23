FROM node:20.19.0-alpine

WORKDIR /app

# Copy dependencies files and install
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript files
RUN yarn build

CMD ["yarn", "start"]
