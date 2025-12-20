import socket
import sys

host = 'testmach.cpahwf0buwn1.ap-south-1.rds.amazonaws.com'
port = 3306

print(f"Attempting to connect to {host}:{port}...")

try:
    sock = socket.create_connection((host, port), timeout=10)
    print("Socket connection successful!")
    sock.close()
    sys.exit(0)
except Exception as e:
    print(f"Socket connection failed: {e}")
    sys.exit(1)
