# CREATE IDEAL PROMPT USING GE

Pattern: Use the General Evaluator to draft an ideal_prompt.

## Variables:
- `#ge`: Path to general-evaluator.md
- `#prompt1`: Path to first candidate prompt
- `#prompt2`: Path to second candidate prompt
- `#input`: Path to input data

## Instructions:

1. Invoke GE pattern (`#ge`) with variables:
   - Provide the raw text of `#prompt1` and `#prompt2`.
   - Provide the `#input` description or sample.

2. GE will follow its instructions to extract the task, then draft ideal_prompt.

3. Output only the markdown content of the new ideal_prompt to stdout.