# Migration Guide: Moving Figma Site Mapper from Linode to Digital Ocean

This guide documents the step-by-step process for migrating the Figma Site Mapper backend from a Linode server to an existing Digital Ocean droplet with minimal downtime.

## Pre-Migration Checklist

Before starting the migration, ensure you have:

- [ ] Access to all production secrets (MongoDB URI, S3 credentials, etc.)
- [ ] DNS access for tidyframework.com domain
- [ ] SSH access to current Linode server
- [ ] SSH access to Digital Ocean droplet (`ssh tidy`)

## Step 1: Initial Server Setup

SSH into your Digital Ocean droplet:

```bash
ssh tidy
```

### Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Required Software (if not already installed)

```bash
# Docker (if not installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose (v2)
sudo apt install docker-compose-plugin -y

# Nginx (if not installed)
sudo apt install nginx -y

# Certbot for SSL (if not installed)
sudo apt install certbot python3-certbot-nginx -y

# Redis
sudo apt install redis-server -y
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Verify Installations

```bash
docker --version
docker compose version
nginx -v
redis-cli ping  # Should return PONG
```

## Step 2: Set Up Application Directory

Create application directory:

```bash
sudo mkdir -p /var/www/fsm.tidyframework.com
sudo chown $USER:$USER /var/www/fsm.tidyframework.com
cd /var/www/fsm.tidyframework.com
```

## Step 3: Configure Environment Variables

Create the `.env` file with production secrets:

```bash
nano .env
```

Add the following (replace with your actual values):

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/fsm?retryWrites=true&w=majority
REDIS_URL=redis://127.0.0.1:6379
S3_ACCESS_KEY=your_linode_or_do_spaces_key
S3_SECRET_KEY=your_secret_key
S3_ENDPOINT_URL=https://your-region.linodeobjects.com
S3_BUCKET_NAME=fsm-screenshots
S3_REGION=us-east-1
```

Set proper permissions:

```bash
chmod 600 .env
```

## Step 4: Create docker-compose.yml

```bash
nano docker-compose.yml
```

Add your compose configuration:

```yaml
services:
  api:
    image: ghcr.io/chillyweather/figma-site-mapper:latest
    container_name: fsm-api
    network_mode: "host"
    env_file:
      - .env
    command: node --experimental-specifier-resolution=node packages/backend/dist/index.js
    restart: unless-stopped

  worker:
    image: ghcr.io/chillyweather/figma-site-mapper:latest
    container_name: fsm-worker
    network_mode: "host"
    env_file:
      - .env
    command: node --experimental-specifier-resolution=node packages/backend/dist/worker.js
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower
    container_name: fsm-watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_API_VERSION=1.44
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_INCLUDE_STOPPED=true
      - WATCHTOWER_REVIVE_STOPPED=false
      - WATCHTOWER_LABEL_ENABLE=false
      - WATCHTOWER_MONITOR_ONLY=false
      - WATCHTOWER_NO_PULL=false
      - WATCHTOWER_SCHEDULE=0 */5 * * * *
    command: fsm-api fsm-worker
    restart: unless-stopped
```

## Step 5: Configure Nginx

