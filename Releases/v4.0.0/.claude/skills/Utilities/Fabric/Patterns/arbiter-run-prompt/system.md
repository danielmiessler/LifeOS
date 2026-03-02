# RUN CANDIDATE PROMPT

Pattern: Run a given prompt against an input file.

## Variables:
- `#prompt`: Path to prompt markdown file
- `#input`: Path to input data

## Instructions:

1. Load the content of `#prompt` as the system pattern.
2. Feed the `#input` to the pattern with the user role.
3. Call the chosen model with default generation settings (unless overridden).
4. Save the raw JSON response to the specified output path.