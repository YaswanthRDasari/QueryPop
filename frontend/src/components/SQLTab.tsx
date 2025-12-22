import React, { useState } from 'react';
import { dbApi, tableApi } from '../services/api';
import { ResultsTable } from './ResultsTable';
import { Play, Loader2 } from 'lucide-react';

interface SQLTabProps {
    tableName?: string;
    initialSql?: string;
}

export const SQLTab: React.FC<SQLTabProps> = ({ tableName, initialSql }) => {
    const defaultSql = initialSql || (tableName ? `SELECT * FROM \`${tableName}\` LIMIT 50` : 'SHOW TABLES');
    const [sql, setSql] = useState(defaultSql);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // State for the table currently being displayed/edited
    const [activeTable, setActiveTable] = useState<string | undefined>(tableName);
    const [primaryKey, setPrimaryKey] = useState<string | undefined>(undefined);
    const [validColumns, setValidColumns] = useState<Set<string>>(new Set());

    const fetchStructure = async (targetTable: string) => {
        try {
            const structure = await tableApi.getTableStructure(targetTable);
            if (structure.success) {
                // Only update PK if not already set (e.g. from query result)
                // Actually query result PK is authoritative for the specific query, but structure is good fallback
                if (!primaryKey && structure.primary_keys && structure.primary_keys.length > 0) {
                    setPrimaryKey(structure.primary_keys[0]);
                }

                if (structure.columns) {
                    setValidColumns(new Set(structure.columns.map(c => c.name)));
                }
            }
        } catch (err) {
            console.error('Failed to fetch table structure', err);
        }
    };

    // Reset when prop changes
    React.useEffect(() => {
        setActiveTable(tableName);
        setPrimaryKey(undefined);
        setValidColumns(new Set());
        if (tableName) {
            fetchStructure(tableName);
        }
    }, [tableName]);

    const handleExecute = async () => {
        if (!sql.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await dbApi.executeQuery(sql);
            setResult(res);

            if (res.success) {
                if (res.affected_table) {
                    setActiveTable(res.affected_table);
                    if (res.primary_keys && res.primary_keys.length > 0) {
                        setPrimaryKey(res.primary_keys[0]);
                    }
                    // Fetch structure to populate validColumns for editing safety
                    fetchStructure(res.affected_table);
                } else {
                    // If no table detected, disable editing safety
                    setActiveTable(undefined);
                    setPrimaryKey(undefined);
                    setValidColumns(new Set());
                }
            }
        } catch (err) {
            setResult({ success: false, error: 'Execution failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleCellUpdate = async (rowId: string | number, field: string, value: string) => {
        if (!activeTable || !primaryKey) return;

        // Prevent editing if column is not in the actual table (e.g. alias or joined field)
        if (!validColumns.has(field)) {
            alert(`Cannot edit column '${field}': It does not exist in table '${activeTable}'. It might be an alias or from a joined table.`);
            return;
        }

        try {
            // updateRow expects data object
            const data = { [field]: value };
            const res = await tableApi.updateRow(activeTable, rowId, primaryKey, data);

            if (res.success) {
                // Update local result state to reflect change
                if (result && result.rows) {
                    const updatedRows = result.rows.map((row: any) => {
                        if (row[primaryKey] === rowId) {
                            return { ...row, [field]: value };
                        }
                        return row;
                    });
                    setResult({ ...result, rows: updatedRows });
                }
            } else {
                alert('Update failed: ' + res.error);
            }
        } catch (err) {
            console.error('Update cell error', err);
            alert('Update failed');
        }
    };

    return (
        <div className="p-6 h-full flex flex-col gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Run SQL Query</h3>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50 p-2">
                    <textarea
                        value={sql}
                        onChange={(e) => setSql(e.target.value)}
                        className="w-full h-32 bg-transparent text-sm font-mono focus:outline-none resize-y"
                        placeholder="SELECT * FROM table..."
                    />
                </div>
                <div className="mt-3 flex justify-end">
                    <button
                        onClick={handleExecute}
                        disabled={loading || !sql.trim()}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                        Execute
                    </button>
                </div>
            </div>

            {result && (
                <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                    <h3 className="font-semibold text-slate-800 mb-3">Results</h3>
                    <ResultsTable
                        result={result}
                        tableName={activeTable}
                        primaryKey={primaryKey}
                        onCellUpdate={handleCellUpdate}
                    />
                </div>
            )}
        </div>
    );
};
