# TestForm Workflow

---

Discover, fill, submit, and verify a form on any page. Uses Interceptor's semantic element finding to locate form fields by role and name, fills them with test data, submits, and verifies the result.

## When to Use

- Testing signup, login, or contact forms after changes
- Verifying form validation behavior (required fields, email format, etc.)
- Checking that form submissions reach the correct API endpoint
- Testing forms on authenticated pages where agent-browser can't reach

## Steps

### 1. Open the Page with the Form

```bash
interceptor open "<PAGE_URL>"
```

### 2. Discover Form Fields

Use the find command to locate input fields:

```bash
interceptor find "" --role textbox
interceptor find "" --role combobox
interceptor find "" --role checkbox
```

Or get the full element tree and identify form elements:

```bash
interceptor tree
```

Look for elements with roles: `textbox`, `combobox`, `checkbox`, `radio`, `spinbutton`, `slider`, `switch`.

### 3. Fill Form Fields

Fill each field using its semantic selector or ref:

```bash
# By semantic selector (preferred — survives DOM changes)
interceptor type "textbox:Email" "test@example.com"
interceptor type "textbox:Name" "Test User"
interceptor select "combobox:Country" "United States"

# By element ref (from tree output)
interceptor act e5 "test@example.com"
interceptor act e8 "Test User"
```

For checkboxes and radio buttons:

```bash
interceptor click "checkbox:Terms and Conditions"
interceptor click "radio:Monthly Plan"
```

### 4. Verify Pre-Submit State

Before submitting, verify the form looks correct:

```bash
( cd /tmp/pai-screenshots && interceptor screenshot --save )
```

Read the screenshot to confirm fields are populated correctly and no validation errors are showing.

### 5. Submit the Form

```bash
interceptor click "button:Submit"
interceptor wait-stable
```

Or use the keyboard:

```bash
interceptor keys "Enter"
interceptor wait-stable
```

### 6. Verify Submission Result

Check what happened after submission:

```bash
# Check the page content for success/error messages
interceptor read --text-only

# Check network for the API call
interceptor net log --json

# Capture the result page
( cd /tmp/pai-screenshots && interceptor screenshot --save )
```

Look for:
- Success confirmation message or redirect
- API call to the expected endpoint with correct method (POST/PUT)
- Response status code (200/201 for success)
- Any error messages or validation failures

### 7. Test Edge Cases (Optional)

For thorough form testing, repeat with edge case inputs:

```bash
# Empty required fields — submit without filling
interceptor click "button:Submit"
interceptor read --text-only  # Check for validation messages

# Invalid email format
interceptor type "textbox:Email" "not-an-email"
interceptor click "button:Submit"
interceptor read --text-only

# Very long input
interceptor type "textbox:Name" "A very long name that might break layout assumptions in the form"
( cd /tmp/pai-screenshots && interceptor screenshot --save )
```

## Notes

- Semantic selectors (`"textbox:Email"`) use accessible role + name. If a form field has no accessible name, it will only be findable by ref ID — consider fixing the accessibility.
- `interceptor type` clears the field before typing. Use `interceptor type <ref> "text" --append` to add to existing content.
- For dropdowns/selects, use `interceptor select <ref> "value"` instead of click-based selection.
- Network log captures the actual API request triggered by form submission — useful for verifying the correct endpoint and payload shape.
- For password fields, use `interceptor act <ref> "value" --os` for OS-level trusted input that bypasses autocomplete detection.
