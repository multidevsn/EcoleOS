# EcoleOS Stack and Architecture

## Stack overview

EcoleOS is a TypeScript-first application built around a React front-end and a PostgreSQL-backed Supabase stack. This is a strong architectural choice for a school platform because it couples:

- fast front-end development
- role-based UI logic
- secure data access in PostgreSQL
- real-time features and dashboards
- serverless API workflows for billing and onboarding

## Front-end

### React + Vite + TypeScript
The front-end is the main user experience layer. React provides component-based development and good UX iteration, while Vite enables a fast build pipeline.

TypeScript is the primary language for the app because it gives:
- safer refactoring
- better maintenance of role-based screens
- clearer API contracts
- easier long-term scaling

The application includes multiple user roles and views, which makes TypeScript especially appropriate for a product of this size.

## Backend/API

The API layer is serverless and is currently organized as Vercel-style routes under `/api`. This is a good fit for:
- onboarding flows
- billing and subscription logic
- platform admin endpoints
- server-side webhook processing

Because the app has payment flows and user-specific school data, keeping business rules in server endpoints and secure database functions is the right design.

## Database layer

### PostgreSQL + Supabase
Supabase is a strong fit for a platform that needs:
- authentication
- database access
- row-level security
- real-time messaging
- secure, queryable data APIs

The database is not just storage; it is a core part of the platform’s logic. Complex operations are handled with SQL functions and policies rather than being scattered across the client.

### PLpgSQL
PLpgSQL is a strategic part of the product. The repo’s SQL-heavy nature indicates a design where business rules live close to data. This is important for:
- permission enforcement
- validation
- role-based data selection
- administrative workflows
- billing and platform automation

## Mobile shell

### Android + Java + WebView
The Android portion is a native shell around the web application. This is not the product’s core; it is packaging and deployment code. Java is used as a bridge to keep the web app inside a mobile wrapper while preserving a simple delivery model.

This is useful for:
- Android distribution
- native app-like launch experience
- embedded web assets
- simplified maintenance of the mobile shell

## Why this stack is appropriate

This project clearly behaves like a SaaS platform rather than a simple website. The architecture makes sense because:
- the product spans multiple user roles and school workflows
- billing and onboarding are server-driven
- permissions are enforced in database logic
- the system needs real-time communication features
- the app is intended to be delivered both in browser and via Android packaging

## Recommended architectural principle

Keep the stack boundaries clean:
- TypeScript for product logic and UI
- SQL for database governance and data rules
- Java only for Android packaging
- Vercel/serverless routes for business operations

This keeps the repository maintainable and easier to reason about as EcoleOS grows.
