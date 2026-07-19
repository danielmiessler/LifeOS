# TestForm Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:31337/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the TestForm workflow in the Interceptor skill to test a form"}' \
  > /dev/null 2>&1 &
```

Running **TestForm** in **Interceptor**...

---

Discover, fill, submit, and verify a form on any page. Uses Interceptor's semantic element finding to locate form fields by role and name, fills them with test data, submits, and verifies the result.

## When to Use

- Testing signup, login, or contact forms after changes
- Verifying form validation behavior (required fields, email format, etc.)
- Checking that form submissions reach the correct API endpoint
- Testing forms on authenticated pages where agent-browser can't reach

## Steps

### 0. Preflight Isolation Gate (MANDATORY first step)

```bash
source "${LIFEOS_DIR}/USER/CUSTOMIZATIONS/SKILLS/Interceptor/preferences.env"
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/PreflightIsolation.sh"
```

Prefer `bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/EnsureTestProfile.sh"` — it runs the gate and auto-launches the test profile if it isn't open (exit 5/6), only proceeding after the pinned-UUID match passes. Non-zero exit → STOP and surface the message verbatim; do not fall back to the Default profile. `INTERCEPTOR_TEST_CONTEXT_ID` is the pinned isolated context; every browser verb below passes it. Form testing in the isolated profile keeps test submissions away from any real auth state in the operator's main session. Screenshots go through `Tools/Capture.sh`, never raw `interceptor screenshot`.

### 1. Open the Page with the Form (in the isolated profile)

```bash
interceptor open "<PAGE_URL>" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

### 2. Discover Form Fields

Use the find command to locate input fields:

```bash
interceptor find "" --role textbox --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor find "" --role combobox --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor find "" --role checkbox --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Or get the full element tree and identify form elements:

```bash
interceptor tree --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Look for elements with roles: `textbox`, `combobox`, `checkbox`, `radio`, `spinbutton`, `slider`, `switch`.

### 3. Fill Form Fields

Fill each field using its semantic selector or ref:

```bash
# By semantic selector (preferred — survives DOM changes)
interceptor type "textbox:Email" "test@example.com" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor type "textbox:Name" "Test User" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor select "combobox:Country" "United States" --context "$INTERCEPTOR_TEST_CONTEXT_ID"

# By element ref (from tree output)
interceptor act e5 "test@example.com" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor act e8 "Test User" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

For checkboxes and radio buttons:

```bash
interceptor click "checkbox:Terms and Conditions" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor click "radio:Monthly Plan" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

### 4. Verify Pre-Submit State

Before submitting, verify the form looks correct:

```bash
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/Capture.sh" --current
```

Read the printed image path to confirm fields are populated correctly and no validation errors are showing. `Capture.sh --current` shoots the already-open page in the pinned context.

### 5. Submit the Form

```bash
interceptor click "button:Submit" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor wait-stable --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

Or use the keyboard:

```bash
interceptor keys "Enter" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor wait-stable --context "$INTERCEPTOR_TEST_CONTEXT_ID"
```

### 6. Verify Submission Result

Check what happened after submission:

```bash
# Check the page content for success/error messages
interceptor read --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"

# Check network for the API call
interceptor net log --json --context "$INTERCEPTOR_TEST_CONTEXT_ID"

# Capture the result page
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/Capture.sh" --current
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
interceptor click "button:Submit" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor read --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"  # Check for validation messages

# Invalid email format
interceptor type "textbox:Email" "not-an-email" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor click "button:Submit" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
interceptor read --text-only --context "$INTERCEPTOR_TEST_CONTEXT_ID"

# Very long input
interceptor type "textbox:Name" "A very long name that might break layout assumptions in the form" --context "$INTERCEPTOR_TEST_CONTEXT_ID"
bash "${LIFEOS_ROOT}/skills/Interceptor/Tools/Capture.sh" --current
```

## Notes

- Semantic selectors (`"textbox:Email"`) use accessible role + name. If a form field has no accessible name, it will only be findable by ref ID — consider fixing the accessibility.
- `interceptor type` clears the field before typing. Use `interceptor type <ref> "text" --append` to add to existing content.
- For dropdowns/selects, use `interceptor select <ref> "value"` instead of click-based selection.
- Network log captures the actual API request triggered by form submission — useful for verifying the correct endpoint and payload shape.
- For password fields, use `interceptor act <ref> "value" --trusted` for OS-level HID-sourced input (formerly `--os`, now deprecated alias). Bypasses autocomplete detection on sites that check `isTrusted` against HID source state.
