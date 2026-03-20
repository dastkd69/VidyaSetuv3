# VidyaSetu Nginx Configuration Wiki

_Last updated: 2026-03-20 06:36:25_

---

## 📌 Overview

This Nginx configuration powers the **VidyaSetu AI Web App**.

It handles:
- 🌐 Serving the frontend (SPA)
- 🔁 Reverse proxying API requests to FastAPI
- ⚡ Performance optimizations (keepalive, caching)
- 🔐 Basic security headers
- 📡 WebSocket + streaming support

---

## 🏗️ Architecture

```
Client (Browser)
      ↓
   Nginx (Port 80)
      ↓
FastAPI (127.0.0.1:8000)
```

- Frontend served from: `/var/www/frontend`
- Backend (FastAPI) runs on: `localhost:8000`

---

## 🔌 Upstream Backend

```
upstream fastapi_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}
```

### Purpose:
- Defines backend server pool
- Enables connection reuse (better performance)

---

## 🌐 Server Block (HTTP)

```
listen 80;
server_name _;
```

- Listens on IPv4 + IPv6
- `_` means catch-all (replace with domain later)

---

## 🛡️ Security Headers

```
X-Frame-Options SAMEORIGIN
X-Content-Type-Options nosniff
X-XSS-Protection enabled
Referrer-Policy strict-origin
Permissions-Policy restricted
```

### Why:
- Prevent clickjacking
- Block MIME sniffing
- Limit browser capabilities

---

## 🎨 Frontend (SPA Handling)

```
location / {
    try_files $uri $uri/ /index.html;
}
```

### Behavior:
- Serves static files if present
- Falls back to `index.html` (React/Vue SPA routing)

---

## ⚡ Static Assets Optimization

```
location ~* \.(js|css|png|jpg|svg|woff2?)$
```

### Features:
- 7-day caching
- Immutable cache headers
- No access logs (performance)

---

## 🔁 API Reverse Proxy

```
location /api/
```

### Key Features:
- Routes `/api/*` → FastAPI backend
- Preserves client IP & headers
- Supports:
  - WebSockets
  - Long-running requests (AI inference)
  - Large uploads (200MB)

---

## ⏱️ Timeouts

| Setting | Value | Purpose |
|--------|------|--------|
| proxy_read_timeout | 600s | Long AI responses |
| proxy_send_timeout | 600s | Upload stability |
| proxy_connect_timeout | 60s | Backend connect |

---

## 📦 Buffering

```
proxy_buffering on
```

- Improves performance for normal requests
- Disabled for streaming endpoints

---

## 📡 Streaming Endpoint (Special Case)

```
location = /api/tutor-chat
```

### Special Config:
- `proxy_buffering off`
- Immediate response streaming
- Ideal for AI chat tokens

---

## 📁 File Upload Limits

```
client_max_body_size 200m
client_body_buffer_size 512k
```

### Purpose:
- Allows large uploads (PDFs, datasets, etc.)

---

## 🔐 HTTPS (Future Setup)

```
# if ($scheme = http) {
#     return 301 https://$host$request_uri;
# }
```

### To Enable:
- Add SSL cert (Let's Encrypt)
- Uncomment redirect block

---

## 🧪 Testing & Reloading

After changes:

```
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧠 Best Practices

- Keep backend bound to `127.0.0.1` (not public)
- Use HTTPS in production
- Monitor logs:
  - `/var/log/nginx/access.log`
  - `/var/log/nginx/error.log`

---

## 🚀 Summary

This config is:
- ✅ Production-ready baseline
- ⚡ Optimized for AI workloads
- 🔐 Secure by default
- 🔄 Scalable and extensible

---

## ✍️ Notes

- Replace `server_name _` with your domain
- Add HTTPS ASAP for production
- Consider rate limiting for API endpoints

---

