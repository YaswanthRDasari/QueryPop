import React, { useState } from 'react';
import { dbApi } from '../services/api';
import { SQLEditor } from './SQLEditor';
import { ResultsTable } from './ResultsTable';
import { Play, Loader2 } from 'lucide-react';

interface SQLTabProps {
    tableName?: string;
}

export const SQLTab: React.FC<SQLTabProps> = ({ tableName }) => {
    const defaultSql = tableName ? `SELECT * FROM \`${tableName}\` LIMIT 50` : 'SHOW TABLES';
    const [sql, setSql] = useState(defaultSql);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleExecute = async () => {
        if (!sql.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await dbApi.executeQuery(sql);
            setResult(res);
        } catch (err) {
            setResult({ success: false, error: 'Execution failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 h-full flex flex-col gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Run SQL Query</h3>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                    <SQLEditor sql={sql} onChange={setSql} />
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
                    <ResultsTable result={result} />
                </div>
            )}
        </div>
    );
};
