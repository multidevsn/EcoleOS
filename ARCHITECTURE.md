# EcoleOS Architecture

## Overview

EcoleOS is a multi-role school management SaaS platform built around a React front-end and a PostgreSQL/Supabase data layer. The application is designed for schools, directors, parents, students, cafeteria staff, and administrators. It exposes role-based interfaces, billing workflows, onboarding flows, and administrative dashboards.

The project combines:
- a TypeScript front-end application for user experience and business logic
- a TypeScript serverless API layer for onboarding, billing, and admin operations
- a PostgreSQL database managed through Supabase with RLS, migrations, and security-definer functions
- a native Android shell using Java + WebView to package the web application for mobile use

## Core architecture

EcoleOS is structured as a layered system:

1. Presentation layer
   - React + Vite front-end
   - Role-based navigation and page rendering
   - UI for students, parents, teachers, director, admin, cafeteria

2. Business/API layer
   - Serverless endpoints under `/api`
   - Business rules for onboarding, billing, school setup, permissions, and admin operations
   - Calls into Supabase Auth and database functions

3. Data layer
   - PostgreSQL via Supabase
   - SQL migrations for schema evolution
   - RLS policies and security-definer functions restrict access by role and context
   - Realtime features and dashboards rely on PostgreSQL views and functions

4. Mobile layer
   - Android native shell using Java and WebView
   - Embeds the built web app in the APK
   - Routes and authentication continue through Supabase and server endpoints

## Product profile

This repository is not just a frontend demo. It is a SaaS platform for educational institutions and includes:
- multi-user roles
- school subscriptions and billing
- admin dashboards and platform controls
- educational data such as schedule, grades, payments, food orders, and school community activity
- onboarding flow for schools and directors
- platform/service automation logic

## Technology stack

### Front-end
- React 19
- Vite
- TypeScript
- CSS custom styling
- PWA support for web builds

### Backend / server
- Vercel serverless API routes
- TypeScript
- Supabase client integration
- Webhook handling for external payments

### Database
- PostgreSQL
- Supabase
- PL/pgSQL stored procedures and SQL functions
- Row-Level Security (RLS)
- Realtime and dashboard views

### Mobile shell
- Java
- Android WebView
- build-time injection of server origin

## High-level application flow

1. A user signs in through Supabase Auth or demo mode.
2. The front-end reads the user's profile from `public.profiles`.
3. The app resolves the user's role and related school context.
4. The UI loads role-specific navigation and data.
5. Sensitive actions are guarded both in the client and in the database layer.
6. Admin or director flows may call `/api/...` endpoints for onboarding, billing, or platform automation.

## Key repository realities

### TypeScript is the main application language
The codebase’s primary application logic is TypeScript. This should remain the primary language for business logic, frontend code, and server routes. It is the right choice for maintainability and product velocity.

### SQL is a strategic part of the product
PLpgSQL is not incidental. It is a key layer for:
- data validation
- authorizations
- RLS logic
- functions and procedures
- complex business rules separated from user code

This means the database layer is not just persistence; it is part of the business logic layer.

### Java should remain isolated as Android shell code
Java is used for the Android WebView wrapper, not as the product core. It should remain isolated under the Android folder and treated as a platform packaging layer rather than a core product stack.

## Suggested project structure

A clear repository structure should reflect ownership and responsibilities:

```text
EcoleOS/
├── app/                        # current primary app / web source area
├── api/                        # server routes / serverless functions
├── android/                    # native Android shell for packaged web app
├── supabase/                   # SQL schema, functions, migrations, seeds
├── public/                    # static assets
├── docs/                       # architecture and operational docs
├── README.md                   # product overview
├── package.json                # app scripts and dependencies
├── tsconfig.json               # app TS config
├── tsconfig.api.json           # API TS config
├── vite.config.*               # web build config
└── ...
```

The system should remain conceptually separated into:
- application/front-end
- backend/API
- database/migrations
- mobile/android shell

## Documentation standard to maintain

The repository should document at least the following items:
- stack rationale
- directory responsibilities
- migration conventions
- database role and RLS model
- API route list
- Android build/release notes
- security requirements and secret handling

## Security and maintenance notes

- Keep secrets out of frontend environment variables.
- Treat Supabase keys, Wave keys, and signing assets as server-side or local-only secrets.
- Avoid committing signing keys, keystores, or password files.
- Keep SQL stored procedures centralized and version-controlled.
- Treat Java code inside the Android module as a mobile deployment concern, not as product logic for the main platform.

## Strategic conclusion

EcoleOS is best understood as a school SaaS platform with a strong data and policy layer. Its architecture is modern, modular, and business-driven. The correct mental model is:

- TypeScript is the main product language
- PostgreSQL/Supabase is the business-data backbone
- Java is a deployment shell for Android, not the app core
- SQL logic is a first-class concern and should be clearly documented and centralized

This separation is important for maintainability, onboarding, security, and long-term product scaling.
