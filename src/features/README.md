# Feature boundary

Feature-specific UI and application orchestration belong here. Features may use domain services and repository interfaces, but must not depend on a concrete persistence implementation.

Milestone 4 adds `accounts/AccountManager.tsx`: account creation, editing, deactivation/reactivation, loading, validation, conflict and persistence-error states. The repository is injected by the application. Failed saves retain form input; account registration alone does not populate financial metrics. Monthly input is deferred to Milestone 5.
