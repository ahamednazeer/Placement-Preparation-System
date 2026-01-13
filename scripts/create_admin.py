"""
Create admin user script.
Run this script to create an initial admin user.
"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.infrastructure.database.session import async_session_factory, init_db
from app.application.services.auth_service import AuthService
from app.core.constants import UserRole


async def create_admin(
    email: str = "admin@placementprep.com",
    password: str = "Admin@123",
    first_name: str = "System",
    last_name: str = "Admin",
):
    """Create an admin user."""
    
    # Initialize database
    await init_db()
    
    async with async_session_factory() as session:
        auth_service = AuthService(session)
        
        try:
            user, _, _ = await auth_service.register(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role=UserRole.ADMIN,
            )
            await session.commit()
            print(f"✅ Admin user created successfully!")
            print(f"   Email: {email}")
            print(f"   Password: {password}")
            print(f"   Role: {user.role.value}")
            
        except ValueError as e:
            print(f"⚠️  {e}")
            print("   Admin user may already exist.")


async def create_demo_users():
    """Create demo users for all roles."""
    
    await init_db()
    
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
        auth_service = AuthService(session)
        
        for user_data in demo_users:
            try:
                user, _, _ = await auth_service.register(**user_data)
                print(f"✅ Created: {user.email} ({user.role.value})")
            except ValueError as e:
                print(f"⚠️  {user_data['email']}: {e}")
        
        await session.commit()
    
    print("\n📋 Demo Accounts:")
    print("   Admin: admin@placementprep.com / Admin@123")
    print("   Officer: officer@placementprep.com / Officer@123")
    print("   Student: student@placementprep.com / Student@123")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create admin user")
    parser.add_argument("--demo", action="store_true", help="Create all demo users")
    parser.add_argument("--email", type=str, help="Admin email")
    parser.add_argument("--password", type=str, help="Admin password")
    
    args = parser.parse_args()
    
    if args.demo:
        asyncio.run(create_demo_users())
    else:
        kwargs = {}
        if args.email:
            kwargs["email"] = args.email
        if args.password:
            kwargs["password"] = args.password
        asyncio.run(create_admin(**kwargs))
