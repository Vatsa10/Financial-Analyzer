# Quick Start: Dual-Mode RAG System

## 🚀 Get Started in 5 Minutes

### 1. Update Environment Variables

Add to your `backend/.env`:

```bash
DEFAULT_RAG_MODE=single
ENABLED_RAG_MODES=single,multi
```

### 2. Restart Your Services

```bash
# Backend
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend
npm run dev
```

### 3. Use the Mode Selector

1. Open http://localhost:8080
2. You'll see the **Mode Selector** below the hero section
3. Choose between:
   - **Single Agent** - Fast, consistent analysis
   - **Multi-Agent** - Specialized, detailed analysis
4. Your choice is saved automatically!

### 4. Upload and Analyze

1. Upload a financial document
2. Enter company name
3. Click "Analyze Financial Document"
4. The report will be generated using your selected mode
5. Check the badge in the report header to see which mode was used

## 🎯 Quick Comparison

| Feature | Single Agent | Multi-Agent |
|---------|-------------|-------------|
| Speed | ⚡ Fast (30-60s) | 🐢 Slower (60-120s) |
| Detail | 📊 Standard | 📈 Enhanced |
| Cost | 💰 Lower | 💰💰 Higher |
| Best For | Quick insights | Comprehensive analysis |

## 🔧 Configuration Options

### Enable Only Single Agent

```bash
ENABLED_RAG_MODES=single
```

### Enable Only Multi-Agent

```bash
ENABLED_RAG_MODES=multi
```

### Enable Both (Default)

```bash
ENABLED_RAG_MODES=single,multi
```

### Set Default Mode

```bash
DEFAULT_RAG_MODE=single  # or 'multi'
```

## 📊 API Usage

### Generate Report with Mode

```javascript
fetch('/api/generate-report', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: 'report.pdf',
    companyName: 'Apple Inc.',
    mode: 'multi'  // or 'single'
  })
});
```

### Check Available Modes

```javascript
fetch('/api/rag-modes')
  .then(res => res.json())
  .then(data => console.log(data.modes));
```

## 🎨 UI Features

### Mode Selector
- **Location**: Below hero section on home page
- **Persistence**: Saves to localStorage
- **Visual Feedback**: Selected mode is highlighted
- **Tooltips**: Hover over info icon for details

### Report Badges
- Shows which mode generated the report
- Displays "Fallback Mode" if fallback occurred
- Includes timestamp

### Toast Notifications
- Confirms mode selection
- Shows mode used for report generation
- Alerts if fallback occurred

## 🔄 Fallback Behavior

If Multi-Agent mode fails:
1. System automatically falls back to Single Agent
2. User is notified via toast
3. Report badge shows "Fallback Mode"
4. Metadata includes fallback reason

## 🐛 Troubleshooting

### Mode Not Showing
- Check browser console for errors
- Verify component is imported
- Ensure services are running

### Fallback Always Happening
- Check OpenRouter API credits
- Verify API key is valid
- Check rate limits

### Selection Not Persisting
- Check browser localStorage
- Clear cache and try again
- Verify localStorage is enabled

## 📚 Learn More

- **Full Guide**: See `DUAL_MODE_GUIDE.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Deployment**: See `DEPLOYMENT.md`

## ✅ Verification Checklist

- [ ] Mode selector appears on home page
- [ ] Can switch between modes
- [ ] Selection persists after page reload
- [ ] Reports show mode badge
- [ ] Toast shows mode information
- [ ] Q&A uses correct mode
- [ ] Fallback works (test by disabling API key temporarily)

## 🎉 You're Ready!

The dual-mode system is now active. Choose the mode that best fits your needs:

- **Quick analysis?** → Single Agent
- **Comprehensive report?** → Multi-Agent

Happy analyzing! 🚀

---

**Need Help?** Check the full documentation or open an issue.
