# User Deactivation Feature Plan

## Goal
Allow admins to deactivate/activate user accounts so inactive users cannot sign in while preserving their data and historical records.

## Scope
- Backend API endpoints to toggle user status.
- Frontend admin UI controls reflecting activation state.
- Login/auth flows must respect the status flag (already partially handled).
- Optional: audit data for visibility (log who performed the action).

## Deliverables
1. Database updates (if needed) to ensure `users.is_active` is enforced and auditable.
2. Backend routes under `/admin` to:
   - `POST /admin/users/:id/deactivate`
   - `POST /admin/users/:id/activate`
3. Frontend Admin page updates to surface a toggle or action buttons alongside each user row.
4. Regression tests/manual checklist covering auth/login, admin UI, and error states.

## Work Plan
### 1. Backend Enhancements
1. **Confirm schema readiness**  
   - Ensure `users.is_active` column exists (added in migration 0007).  
   - Add index on `users.is_active` if login queries require it (optional).
2. **Admin routes**  
   - Add helper to validate target user exists and isn’t an admin.  
   - Implement controller functions for activate/deactivate:
     - Set `users.is_active` accordingly.  
     - Optionally update `academy_memberships.status` (`active`/`suspended`).  
     - Return updated user summary.
3. **Logging/Auditing (optional nice-to-have)**  
   - Console log or store simple entry noting which admin toggled the state.
4. **Auth guard check**  
   - Already blocks inactive users. Verify endpoints using Postman/curl to ensure 403.

### 2. Frontend Updates
1. **Admin API helper**  
   - Add `deactivateUser(id)` and `activateUser(id)` wrappers.
2. **Admin UI**  
   - In `AdminHome.vue` table, add Tag showing `is_active` plus action button(s):
     - If active → “Deactivate” (confirm dialog).  
     - If inactive → “Activate”.
   - Display toast confirmations and reload list after changes.
3. **Activation dialog copy**  
   - Mention deactivated users cannot login until reactivated.

### 3. QA / Validation
1. **Backend tests/manual steps**
   - Create sample user, deactivate via API, ensure login returns 403.  
   - Reactivate user, confirm login works.
2. **UI checks**
   - Table reflects current state.  
   - Buttons disabled appropriately while request pending.  
   - Error handling when API fails.
3. **Regression**  
   - Account activation flow still works.  
   - Existing student/instructor flows unaffected.

### 4. Deployment Considerations
- Run `npm run migrate` if any schema/index changes were introduced.  
- Communicate to admins that newly deactivated users immediately lose access.  
- Optionally add metrics/logs afterward.

## Timeline (estimate)
| Task | Estimate |
| --- | --- |
| Backend endpoints + tests | 0.5 day |
| Frontend UI/API wiring | 0.5 day |
| QA/manual verification | 0.25 day |

Total ≈ **1.25 developer days**.

## Open Questions
1. Should deactivation also unenroll users from groups or keep memberships as-is? (current plan: keep data).  
2. Need email/notification to user when status changes? (out of scope now).  
3. Should admins provide a reason or note? (optional).

