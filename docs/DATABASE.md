# EcoleOS Database Guide

## Database model

EcoleOS relies on PostgreSQL through Supabase. The database is a first-class component of the platform, not a passive storage layer. It contains business rules, role-based access, and operational logic.

The system expects important entities such as:
- `profiles` for user identity and role assignment
- `schools` for educational institutions
- `classes` for school classes and groupings
- `subjects` for academic subjects
- `marks` for grades and notes
- `meals` and related food ordering tables
- `subscriptions` and billing-related tables
- messaging/community tables for school communication

## Role and access model

The app uses role-based context and authorization patterns. Critical rules are enforced in SQL and RLS policies so the browser cannot bypass permissions.

Examples of concerns handled in the database layer:
- role-based reads
- role-based writes
- owner or school-scoped access
- staff-only operations
- parent/student access restrictions
- sensitive admin operations

## RLS and policies

Row-Level Security should remain enabled for sensitive tables. This is essential for a multi-role platform where users should only access their own school, profile, or permitted data.

The project already emphasizes:
- `security_invoker=true` on dashboards and views
- `SECURITY DEFINER` functions for controlled operations
- explicit function-level access rules

These patterns should be kept consistent across new migrations.

## Migrations

Migration files should stay centralized and readable. Each migration should represent a versioned database change and should be named clearly.

Recommended naming style:
- `YYYYMMDD_description.sql`
- for example: `20260925_agora_impact.sql`

## SQL centralization

This project’s SQL logic is important enough to deserve a dedicated repository structure. The database layer should contain:
- schema files
- migration scripts
- seed data
- reusable SQL helper functions
- role and access functions

This centralization helps keep business logic consistent and easier to audit.

## Suggested database structure

```text
supabase/
├── schema.sql
├── demo.sql
├── live-account-seed.sql
├── role-permissions.sql
├── schools-billing-referrals.sql
├── migrations/
│   ├── 20260925_agora_impact.sql
│   ├── 20260926_autopilot_billing.sql
│   ├── 20260926_community_messaging.sql
│   ├── 20261007_director_role_fix.sql
│   └── ...
├── functions/
│   ├── is_food_staff.sql
│   ├── is_staff.sql
│   └── ...
└── seeds/
    └── ...
```

## Maintenance guidelines

- Keep migrations incremental and reversible when possible.
- Avoid mixing unrelated schema changes in one migration.
- Add comments for security-sensitive SQL.
- Keep all role and permission logic close to the relevant tables.
- Validate security policies before shipping new access patterns.

## Strategic conclusion

The SQL layer is a core product component in EcoleOS. It should be treated as an architectural center rather than a secondary utility folder.
