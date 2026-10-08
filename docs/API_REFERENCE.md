# EcoleOS API Reference

## Purpose

The API layer is used for server-side business operations that should not be executed directly from the browser. This includes school onboarding, platform administration, webhook handling, billing workflows, and other privileged or sensitive actions.

## Core route patterns

The project uses Vercel-compatible server routes, typically under paths such as:
- `/api/...`

The repository README and code structure already indicate endpoints for:
- `/api/onboarding/school`
- `/api/wave/checkout`
- `/api/wave/webhook`
- `/api/admin/tech`
- `/api/director/stats`
- `/api/billing/autopilot`

## Route responsibilities

### Onboarding
- school creation
- director registration support
- subscription setup
- onboarding continuation flows

### Billing and subscriptions
- monthly cycles
- price rules
- billing automation
- invoice preparation
- payment integration via Wave

### Admin and platform operations
- platform owner controls
- technical monitoring/workflows
- internal dashboards

### Director operations
- per-school analytics
- overview data for school leadership

## Design principle

The backend should be the enforcement point for:
- permissions
- external integrations
- security-sensitive operations
- billing logic
- platform automation

The browser should not be trusted for final enforcement.

## Integration guidance

The front-end should call API routes for:
- operations that change school state
- operations involving external payment systems
- operations requiring elevated permissions
- administrative or platform-level flows

## Security expectations

- Keep secrets on the server side.
- Validate all external inputs.
- Use database RLS and server-side permission checks.
- Treat webhook endpoints as untrusted entry points.
- Do not place secret keys in client-exposed environment variables.

## Summary

The API layer is essential to EcoleOS’s SaaS model: it coordinates business actions, external integrations, and secure platform behavior.