Create nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/fsm.tidyframework.com
```

Add the following:

```nginx
server {
    listen 80;
    server_name fsm.tidyframework.com;

    location / {
        proxy_pass http://127.0.0.1:3006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/fsm.tidyframework.com /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Step 6: Configure Firewall (if needed)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## Step 7: Test Before DNS Switch

Before changing DNS, test that everything works:

1. **Pull and start containers:**

```bash
cd /var/www/fsm.tidyframework.com
docker compose pull
docker compose up -d
```

2. **Check container status:**

```bash
docker ps
docker logs fsm-api --tail 50
docker logs fsm-worker --tail 50
```

3. **Test API directly:**

```bash
curl http://127.0.0.1:3006/
```

4. **Test from your local machine** (get your droplet IP first):

```bash
# Get droplet IP
ssh tidy "curl -s ifconfig.me"

# Test with that IP (replace with actual IP)
curl -H "Host: fsm.tidyframework.com" http://YOUR_DROPLET_IP/
```

## Step 8: Update DNS Records

1. **Log into your DNS provider** (where tidyframework.com is hosted)

2. **Add A record for fsm.tidyframework.com:**

   - Type: A
   - Host: fsm
   - Value: Your Digital Ocean droplet IP
   - TTL: 300 (5 minutes) for faster propagation

3. **Wait for DNS propagation** (5-30 minutes):

```bash
# Check from your local machine
nslookup fsm.tidyframework.com
# Or
dig fsm.tidyframework.com +short
```

## Step 9: Set Up SSL Certificate

Once DNS points to the new server:

```bash
sudo certbot --nginx -d fsm.tidyframework.com
```

Follow the prompts:

- Enter email address
- Agree to terms
- Choose to redirect HTTP to HTTPS (recommended)

Certbot will automatically modify your nginx config and set up auto-renewal.

## Step 10: Verify Production Deployment

1. **Test HTTPS endpoint:**

```bash
curl https://fsm.tidyframework.com/
```

2. **Test from Figma plugin** (if you have test environment)

3. **Monitor logs for errors:**

```bash
docker logs fsm-api -f
docker logs fsm-worker -f
```

4. **Check Watchtower is working:**

```bash
docker logs fsm-watchtower --tail 20
```

## Step 11: Update Plugin Configuration

Update the backend URL in your plugin code:

```typescript
// packages/plugin/src/plugin/constants.ts
const BACKEND_URL = "https://fsm.tidyframework.com";
```

Rebuild and redistribute the plugin.

## Step 12: Post-Migration Tasks

### Configure Automatic Updates

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Set Up Backup Script (Optional)

Create a backup script for your `.env` and compose files:

```bash
nano ~/backup-fsm.sh
```

```bash
#!/bin/bash
tar -czf ~/fsm-backup-$(date +%Y%m%d).tar.gz /var/www/fsm.tidyframework.com/.env /var/www/fsm.tidyframework.com/docker-compose.yml
```

```bash
chmod +x ~/backup-fsm.sh
crontab -e
# Add: 0 2 * * * /home/yourusername/backup-fsm.sh
```

### Document Server Details

Save in a secure location:

- SSH alias: `tidy`
- Application path: `/var/www/fsm.tidyframework.com`
- Nginx config: `/etc/nginx/sites-available/fsm.tidyframework.com`
- Docker containers: `fsm-api`, `fsm-worker`, `fsm-watchtower`
- Domain: `https://fsm.tidyframework.com`

## Step 13: Decommission Linode Server

**Wait at least 48 hours** after successful migration to ensure everything is stable.

1. **Stop services on Linode:**

```bash
ssh user@linode-server-ip
cd /var/www/fsm.dmdz.dev
docker compose down
```

2. **Take a final backup** of any local data (if applicable)

3. **Delete or power down the Linode instance** through Linode dashboard

4. **Cancel Linode billing** (if no longer needed)

## Troubleshooting Common Issues

### Docker Can't Pull Image

```bash
# Ensure you're logged in to GitHub Container Registry
docker login ghcr.io -u chillyweather
# Use a GitHub Personal Access Token as password
```

### Containers Keep Restarting

```bash
# Check logs for specific error
docker logs fsm-api --tail 100

# Common causes:
# - Missing environment variables
# - Can't connect to MongoDB
# - Can't connect to Redis
# - Port 3006 already in use
```

### 502 Bad Gateway from Nginx

```bash
# Check if containers are running
docker ps

# Check if API is listening on port 3006
ss -tlnp | grep 3006

# Check nginx error logs
sudo tail -50 /var/log/nginx/error.log
```

### Watchtower Not Updating

```bash
# Check Watchtower logs
docker logs fsm-watchtower

# Manually trigger update
docker compose pull
docker compose up -d
```

## Migration Rollback Plan

If something goes wrong during migration:

1. **Update DNS** back to Linode IP (fsm.dmdz.dev)
2. **Restart services on Linode** server
3. **Wait for DNS propagation** (5-30 minutes)
4. **Debug the Digital Ocean setup** without affecting production
5. **Try migration again** when issues are resolved

## Performance Optimization (Post-Migration)

Once stable, consider:

1. **Enable Docker logging limits** to prevent disk fill:

```yaml
# Add to each service in docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

2. **Set up log rotation:**

```bash
sudo nano /etc/logrotate.d/nginx
```

3. **Monitor resource usage:**

```bash
htop
docker stats
```

## Optional: Migrate to Digital Ocean Spaces

If you want to move from Linode Object Storage to Digital Ocean Spaces:

1. **Create DO Space** in Digital Ocean dashboard
2. **Generate API keys** for the Space
3. **Update `.env` file:**

```env
S3_ENDPOINT_URL=https://nyc3.digitaloceanspaces.com
S3_BUCKET_NAME=fsm-screenshots
S3_REGION=nyc3
```

4. **Migrate existing objects** (if needed):

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure both sources
rclone config

# Sync from Linode to DO
rclone sync linode:fsm-screenshots do-spaces:fsm-screenshots
```

---

**Migration Complete!** Your Figma Site Mapper is now running on Digital Ocean at `https://fsm.tidyframework.com` with full CI/CD automation.
