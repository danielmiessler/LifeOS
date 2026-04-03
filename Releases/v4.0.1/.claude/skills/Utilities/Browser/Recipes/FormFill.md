---
name: Form Fill
description: Fill out a form on a web page with provided field values
tool: playwright-cli
defaults:
  submit: true
---

# Form Fill

1. Open a playwright-cli session
2. Navigate to: {URL}
3. Take a snapshot to identify form fields
4. For each provided field, find the matching input by label/description and fill it:
   - Use `fill` for text inputs, textareas, email fields
   - Use `select` for dropdown selects
   - Use `click` for checkboxes and radio buttons
5. Take a screenshot after filling all fields
6. If submit is {submit}, click the submit/save button
7. Take a screenshot of the result
8. Close session

**Fields to fill** (provided as key-value pairs in PROMPT):

{PROMPT}

**Output:**
- Screenshot of filled form (before submit)
- Screenshot of result (after submit, if applicable)
- List of fields filled with their values
- Any errors encountered
