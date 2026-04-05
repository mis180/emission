# EMISSION Calculator

A data-driven industrial emissions calculator for environmental compliance.

## Features
- **Data-Driven Architecture**: All methodologies are defined in JSON, making it easy to add or update regulatory formulas without changing the core engine.
- **Unified Project Store**: Aggregate multiple emission sources into a single project with automatic coordinate and total emission tracking.
- **Spatial Integration**: View emission sources on an interactive map.
- **Reporting**: Generate Appendix 6 compliant PDF reports automatically.
- **Validation**: Built-in scripts to ensure methodology JSONs are consistent and error-free.

## Getting Started

### Prerequisites
- A modern web browser.
- A local HTTP server (required for loading JSON data via `fetch`).

### Running Locally
Since the app uses `fetch()` to load methodology data, it **cannot** be run by simply opening `index.html` from the file system. You must serve it over HTTP.

**Option 1: Using Node.js (npx)**
```bash
npx serve .
```

**Option 2: Using Python**
```bash
python -m http.server 8000
```

Once serving, open `http://localhost:8000` in your browser.

## Methodology Validation
To ensure that all methodology JSON files (meta, questions, equations, variables, tables) are consistent:

```bash
python scripts/validate_methodics.py
```

This script checks for:
- JSON schema violations.
- Missing required variables.
- Formula code inconsistencies between `meta.json` and `equations.json`.
- Table sorting and lookup integrity.

## Development

### Directory Structure
- `/data/methodics`: Regulatory data in JSON format.
- `/engine`: Core logic (Evaluator, Wizard, ProjectStore).
- `/scripts`: Validation and utility scripts.
- `/lib`: Third-party dependencies (MathJS, KaTeX, Leaflet, pdfmake).

### Adding a New Methodology
1. Create a new directory in `/data/methodics`.
2. Implement the 5 required JSON files following the provided schemas.
3. Add the new methodology to `/data/registry.json`.
4. Run the validation script to verify.

## Deployment
The app is a static web application. Any static hosting provider (GitHub Pages, Vercel, Netlify, or a standard Nginx/Apache server) can be used.

**Note**: Ensure that the server is configured to serve `.json` files correctly with the `application/json` MIME type.
