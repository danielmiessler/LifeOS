# Content Parser Web App

A web interface for the parser skill that allows you to input URLs, track parsing progress, and view/download the resulting JSON files.

## Features

- **URL Input**: Enter multiple URLs (one per line) to parse simultaneously
- **Real-time Progress Tracking**: Visual progress indicators showing:
  - Content type detection
  - Content fetching
  - Entity extraction
  - Content analysis
  - JSON generation
- **Results Viewer**:
  - Expandable JSON viewer with syntax highlighting
  - Download individual JSON files
  - Copy JSON to clipboard
  - Success/failure statistics
- **Tokyo Night Storm Theme**: Matches your development environment aesthetic
- **Fully Responsive**: Works on mobile, tablet, and desktop

## How to Use

### Start the Server

```bash
cd ~/.claude/skills/parser/web
python3 -m http.server 3000
```

Then open http://localhost:3000 in your browser.

### Parse Content

1. Enter one or more URLs in the textarea (one per line)
2. Click "Parse URLs" or press Ctrl+Enter
3. Watch the progress indicators as each URL is processed
4. View results when complete

### View Results

- Click on any result item to expand/collapse the JSON viewer
- Click "Download" to save the JSON file
- Click "Copy" to copy the JSON to your clipboard

## File Structure

```
web/
├── index.html      # Main HTML structure
├── styles.css      # Tokyo Night Storm themed styles
├── parser.js       # Core parsing logic and UI interactions
└── README.md       # This file
```

## Architecture

### HTML Structure
- Semantic HTML5 with accessibility in mind
- Card-based layout for visual organization
- Responsive grid system using flexbox

### CSS Features
- Tokyo Night Storm color palette
- 8px grid spacing system
- Smooth transitions (200ms)
- Custom scrollbar styling
- Mobile-first responsive design
- Focus indicators for accessibility

### JavaScript Components
- **ParserApp Class**: Main application controller
- **Progress Tracking**: Real-time status updates with visual feedback
- **Content Type Detection**: Automatic detection of:
  - YouTube videos
  - Twitter/X threads
  - PDFs
  - Newsletters (Substack, Beehiiv)
  - Articles (default)
- **JSON Viewer**: Syntax highlighting with collapsible sections
- **File Management**: Download and copy functionality

## Design Principles

### Accessibility
- WCAG 2.1 AA compliant (4.5:1 contrast ratios)
- Keyboard navigation support
- Focus indicators on all interactive elements
- Semantic HTML structure
- ARIA labels where needed

### Performance
- Vanilla JavaScript (no framework overhead)
- CSS-only animations
- Optimized DOM manipulation
- Lazy loading of JSON viewers

### User Experience
- Clear visual hierarchy
- Immediate feedback on all actions
- Error handling with user-friendly messages
- Non-blocking UI during processing
- Mobile-friendly touch targets (44x44px minimum)

## Mock Data

Currently, the app uses mock data for demonstration purposes. The parsing simulation includes:
- Content type detection based on URL patterns
- Realistic processing time delays
- Complete JSON schema population
- Mock entity extraction (people, companies)
- Random confidence scores and metrics

## Integration with Real Parser

To integrate with the actual parser backend:

1. Replace the `parseURL()` method in `parser.js` with real API calls
2. Update the `createMockResult()` method to use actual parsed data
3. Add error handling for network failures
4. Implement retry logic for failed parses

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Keyboard Shortcuts

- `Ctrl+Enter` (or `Cmd+Enter` on Mac): Submit URLs for parsing
- `Tab`: Navigate between interactive elements
- `Space/Enter`: Activate buttons and expand/collapse results

## Future Enhancements

- [ ] Backend API integration for real parsing
- [ ] Batch import from file
- [ ] Export all results as ZIP
- [ ] Search/filter parsed results
- [ ] Save/load parsing sessions
- [ ] Real-time WebSocket updates
- [ ] Advanced JSON query tool
- [ ] Comparison view for multiple parses
- [ ] Historical parsing analytics

## License

Part of PAI infrastructure.
