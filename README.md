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
