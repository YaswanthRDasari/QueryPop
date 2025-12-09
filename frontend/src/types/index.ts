export interface SchemaStats {
    table_count: number;
    column_count: number;
}

export interface ConnectResponse {
    success: boolean;
    message: string;
    table_count?: number;
    column_count?: number;
}

export interface GenerateResponse {
    sql: string;
    explanation: string;
    confidence: string;
    tables_affected?: string[];
    error?: string;
}

export interface ExecuteResponse {
    success: boolean;
    rows?: any[];
    columns?: string[];
    execution_time_ms?: number;
    row_count?: number;
    error?: string;
}

export interface QueryHistoryItem {
    id: number;
    timestamp: string;
    question: string;
    sql: string;
    status: 'success' | 'error' | 'blocked';
    execution_time_ms: number;
    row_count: number;
    error_message?: string;
}
