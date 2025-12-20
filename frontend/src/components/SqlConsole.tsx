import React, { useState } from 'react';
import { useSqlConsole } from '../hooks/useSqlConsole';

export const SqlConsole: React.FC = () => {
    const { runQuery, cancelQuery, result } = useSqlConsole();
    const [sql, setSql] = useState<string>('SELECT 1');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const handleRun = () => {
        if (!sql.trim()) return;
        setPage(1); // Reset to first page on new run
        runQuery(sql);
    };

    // Calculate pagination
    const totalRows = result.rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(page, totalPages);

    // Slice rows for current page
    const startIdx = (safePage - 1) * pageSize;
    const currentRows = result.rows.slice(startIdx, startIdx + pageSize);

    // Spinner CSS embedded for MVP (or move to index.css)
    const spinnerStyle = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .spinner {
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
            vertical-align: middle;
            margin-right: 8px;
        }
        .pagination-btn {
            padding: 4px 8px;
            border: 1px solid #ddd;
            background: #fff;
            cursor: pointer;
            margin: 0 4px;
            border-radius: 4px;
        }
        .pagination-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #f1f1f1;
        }
    `;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: '1rem' }}>
            <style>{spinnerStyle}</style>
            {/* Toolbar / Input */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <textarea
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    style={{ flex: 1, minHeight: '100px', padding: '0.5rem', fontFamily: 'monospace' }}
                    placeholder="Enter SQL here..."
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                        onClick={handleRun}
                        disabled={result.status === 'running'}
                        style={{ padding: '0.5rem 1rem', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                        {result.status === 'running' ? 'Running...' : 'Run Query'}
                    </button>
                    {result.status === 'running' && (
                        <button
                            onClick={cancelQuery}
                            style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div style={{ padding: '0.5rem', background: '#f8f9fa', border: '1px solid #dee2e6', display: 'flex', alignItems: 'center' }}>
                {result.status === 'running' && <div className="spinner" />}
                <strong>Status:</strong> <span style={{ marginLeft: '4px' }}>{result.status}</span>
                {result.stats && ` | Time: ${result.stats.elapsedMs}ms | Rows: ${result.stats.totalRows}`}
                {result.error && <span style={{ color: 'red', marginLeft: '1rem' }}>Error: {result.error}</span>}
                <span style={{ marginLeft: 'auto' }}>Loaded: {result.loadedRows} rows</span>
            </div>

            {/* Results Table */}
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid #dee2e6', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflow: 'auto' }}>
                    {result.columns.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                                <tr>
                                    {result.columns.map(col => (
                                        <th key={col} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left', background: '#f1f1f1' }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentRows.map((row, i) => (
                                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                        {row.map((val: any, j: number) => (
                                            <td key={j} style={{ border: '1px solid #ddd', padding: '8px' }}>
                                                {val === null ? <em style={{ color: '#999' }}>NULL</em> : String(val)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                            No results to display
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {result.rows.length > 0 && (
                    <div style={{
                        padding: '0.5rem',
                        borderTop: '1px solid #dee2e6',
                        background: '#f8f9fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                className="pagination-btn"
                                disabled={safePage === 1}
                                onClick={() => setPage(1)}
                            >
                                &laquo; First
                            </button>
                            <button
                                className="pagination-btn"
                                disabled={safePage === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                &lsaquo; Prev
                            </button>
                        </div>

                        {/* Page Numbers */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Simple logic: show first 5, or window around current?
                                // Let's do a sliding window logic for robustness
                                let p = i + 1;
                                if (totalPages > 5) {
                                    if (safePage <= 3) { p = i + 1; }
                                    else if (safePage >= totalPages - 2) { p = totalPages - 4 + i; }
                                    else { p = safePage - 2 + i; }
                                }

                                return (
                                    <button
                                        key={p}
                                        className="pagination-btn"
                                        disabled={p === safePage}
                                        style={p === safePage ? { background: '#007bff', color: 'white', borderColor: '#007bff', opacity: 1 } : {}}
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                className="pagination-btn"
                                disabled={safePage === totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            >
                                Next &rsaquo;
                            </button>
                            <button
                                className="pagination-btn"
                                disabled={safePage === totalPages}
                                onClick={() => setPage(totalPages)}
                            >
                                Last &raquo;
                            </button>
                        </div>

                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                            }}
                            style={{ marginLeft: '1rem', padding: '2px 4px', borderRadius: '4px' }}
                        >
                            <option value="10">10 / page</option>
                            <option value="50">50 / page</option>
                            <option value="100">100 / page</option>
                            <option value="500">500 / page</option>
                            <option value="1000">1000 / page</option>
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
};
