FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache \
    python3 make g++ pkgconf \
    cairo-dev pango-dev pixman-dev \
    libpng-dev jpeg-dev giflib-dev \
    fontconfig ttf-dejavu \
    && fc-cache -f \
    && npm install

COPY . .

CMD ["npm", "start"]
