FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN mkdir -p reports/html reports/junit reports/json reports/email

CMD ["npm", "run", "test:postman"]
