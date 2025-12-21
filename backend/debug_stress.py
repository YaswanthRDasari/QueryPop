import pymysql
import time
import sys

host = 'testmach.cpahwf0buwn1.ap-south-1.rds.amazonaws.com'
port = 3306

print(f"Testing connectivity to {host}:{port} - 5 attempts")

for i in range(1, 6):
    print(f"Attempt {i}...", end=" ")
    try:
        # Just socket connect is enough for network test, but let's try pymysql handshake
        # Using dummy creds to expect AccessDenied (1045) which proves network is OK
        conn = pymysql.connect(host=host, port=port, user='check', password='check', connect_timeout=5)
        conn.close()
        print("Success (Unexpected login success!)")
    except pymysql.err.OperationalError as e:
        code = e.args[0]
        if code == 1045:
            print("OK (Reachable, Access Denied)")
        elif code == 2003:
            print("FAIL (Timeout/Unreachable)")
        else:
            print(f"Error {code}: {e}")
    except Exception as e:
        print(f"Error: {e}")
    
    time.sleep(1)
