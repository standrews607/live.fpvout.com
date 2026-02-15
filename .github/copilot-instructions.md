
# Copilot Instructions (Pattern A: API Routes + Client Hooks)

This repository follows a strict architecture:

**Flow:** UI Component → Client Hook → API Route → DB/Service  
**Non‑negotiables:** TypeScript, DTOs (no raw Prisma to clients), structured errors, feature‑based folders, no barrel files.

## Architectural Rules

1. **Server logic only in Route Handlers** (`app/api/**/route.ts`).  
   - AuthZ/AuthN checks live here.  
   - Input validated with Zod.  
   - Prisma used only in server context.  
   - Return DTOs via `NextResponse.json`.  
   - Use proper HTTP verbs and status codes.

2. **Client data access only through Hooks** (`useFeatureThing`).  
   - Hooks call the API routes.  
   - Typed returns: `{ data, isLoading, error, refetch, ...actions }`.  
   - Surface structured `AppError` from API.  
   - Support abortable fetch, optional optimistic updates.

3. **UI Components are pure presentation.**  
   - Use Material UI.  
   - Receive data/handlers from hooks.  
   - Never call `fetch`, never import server packages.

## Types & DTOs

- Prisma models → Mappers → DTOs in route handlers.  
- Export request/response types from route handlers or colocated `types.ts`.  
- Clients (hooks/components) import DTOs only—no Prisma types.

## Error Envelope

```ts
export type AppError = { code: string; message: string; details?: unknown };