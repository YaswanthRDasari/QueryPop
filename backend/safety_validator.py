import re
from logger import setup_logger

logger = setup_logger(__name__)

class SafetyValidator:
    # Allowed verbs
    ALLOWED_VERBS = {'SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE'}
    
    # Explicitly forbidden keywords/patterns
    FORBIDDEN_KEYWORDS = [
        r'\bDROP\b', r'\bDELETE\b', r'\bINSERT\b', r'\bUPDATE\b', 
        r'\bALTER\b', r'\bTRUNCATE\b', r'\bREPLACE\b', 
        r'\bCREATE\b', r'\bGRANT\b', r'\bREVOKE\b',
        r'\bLOCK\b', r'\bUNLOCK\b',
        r'\bLOAD_FILE\b', r'\bINTO\s+OUTFILE\b', r'\bINTO\s+DUMPFILE\b',
        r'\bEXECUTE\b', r'\bPREPARE\b', r'\bDEALLOCATE\b'
    ]

    @staticmethod
    def validate(sql_query):
        """
        Returns (is_safe, reason).
        """
        if not sql_query or not sql_query.strip():
            return False, "Empty query"

        # Remove comments to avoid hiding attacks?
        # Simple comment stripping: -- ... or /* ... */
        # But regex on raw string usually safer if we catch keywords anywhere.
        # Let's normalize whitespace
        normalized = ' '.join(sql_query.upper().split())

        # Check for forbidden keywords
        for pattern in SafetyValidator.FORBIDDEN_KEYWORDS:
            if re.search(pattern, normalized):
                logger.warning(f"Safety check failed. Found forbidden pattern: {pattern}")
                return False, f"Query contains forbidden keyword matching: {pattern}"

        # Check if it starts with allowed verb
        first_word = normalized.split()[0]
        if first_word not in SafetyValidator.ALLOWED_VERBS:
             logger.warning(f"Safety check failed. Query must start with SELECT (got {first_word})")
             return False, "Query must start with SELECT or other read-only statement"

        return True, "Safe"
