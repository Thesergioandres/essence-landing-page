# Railway Deploy Guide (Essence)

## Migration from VPS to Railway

- The old SSH + Docker Compose workflow has been replaced by Railway deploy hooks.
- GitHub Action now triggers Railway for backend and frontend on every push to `main`.
- No SSH key or VPS IP is required anymore.

## GitHub secrets required

Create these repository secrets in GitHub:

- `RAILWAY_BACKEND_DEPLOY_HOOK_URL`
- `RAILWAY_FRONTEND_DEPLOY_HOOK_URL`

You can get each deploy hook from Railway service settings.

## Recommended layout

- One Railway project with two services: `backend` and `frontend`.
- Backend is Node/Express (server).
- Frontend is Vite (client) served as a static site.

## Backend service

- Root: `server`
- Build: `npm install`
- Start: `npm run start`
- Environment variables (minimum):
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `PORT` (Railway injects)
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (if enabled)
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (if enabled)
  - `ALLOWED_ORIGINS` (comma-separated frontend origins)
  - `FRONTEND_URL` (your Railway frontend URL)
  - `BACKUP_WORKER_DISABLED=true`

Example production values:

- `MONGODB_URI=mongodb+srv://<db_user>:<db_password>@<cluster-host>/<database>?retryWrites=true&w=majority`
- `NODE_ENV=production`
- `BACKUP_WORKER_DISABLED=true`

## Frontend service (static)

- Root: `client`
- Build: `npm install && npm run build`
- Output: `dist`
- Environment variables:
  - `VITE_API_URL=https://<your-backend>.railway.app/api/v2`
  - `VITE_APP_VERSION` (optional; if omitted, Docker build uses `RAILWAY_GIT_COMMIT_SHA` automatically)

## Notes

- CORS is now driven by `ALLOWED_ORIGINS` and `FRONTEND_URL`.
- The legacy VPS scripts and Docker Compose are not required for Railway.
- Security recommendation: rotate the MongoDB Atlas password after migration, since credentials were shared in plain text.
