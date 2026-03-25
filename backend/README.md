# FirstAcad Backend (Express + Socket.io)

## Services
- **Backend API**: Node.js + Express + Socket.io (this folder)
- **AI Service**: Python + FastAPI (`../ai-service/`)

## Environment
Create `backend/.env` (copy from `backend/env.example`):

- `PORT=8080`
- `CORS_ORIGIN=http://localhost:5173`
- `DATABASE_URL=postgres://USER:PASS@localhost:5432/firstacad`
- `JWT_SECRET=change_me`
- `JWT_EXPIRES_IN=8h`
- `AI_SERVICE_URL=http://localhost:8000`
- `S3_ENDPOINT=` (optional for MinIO/S3-compatible)
- `S3_REGION=us-east-1`
- `S3_BUCKET=firstacad`
- `S3_ACCESS_KEY=`
- `S3_SECRET_KEY=`

## Run migrations
Migrations are plain SQL in `src/db/migrations/`.

```bash
cd backend
node src/db/migrate.js
```

## Run server
```bash
cd backend
npm install
npm run dev
```

## Key API routes
- `POST /api/auth/login`
- `POST /api/auth/register` (Admin-only)
- `GET /api/announcements/feed`
- `POST /api/announcements`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/timetable`
- `POST /api/timetable` (Course Rep-only)
- `POST /api/resources` (Lecturer-only, multipart `file`)
- `POST /api/assignments/:id/submissions` (Student-only, multipart `file`)
- `GET /api/recommend/resources/:student_id` (self or Admin)

## Socket.io
On connect (JWT required), server auto-joins rooms:
- `school_global`
- `dept_<departmentId>_level_<levelId>`
- `group_<groupId>`

Events:
- `announcement:new`
- `message:new`
- `timetable:updated`
- `notification:event`

