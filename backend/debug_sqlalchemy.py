import sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Construct the connection string exactly as the app does
host = 'testmach.cpahwf0buwn1.ap-south-1.rds.amazonaws.com'
user = 'dummy_user'
password = 'dummy_password'
# Default port for mysql is 3306
connection_string = f"mysql+pymysql://{user}:{password}@{host}/testdb"

print(f"Attempting SQLAlchemy connection to {host}...")
print(f"Connection string: {connection_string}")

try:
    # Use same args as app: echo=False, pool_pre_ping=True
    engine = create_engine(connection_string, echo=False, pool_pre_ping=True)
    
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        print("Connection successful (unexpected with dummy creds!)")

except SQLAlchemyError as e:
    print(f"SQLAlchemyError: {e}")
    error_str = str(e)
    if "2003" in error_str and "timed out" in error_str:
        print("Confirmed: Timeout (2003) reproduced with SQLAlchemy.")
    elif "1045" in error_str:
        print("Success: Reachable but Access Denied (1045). SQLAlchemy is working.")
except Exception as e:
    print(f"Other error: {e}")
