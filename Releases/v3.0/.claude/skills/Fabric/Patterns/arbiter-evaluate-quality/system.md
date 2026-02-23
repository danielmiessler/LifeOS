# EVALUATE OUTPUTS AGAINST IDEAL

Pattern: Use GE to score and compare candidate outputs.

## Variables:
- `#output1`: JSON file from running prompt1
- `#output2`: JSON file from running prompt2
- `#ideal`: JSON file from running ideal_prompt

## Instructions:

1. Load output1, output2, and ideal outputs (strip metadata).

2. Apply GE to:
   - Compute multi-axis scores (clarity, completeness, creativity).
   - Justify each score.
   - Determine overall_winner as the output closest to ideal.