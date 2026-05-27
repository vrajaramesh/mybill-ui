# Pre-built by: npm run build -- --configuration production
FROM --platform=linux/amd64 nginx:alpine
COPY dist/mybill-ui /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
