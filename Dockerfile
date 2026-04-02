FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY src/frontend/index.html /usr/share/nginx/html/index.html
COPY src/frontend/v4.html /usr/share/nginx/html/sim.html
COPY assets/ /usr/share/nginx/html/assets/
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost/ || exit 1
EXPOSE 80
