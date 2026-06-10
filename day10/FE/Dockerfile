# FE Dashboard — multi-stage: build (node) → serve (nginx).
#   docker build -t day10-fe ./FE
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# URL BE được "bake" vào bundle lúc build (Vite). Trình duyệt trên host gọi qua cổng publish.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
