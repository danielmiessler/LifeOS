---
project: fixture
slug: 20260101-isa-sections-fixture
---

# ISA section boundaries fixture

Every section reader runs on this file; IsaSections.test.ts pins what each one sees.

## Ideal State

### L3 · One sentence

Every reader finds the same section boundaries.

## Criteria

- [ ] ISC-1: real criterion before any fence

```markdown
## Criteria
- [ ] ISC-90: criterion inside a fenced example
---
## Test Strategy
| ISC-90 | bash | fenced example row | | Read | ISC-90 |
```

- [ ] ISC-2: real criterion after the fenced example

---

- [ ] ISC-3: criterion after a bare horizontal rule

## Anti-claims

- [ ] ISC-A1: anti criterion under the legacy heading

## Test Strategy

| isc | type | check | threshold | tool | anchors_to |
|---|---|---|---|---|---|
| ISC-1 | bash | row before the fenced shell block | | Read | ISC-1 |

```bash
## a shell comment inside the real Test Strategy section
```

| ISC-2 | bash | row after the fenced shell block | | Read | ISC-2 |

## Test Strategy Notes

| ISC-3 | bash | row in the notes section | | Read | ISC-3 |

## Evals

### ISC-1 · real eval

```yaml
stages:
  - code:
      - test -f README.md
```

## Examples

````markdown
```markdown
## Evals
### ISC-91 · eval inside a four-backtick fence
## Test Strategy
| ISC-91 | bash | row inside a four-backtick fence | | Read | ISC-91 |
## Criteria
- [ ] ISC-91: criterion inside a four-backtick fence
```
## Anti-claims
- [ ] ISC-92: anti criterion after the inner fence closes, still inside the four-backtick fence
````

## Decisions

- 2026-01-01: fixture written.
