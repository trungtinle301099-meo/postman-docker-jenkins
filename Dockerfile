FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN mkdir -p reports/html reports/junit

CMD ["npm", "run", "test:postman"]
