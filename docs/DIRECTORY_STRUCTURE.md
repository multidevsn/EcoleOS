# EcoleOS Directory Responsibilities

This repository contains several layers that should remain conceptually separated. Each folder has a clear responsibility.

## Application / front-end

The front-end is the user-facing layer. It contains the React screens, role-based navigation, UI logic, appearance rules, and client-side state flows.

Typical responsibilities:
- login and account flows
- school dashboard screens
- student, parent, teacher, admin, director, and cafeteria views
- role-based navigation filters
- client-side data fetching and rendering
- styling and design system

This layer should not contain deep database or production security logic. It should rely on server endpoints and database policies for critical access control.

## Backend / API

The backend layer contains server-side endpoints and business operations. It handles logic that should not be exposed directly to the browser or executed purely in the UI layer.

Typical responsibilities:
- onboarding for schools and directors
- billing and payment preparation
- admin dashboard data
- school metrics and reporting
- webhooks and external service integrations
- protected server operations

This layer is the place for business rules that must be enforced on the server side.

## Database / SQL layer

The SQL layer is critical for EcoleOS. It contains the PostgreSQL schema, RLS policies, triggers, functions, and database migrations.

Typical responsibilities:
- validation of business state
- secure role-based access
- profile and user-context resolution
- school, schedule, payment, and community data rules
- data operations that must not be bypassed from the client

This layer should be centralized and versioned.

## Android module

The Android module is a native wrapper around the web application. It packages the built front-end and exposes it through a WebView shell.

Typical responsibilities:
- Android app packaging
- build-time injection of the server origin
- WebView configuration
- native error screens for invalid origin or network failures
- app distribution and signing configuration

It should not be the place for the product’s main business logic.

## Public assets

The public folder contains static assets and browser-visible files that are not part of the application logic itself.

## Documentation

The docs folder should hold architecture, stack rationale, deployment notes, and operational guidance. This reduces the chance that the repository becomes difficult to navigate as new features are added.

## Ownership principle

Each directory should answer a single question:
- front-end: what does the user see?
- backend: what business operations are executed?
- database: what rules and data access are enforced?
- Android: how is the app packaged for mobile?

This separation helps project clarity and prevents feature logic from spreading across unrelated folders.
