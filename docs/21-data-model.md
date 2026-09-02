# Data model

Status: Draft

## Entity-relationship diagram

Kept in sync with the actual schema; update it in the same commit as any migration.

```mermaid
erDiagram
    EXAMPLE_PARENT ||--o{ EXAMPLE_CHILD : contains
    EXAMPLE_PARENT {
        uuid id PK
        string name
        datetime created_at
    }
    EXAMPLE_CHILD {
        uuid id PK
        uuid parent_id FK
        string value
    }
```

## Entities and invariants

### [Entity name]

- [Invariant that must always hold.]

## Persistence

- [Engine, migration tool, naming conventions.]
