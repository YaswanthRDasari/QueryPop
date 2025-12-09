import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    # For Ollama, we might need a base URL
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    # LLM Provider: "openai" or "ollama"
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai").lower()
    
    # Random secret key for Flask sessions (if needed, though MVP might not use sessions deeply)
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    
    # SQLite DB for app data (history, schema cache)
    APP_DB_PATH = os.path.join(os.getcwd(), "..", "data", "app.db")
