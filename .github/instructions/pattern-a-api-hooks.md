# Pattern A: API Routes + Client Hooks (Detailed)

## Purpose
Enforce a clean boundary: **Route Handlers** contain server concerns (auth, validation, Prisma, DTO mapping), while **Client Hooks** encapsulate data access for UI consumption. UI stays presentation‑only.

## Route Handlers (Server Layer)

**Location:** `app/api/<feature>/<endpoint>/route.ts`  
**Do:**
- Validate input with **Zod** at the API boundary.
- Enforce **AuthN/AuthZ** (NextAuth v5, via /lib/auth/getSessionOrToken.ts & haspermission.ts).
- Use **Prisma** in server context only.
- Map Prisma models → **DTOs**. Never return raw models.
- Return **structured errors** `{ code, message, details? }`.
- Use proper **HTTP verbs** and **status codes**.
- Export **request/response types** for clients.

**Don’t:**
- Leak environment secrets.
- Perform business logic in components.
- Mix server logic in hooks or UI.

**Example types (shape only):**
```ts
export type ListUsersResponse = { items: UserDTO[]; total: number };
export type CreateUserRequest = { email: string; roleId: string };
export type CreateUserResponse = UserDTO;
export type AppError = { code: string; message: string; details?: unknown };