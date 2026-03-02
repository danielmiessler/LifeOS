---
name: Screenshot Compare
description: Take before and after screenshots of a URL for visual comparison
tool: playwright-cli
defaults:
  viewport: 1440x900
  wait: 2000
---

# Screenshot Compare

1. Set viewport to {viewport}
2. Open a playwright-cli session named `compare-before`
3. Navigate to: {URL}
4. Wait {wait}ms for page to settle
5. Take screenshot: `/tmp/pai-browser/compare/before.png`
6. Close session

7. **Make the change** (user provides instructions via PROMPT)

8. Open a new playwright-cli session named `compare-after`
9. Navigate to: {URL}
10. Wait {wait}ms for page to settle
11. Take screenshot: `/tmp/pai-browser/compare/after.png`
12. Close session

13. Present both screenshots side by side for comparison

**Output:**
- Before screenshot path
- After screenshot path
- Summary of visible differences

{PROMPT}
