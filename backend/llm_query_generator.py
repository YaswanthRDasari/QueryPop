import json
from openai import OpenAI, OpenAIError
from config import Config
from logger import setup_logger

logger = setup_logger(__name__)

class LLMQueryGenerator:
    def __init__(self):
        self.provider = Config.LLM_PROVIDER # 'openai' or 'ollama'
        self.client = None
        self._setup_client()

    def _setup_client(self):
        try:
            if self.provider == 'ollama':
                logger.info(f"Using Ollama at {Config.OLLAMA_BASE_URL}")
                self.client = OpenAI(
                    base_url=f"{Config.OLLAMA_BASE_URL}/v1",
                    api_key="ollama" # required but ignored
                )
                self.model = "llama3" # Default, user might need to change or we config it
            else:
                logger.info("Using OpenAI")
                self.client = OpenAI(api_key=Config.OPENAI_API_KEY)
                self.model = "gpt-4o" # Fallback to gpt-3.5-turbo if needed
        except Exception as e:
            logger.error(f"Failed to setup LLM client: {e}")

    def generate_sql(self, user_question, schema_summary, db_type):
        """
        Generates SQL, explanation, and confidence score.
        Returns dict: { sql, explanation, confidence } or None on error.
        """
        if not self.client:
            logger.error("LLM client not initialized")
            return None

        system_prompt = f"""You are a SQL expert. Generate safe, read-only {db_type} queries based on the user's question and the provided database schema.
        
        RULES:
        1. return ONLY a JSON object with keys: "sql", "explanation", "confidence".
        2. "sql": The SQL query. MUST be a SELECT statement. NO DROP, DELETE, INSERT, UPDATE.
        3. "explanation": A brief explanation of what the query does.
        4. "confidence": "high", "medium", or "low".
        5. "tables_affected": List of table names used.
        6. Do not include markdown formatting (like ```json) in the response, just the raw JSON string.
        
        SCHEMA:
        {schema_summary}
        """

        try:
            # Adjust model for Ollama if needed
            model_to_use = self.model
            if self.provider == 'ollama':
                 # In a real app we'd let user pick, for MVP hardcode common or use env
                 # config.py doesn't have model var, let's assume 'llama3' or allow env override
                 import os
                 model_to_use = os.getenv("OLLAMA_MODEL", "llama3")

            response = self.client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_question}
                ],
                temperature=0.1,
            )
            
            content = response.choices[0].message.content.strip()
            
            # Cleanup markdown code blocks if LLM ignores instruction
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
                
            return json.loads(content)

        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM response as JSON: {content}")
            return None 
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return None
