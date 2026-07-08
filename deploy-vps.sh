#!/bin/bash
# ==============================================================================
#   LASER EXPERTS INDIA LLP - UBUNTU 24.04 VPS AUTOMATED DEPLOYMENT SCRIPT
# ==============================================================================

echo "======================================================================"
echo "  Starting Automated Production Deployment for server1.leip.co.in"
echo "======================================================================"
echo ""

# 1. Update system packages
echo "[*] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Git, Node.js (v20), Nginx, and Certbot
echo "[*] Installing dependencies (Node.js v20, Git, Nginx, Certbot)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx certbot python3-certbot-nginx build-essential

# Verify versions
echo "[+] Node.js version: $(node -v)"
echo "[+] NPM version: $(npm -v)"
echo "[+] Nginx version: $(nginx -v)"

# 3. Clone Repository
echo "[*] Setting up application directories..."
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www

if [ -d "LEI-Repair" ]; then
    echo "[!] Directory LEI-Repair already exists. Backing up..."
    mv LEI-Repair LEI-Repair_backup_$(date +%F_%T)
fi

echo "[*] Cloning LEI-Repair Repository from GitHub..."
git clone https://github.com/viveklei/LEI-Repair.git
cd LEI-Repair/backend

# 4. Install backend dependencies
echo "[*] Installing backend Node.js packages..."
npm install

# 5. Set up production environment configuration
echo "[*] Writing production environment configurations (.env)..."
cat <<EOT > .env
PORT=5000
DATABASE_URL="file:./dev.db"
JWT_SECRET="fsrms_super_jwt_secret_key_2026"
JWT_REFRESH_SECRET="fsrms_super_jwt_refresh_secret_key_2026"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

USE_S3=false
MOCK_WHATSAPP=true
MOCK_EMAIL=false

# SMTP Configurations - SET THESE MANUALLY AFTER DEPLOYMENT
# Run: nano /var/www/LEI-Repair/backend/.env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=laserexpertsindiaglobal@gmail.com
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD_HERE
SMTP_FROM="LEI Repair Portal" <laserexpertsindiaglobal@gmail.com>

# Firebase Configuration
FIREBASE_PROJECT_ID=lei-repair
EOT

# 6. Database schema setup and generate Prisma Client
echo "[*] Running database migrations..."
npx prisma generate
npx prisma db push

# Seed demo repair jobs if db is empty
if [ -f "seed_demo_jobs.js" ]; then
    echo "[*] Seeding demo database..."
    node seed_demo_jobs.js
fi

# 7. Compile TypeScript to production Javascript
echo "[*] Building backend application source code..."
npm run build

# 7b. Install and compile frontend on the VPS
echo "[*] Building frontend application source code..."
cd /var/www/LEI-Repair/frontend
npm install --legacy-peer-deps
# Build the production files (these will be served by Nginx)
VITE_API_URL=https://frnd.leip.co.in/api npm run build
cd /var/www/LEI-Repair/backend

# 8. Setup PM2 process manager to run backend in background
echo "[*] Configuring PM2 daemon manager..."
sudo npm install -g pm2
pm2 stop all || true
pm2 delete lei-backend || true
pm2 start dist/server.js --name lei-backend
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME

# 9. Configure Nginx Reverse Proxy (Isolated Config - Single Domain)
echo "[*] Generating isolated Nginx site configuration..."
sudo cat <<EOT > /etc/nginx/sites-available/fsrms.conf
# SINGLE DOMAIN: frontend + API all under frnd.leip.co.in
server {
    listen 80;
    server_name frnd.leip.co.in;

    # Serve React frontend
    root /var/www/LEI-Repair/frontend/dist;
    index index.html;

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept' always;
    }

    # Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # All other routes go to React (SPA support)
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOT

# Enable the isolated configuration safely
sudo ln -sf /etc/nginx/sites-available/fsrms.conf /etc/nginx/sites-enabled/fsrms.conf

# Restart Nginx to apply changes
echo "[*] Restarting Nginx server..."
sudo systemctl restart nginx

# 10. Run Certbot to acquire SSL Certificates for HTTPS
echo "======================================================================"
echo "  Setting up SSL Certificate for domains"
echo "======================================================================"
echo "Let's Encrypt Certbot will now ask you to provide an email and agree"
echo "to the terms of service to install your FREE SSL certificates."
echo ""
sudo certbot --nginx -d frnd.leip.co.in --non-interactive --agree-tos -m laserexpertsindiaglobal@gmail.com --redirect

# Reload Nginx with SSL enabled
sudo systemctl reload nginx

echo "======================================================================"
echo "  [SUCCESS] DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "  - App URL:      https://frnd.leip.co.in"
echo "  - API Endpoint: https://frnd.leip.co.in/api"
echo "  - PM2 Status Page:"
pm2 status
echo "======================================================================"
