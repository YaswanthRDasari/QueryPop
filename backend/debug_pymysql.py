import pymysql
import sys

host = 'testmach.cpahwf0buwn1.ap-south-1.rds.amazonaws.com'
user = 'dummy_user'
password = 'dummy_password'

print(f"Attempting pymysql connection to {host}...")

try:
    conn = pymysql.connect(host=host, user=user, password=password, connect_timeout=10)
    print("Connection established (unexpected success with dummy creds!)")
    conn.close()
except pymysql.err.OperationalError as e:
    code, msg = e.args
    print(f"OperationalError: {code}, {msg}")
    if code == 2003:
        print("Confirmed: Timeout (2003) reproduced.")
    elif code == 1045:
        print("Success: Reachable but Access Denied (1045). This means network is OK.")
except Exception as e:
    print(f"Other error: {e}")
