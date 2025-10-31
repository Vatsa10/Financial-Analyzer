# Deployment Guide for Render

This guide will help you deploy the Financial Analyzer to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your OpenRouter API key
3. (Optional) HuggingFace API key

## Step 1: Deploy Backend Service

1. Go to Render Dashboard and click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:

   **Name:** `financial-analyzer-backend` (or your preferred name)
   
   **Root Directory:** `backend`
   
   **Environment:** `Node`
   
   **Build Command:** `npm install`
   
   **Start Command:** `npm start`
   
   **Instance Type:** Free or Starter (depending on your needs)

4. Add Environment Variables:
   - `OPENROUTER_API_KEY` - Your OpenRouter API key
   - `HF_API_KEY` - Your HuggingFace API key (optional)
   - `NODE_ENV` - Set to `production`

5. Click "Create Web Service"

6. **Important:** Copy your backend URL (e.g., `https://financial-analyzer-backend.onrender.com`)

## Step 2: Deploy Frontend Service

1. Go to Render Dashboard and click "New +" → "Static Site"
2. Connect your GitHub repository
3. Configure the service:

   **Name:** `financial-analyzer-frontend` (or your preferred name)
   
   **Root Directory:** `frontend`
   
   **Build Command:** `npm install && npm run build`
   
   **Publish Directory:** `dist`

4. Add Environment Variable:
   - `VITE_API_URL` - Your backend URL from Step 1 (e.g., `https://financial-analyzer-backend.onrender.com`)

5. Click "Create Static Site"

## Step 3: Update CORS (Backend)

After deployment, you need to update the backend to allow requests from your frontend domain.

In `backend/server.js`, update the CORS configuration:

```javascript
const cors = require('cors');

// Update CORS to allow your frontend domain
app.use(cors({
  origin: [
    'http://localhost:8080', // Local development
    'https://your-frontend-name.onrender.com' // Your Render frontend URL
  ],
  credentials: true
}));
```

Commit and push this change to trigger a redeploy.

## Step 4: Test Your Deployment

1. Visit your frontend URL (e.g., `https://financial-analyzer-frontend.onrender.com`)
2. Try uploading a PDF file
3. Try fetching a PDF from URL
4. Generate a report and test the Q&A feature

## Troubleshooting

### Backend Issues

- Check backend logs in Render Dashboard
- Verify environment variables are set correctly
- Ensure OpenRouter API key is valid and has credits

### Frontend Issues

- Check that `VITE_API_URL` points to your backend URL
- Verify CORS is configured correctly in backend
- Check browser console for errors

### Free Tier Limitations

- Render free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid tier for production use

## Local Development

For local development, create a `.env` file in the frontend directory:

```
VITE_API_URL=http://localhost:3001
```

This will use your local backend instead of the deployed one.

## Environment Variables Summary

### Backend
- `OPENROUTER_API_KEY` - Required for LLM processing
- `HF_API_KEY` - Optional, for faster embeddings
- `NODE_ENV` - Set to `production`

### Frontend
- `VITE_API_URL` - Your deployed backend URL

## Notes

- The backend needs to stay running to process requests
- Large PDF files may take time to process
- Free tier has limited resources; consider upgrading for production
- Backend URL must be HTTPS in production (Render provides this automatically)
