## 🌐 Web, React & Ionic Architectural Guidelines

### 1. Framework Initialization & Shadow DOM
- For Ionic applications, ensure `setupIonicReact()` is called in the entrypoint (`main.tsx`) to inject Shadow DOM Web Component stylesheets properly.
- Tabs & Routing: Ensure all sub-routes declare the correct `tab` property matching the parent root.
- Navigation Buttons: Sub-route `IonBackButton` components must include `slot="start"` to prevent expanding to full toolbar width.

### 2. Testing & Quality
- Follow Risk-Matched Testing: Critical business logic and state reducers must have automated unit tests (e.g. Vitest / Jest).
- UI interactions and routing flows must be verified with Playwright / Cypress when making structural changes.
- Ensure all text and source files use standard UTF-8 encoding.
