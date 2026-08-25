FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_RCTF_ORIGIN
ARG VITE_EXTRAS_ORIGIN
ENV VITE_RCTF_ORIGIN=${VITE_RCTF_ORIGIN}
ENV VITE_EXTRAS_ORIGIN=${VITE_EXTRAS_ORIGIN}

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
