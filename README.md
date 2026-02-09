# AI-Powered Placement Preparation System

A comprehensive platform for placement preparation with AI-powered mock interviews, aptitude practice, and coding challenges.

## Technology Stack

- **Backend**: Python FastAPI with Clean Architecture
- **Frontend**: Next.js 16 with React 19 & TailwindCSS 4
- **Database**: PostgreSQL with SQLAlchemy ORM
- **AI**: Groq API for interview generation and evaluation
- **Mobile**: Capacitor for Android

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

1. **Clone and navigate to the project**:
   ```bash
   cd Placement-Preparation-System
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -e ".[dev]"
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and Groq API key
   ```

5. **Create database**:
   ```bash
   # In PostgreSQL
   CREATE DATABASE placement_prep;
   ```

6. **Run the server**:
   ```bash
   uvicorn app.main:app --reload
   ```

7. **Create demo users**:
   ```bash
   python scripts/create_admin.py --demo
   ```

### Frontend Setup (Next.js)

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Update .env.local if needed (defaults usually work for local dev)
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```
   Access the frontend at: http://localhost:3000

### Mobile Setup (Android)

1. **Prerequisites**:
   - Android Studio (latest)
   - JDK 17+
   - Android SDK (API 33+)

2. **Sync and Open**:
   ```bash
   cd frontend
   
   # Build web assets and sync to Android
   npm run build:android
   
   # Open in Android Studio
   npm run android
   ```
   
   For detailed build instructions, see [frontend/ANDROID_BUILD.md](frontend/ANDROID_BUILD.md).

3. **Build APK (Command Line)**:
   ```bash
   cd frontend/android
   
   # Build Debug APK
   ./gradlew assembleDebug
   # Output: frontend/android/app/build/outputs/apk/debug/app-debug.apk
   
   # Build Release APK (requires signing config)
   ./gradlew assembleRelease
   # Output: frontend/android/app/build/outputs/apk/release/app-release.apk
   ```

### Docker Setup

1. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```
   
   This will start:
   - Backend at http://localhost:8000
   - Frontend at http://localhost:3000
   - PostgreSQL database

### API Documentation

Once running, access the API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@placementprep.com | Admin@123 |
| Placement Officer | officer@placementprep.com | Officer@123 |
| Student | student@placementprep.com | Student@123 |

## Project Structure

```
app/
├── api/           # REST API endpoints
├── application/   # Business services
├── core/          # Configuration
├── domain/        # Business entities
├── infrastructure/# Database & external services
├── middleware/    # Auth & logging
└── utils/         # Helpers
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh tokens
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/change-password` - Change password
- `POST /api/v1/auth/logout` - Logout

## License

MIT
