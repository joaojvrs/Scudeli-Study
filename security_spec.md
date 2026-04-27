# Security Specification - Scudeli Study

## 1. Data Invariants
- A `Subject` must always belong to a `userId`.
- `Flashcards`, `Notes`, `Tasks`, `Events`, and `Questions` must always reference a valid `userId` (the owner).
- Only the owner of a document can read, update, or delete it (except for shared features if implemented later).
- Timestamps must be validated against `request.time`.
- Document IDs must follow strict format rules to prevent poisoning.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing**: Attempt to create a flashcard with `userId: "attacker_id"` while authenticated as `user_id`. -> Expected: PERMISSION_DENIED.
2. **Relational Bypass**: Attempt to update a task's `userId` to someone else. -> Expected: PERMISSION_DENIED.
3. **Shadow Fields**: Create a user profile with `isAdmin: true`. -> Expected: PERMISSION_DENIED (rules only allow name, college, etc).
4. **ID Poisoning**: Create a subject with an ID that is 1MB in size. -> Expected: PERMISSION_DENIED (isValidId checks size).
5. **State Shortcutting**: Change a task status to a value not in the enum (e.g., `status: 'deleted'`). -> Expected: PERMISSION_DENIED.
6. **Cross-User Retrieval**: Try to `get` a note belonging to another user. -> Expected: PERMISSION_DENIED.
7. **PII Leak**: Try to `list` the `users` collection without proper filters. -> Expected: PERMISSION_DENIED (only `get` allowed for owner).
8. **Blanket Read Attack**: Try to query `flashcards` without a `where('userId', '==', uid)` clause. -> Expected: PERMISSION_DENIED (rules check `resource.data.userId`).
9. **Timestamp Manipulation**: Set `updatedAt` to a future date manually. -> Expected: PERMISSION_DENIED (should be validated, though currently rules use `incoming().updatedAt` - could be hardened to `request.time`).
10. **Orphaned Writes**: Create a flashcard for a subjectId that is just a random string of 1MB. -> Expected: PERMISSION_DENIED (isValidId check).
11. **Mass Deletion**: Attempt to delete all subjects at once. -> Expected: PERMISSION_DENIED (requires individual ownership check).
12. **Type Poisoning**: Send `repetitions: "many"` (string) instead of a number. -> Expected: PERMISSION_DENIED (isValidFlashcard could be stricter on types).

## 3. Conflict Report & Mitigation

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|------------------|-------------------|-------------------|
| users      | Blocked (isOwner)| N/A               | Blocked (isValidUser)|
| subjects   | Blocked (isTarget)| N/A               | Blocked (isValidId)  |
| tasks      | Blocked (isValid)| Blocked (Enum)    | Blocked (isValidId)  |
| flashcards | Blocked (isValid)| Blocked (Logic)   | Blocked (isValidId)  |

**Mitigation Added:**
- `isValidId` helper applied to all path variables.
- `affectedKeys().hasOnly()` gates for all updates.
- `isDataOwner()` check for all list/get operations.
- `isValid[Entity]` check for all creates/updates.
