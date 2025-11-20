# CodeSwap PvP Deployment Guide

This guide explains how to deploy the CodeSwap server to a cloud hosting service so players can connect from anywhere.

## Prerequisites

- GitHub account
- Account on a cloud hosting service (Render, Railway, or Heroku)

## Option 1: Deploy to Render (Recommended)

1. **Create a Render account** at https://render.com

2. **Connect your GitHub repository**:
   - Go to your Render dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub account and select this repository

3. **Configure the service**:
   - **Name**: codeswap-server
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Port**: 8080 (auto-detected from code)

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment to complete

5. **Get the WebSocket URL**:
   - After deployment, go to your service dashboard
   - Copy the public URL (e.g., `https://codeswap-server.onrender.com`)
   - The WebSocket URL will be `wss://codeswap-server.onrender.com`

## Option 2: Deploy to Railway (Recommended)

1. **Create a Railway account** at https://railway.app

2. **Connect your repository**:
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository

3. **Configure deployment**:
   - Railway will automatically detect the `railway.toml` config
   - The config specifies Nixpacks builder and npm start command
   - PORT is automatically set by Railway

4. **Deploy**:
   - Click "Deploy"
   - Wait for build and deployment (usually 2-3 minutes)

5. **Get the WebSocket URL**:
   - In your Railway project dashboard, go to "Settings" → "Domains"
   - Copy the public domain (e.g., `codeswap-server.up.railway.app`)
   - WebSocket URL: `wss://codeswap-server.up.railway.app`

**Note**: The project structure is optimized for Railway with `server.js` and `package.json` in the root directory.

## Option 3: Deploy to Heroku

1. **Install Heroku CLI** and login

2. **Create Heroku app**:
   ```bash
   heroku create codeswap-server
   ```

3. **Set Node.js buildpack**:
   ```bash
   heroku buildpacks:set heroku/nodejs
   ```

4. **Deploy**:
   ```bash
   git push heroku main
   ```

5. **Get the WebSocket URL**:
   - `heroku open` to get the URL
   - WebSocket URL: `wss://codeswap-server.herokuapp.com`

## Configure VS Code Extension

After deployment:

1. **Install the extension** in VS Code from the `extension/` folder

2. **Configure server URL**:
   - Open VS Code settings (Ctrl+,)
   - Search for "codeswap"
   - Set "Codeswap: Server Url" to your deployed WebSocket URL (e.g., `wss://your-server.onrender.com`)

3. **Test the connection**:
   - Use "Create Session" or "Join Session" commands
   - Check if connection succeeds

## Troubleshooting

- **Connection fails**: Verify the WebSocket URL is correct (wss:// not ws://)
- **Port issues**: Cloud services set PORT automatically, don't hardcode it
- **CORS issues**: The server is configured for WebSocket connections

## Local Development

For local testing:
```bash
npm install
npm start
```

Then set VS Code extension to `ws://localhost:8080`