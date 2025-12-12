from db_connector import DBConnector
import sys

def test_null_byte_connection():
    print("Attempting to connect with a string containing a null byte...")
    connector = DBConnector()
    # A connection string with a null byte in it
    bad_connection_string = "mysql://user:pass\x00word@localhost/db"
    
    success, message = connector.connect(bad_connection_string)
    
    print(f"Success: {success}")
    print(f"Message: {message}")

    if "source code string cannot contain null bytes" in message:
        print("CONFIRMED: Reproduced null byte error.")
    else:
        print("RESULT: Did not reproduce the specific null byte error (or it was handled).")

if __name__ == "__main__":
    test_null_byte_connection()
