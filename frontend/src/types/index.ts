export interface SchemaStats {
    table_count: number;
    column_count: number;
}

export interface ConnectionInfo {
    type: string;
    host: string;
    port: number;
    user: string;
    database: string;
}

export interface ConnectResponse {
    success: boolean;
    message: string;
    table_count?: number;
    column_count?: number;
    info?: ConnectionInfo;
}

export interface DatabasesResponse {
    success: boolean;
    databases?: string[];
    error?: string;
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
    affected_table?: string;
    primary_keys?: string[];
    error?: string;
    profile_stats?: Record<string, any>[];
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

// Table Management Types
export interface TableInfo {
    name: string;
    column_count: number;
    primary_keys: string[];
}

export interface TablesResponse {
    success: boolean;
    tables?: TableInfo[];
    error?: string;
}

export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
    autoincrement: boolean;
}

export interface IndexInfo {
    name: string;
    columns: string[];
    unique: boolean;
}

export interface ForeignKeyInfo {
    name: string | null;
    columns: string[];
    referred_table: string;
    referred_columns: string[];
}

export interface TableStructureResponse {
    success: boolean;
    table_name?: string;
    columns?: ColumnInfo[];
    primary_keys?: string[];
    indexes?: IndexInfo[];
    foreign_keys?: ForeignKeyInfo[];
    error?: string;
}

export interface PaginationInfo {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
}

export interface TableDataResponse {
    success: boolean;
    table_name?: string;
    sql_query?: string;
    columns?: string[];
    rows?: Record<string, any>[];
    execution_time?: number;
    pagination?: PaginationInfo;
    error?: string;
    profile_stats?: Record<string, any>[];
}
