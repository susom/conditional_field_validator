# Conditional Field Validator

This REDCap External Module allows you to create simple rule-based validations that run during data entry and survey completion.

## How It Works

Each rule contains two parts:

### 1. Trigger
You specify:
- **Trigger Field** — the field to watch.
- **Trigger Condition** — a value or a regular expression.
  - The rule activates only when this condition is met.

### 2. Validation
Once the trigger condition is true, you define:
- **Validation Field** — the field to validate.
- **Validation Condition** — a value or a regular expression that the field must match.
- **Error Message** — the message shown to the user if validation fails.

If validation fails:
- The target field is highlighted.
- An information icon appears showing the error message on hover.
- Form buttons are disabled while errors exist.

## Summary

1. **Trigger Field + Condition** → decides *when* to run validation.
2. **Validation Field + Condition + Error Message** → decides *what* to validate and *what message* to show.

Upload your rules file in the External Module project settings to activate the validations.
