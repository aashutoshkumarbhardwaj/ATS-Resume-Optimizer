# Chrome Extension Setup Instructions

## 🚀 Quick Setup

### Step 1: Update API URL

1. Open `extension/src/popup/popup.js`
2. Find line 7 with: `const API_BASE_URL = 'https://your-app-name.onrender.com/api';`
3. Replace `your-app-name` with your actual Render service name

**Example:**
If your Render URL is `https://resume-optimizer-backend.onrender.com`, then update to:
```javascript
const API_BASE_URL = 'https://resume-optimizer-backend.onrender.com/api';
```

### Step 2: Update Other Files (Optional)

Also update these files with the same URL:
- `extension/src/utils/constants.js` (line 7)
- `extension/src/utils/api.js` (line 6)

### Step 3: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The extension should now appear in your extensions list

### Step 4: Test the Extension

1. Go to any job posting website (LinkedIn, Indeed, etc.)
2. Click the extension icon in your browser toolbar
3. Upload a resume and test the analysis

## 🔧 Finding Your Render URL

1. Go to your [Render Dashboard](https://dashboard.render.com/)
2. Click on your backend service
3. Your URL will be shown at the top, like: `https://your-service-name.onrender.com`

## 🐛 Troubleshooting

### "Failed to fetch" Error
- Make sure your Render service is running (not sleeping)
- Check that the API URL in the extension matches your Render URL exactly
- Verify your backend has the `/api/documents/upload` endpoint

### Extension Not Loading
- Make sure you selected the `extension` folder (not a subfolder)
- Check the Chrome console for any JavaScript errors
- Reload the extension after making changes

### CORS Errors
- Your backend is already configured to allow Chrome extension requests
- If you still get CORS errors, check that your Render service is accessible

## 📝 Notes

- Your backend CORS is already configured correctly (`origin: '*'`)
- The extension will work once you update the API URL
- Make sure your Render service doesn't go to sleep (upgrade to paid plan if needed)