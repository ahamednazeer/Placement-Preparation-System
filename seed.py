#!/usr/bin/env python3
"""
Seed script to create database tables and demo users.
Usage: python seed.py
"""
import asyncio
from app.infrastructure.database.session import engine, async_session_factory, init_db
from app.infrastructure.database.models import Base, User, StudentProfile
from app.infrastructure.security.password import hash_password
from app.core.constants import UserRole, UserStatus


async def seed_database():
    """Create tables and seed demo users."""
    print("🔄 Initializing database...")
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created successfully")
    
    # Demo users to create
    demo_users = [
        {
            "email": "admin@placementprep.com",
            "password": "Admin@123",
            "first_name": "System",
            "last_name": "Admin",
            "role": UserRole.ADMIN,
        },
        {
            "email": "officer@placementprep.com",
            "password": "Officer@123",
            "first_name": "Placement",
            "last_name": "Officer",
            "role": UserRole.PLACEMENT_OFFICER,
        },
        {
            "email": "student@placementprep.com",
            "password": "Student@123",
            "first_name": "Demo",
            "last_name": "Student",
            "role": UserRole.STUDENT,
        },
    ]
    
    async with async_session_factory() as session:
        for user_data in demo_users:
            # Check if user exists
            from sqlalchemy import select
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"⚠️  {user_data['email']} already exists")
                continue
            
            # Create user
            user = User(
                email=user_data["email"],
                password_hash=hash_password(user_data["password"]),
                first_name=user_data["first_name"],
                last_name=user_data["last_name"],
                role=user_data["role"],
                status=UserStatus.ACTIVE,
            )
            session.add(user)
            await session.flush()
            
            # Create student profile if student
            if user_data["role"] == UserRole.STUDENT:
                profile = StudentProfile(user_id=user.id)
                session.add(profile)
            
            print(f"✅ Created: {user_data['email']} ({user_data['role'].value})")
        
        await session.commit()
    
    print("\n📋 Demo Accounts:")
    print("   Admin: admin@placementprep.com / Admin@123")
    print("   Officer: officer@placementprep.com / Officer@123")
    print("   Student: student@placementprep.com / Student@123")
    print("\n🚀 Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed_database())
