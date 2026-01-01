import { dbApi, tableApi } from '../services/api'; // Added tableApi
import { SQLEditor } from './SQLEditor';
import { ResultsTable } from './ResultsTable';
import { LoadingSpinner } from './LoadingSpinner';
import { Send, Play, MessageSquare, Loader2 } from 'lucide-react';
import type { GenerateResponse, ExecuteResponse } from '../types';

interface QueryTabProps {
    tableName?: string;
}

export const QueryTab: React.FC<QueryTabProps> = ({ tableName }) => {
    const [question, setQuestion] = useState('');
    const [generatedQuery, setGeneratedQuery] = useState<GenerateResponse | null>(null);
    const [queryResult, setQueryResult] = useState<ExecuteResponse | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim()) return;

        setIsGenerating(true);
        setGeneratedQuery(null);
        setQueryResult(null);
        setError(null);

        // If specific table context, maybe append to question?
        // Basic prompt doesn't restrict to table yet unless backend does.
        // We'll just append text hint if table is selected.
        const contextQuestion = tableName
            ? `${question} (in table ${tableName})`
            : question;

        try {
            const res = await dbApi.generateQuery(contextQuestion);
            if (res.error) {
                setError(res.error);
            } else {
                setGeneratedQuery(res);
            }
        } catch (err: any) {
            setError('Failed to generate query');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExecute = async () => {
        if (!generatedQuery?.sql) return;

        setIsExecuting(true);
        setQueryResult(null);
        try {
            const res = await dbApi.executeQuery(generatedQuery.sql, question);
            setQueryResult(res);
        } catch (err: any) {
            setQueryResult({ success: false, error: 'Execution failed' });
        } finally {
            setIsExecuting(false);
        }
    };

    const handleCellUpdate = async (rowId: string | number, field: string, value: string) => {
        if (!queryResult?.affected_table || !queryResult?.primary_keys?.[0]) return;
        const tableName = queryResult.affected_table;
        const pk = queryResult.primary_keys[0];

        try {
            await tableApi.updateRow(tableName, rowId, pk, { [field]: value });
            // Update local state
            setQueryResult(prev => {
                if (!prev || !prev.rows) return prev;
                return {
                    ...prev,
                    rows: prev.rows.map((row: any) => row[pk] === rowId ? { ...row, [field]: value } : row)
                };
            });
        } catch (err) {
            console.error('Update cell error', err);
            alert('Update failed');
        }
    };

    const handleRowUpdate = async (rowId: string | number, data: Record<string, any>) => {
        if (!queryResult?.affected_table || !queryResult?.primary_keys?.[0]) return;
        const tableName = queryResult.affected_table;
        const pk = queryResult.primary_keys[0];

        const { [pk]: _pk, ...updateData } = data;

        try {
            await tableApi.updateRow(tableName, rowId, pk, updateData);
            // Update local state
            setQueryResult(prev => {
                if (!prev || !prev.rows) return prev;
                return {
                    ...prev,
                    rows: prev.rows.map((row: any) => row[pk] === rowId ? { ...row, ...updateData } : row)
                };
            });
        } catch (err) {
            console.error('Update row error', err);
            alert('Update failed');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Question Input */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <form onSubmit={handleGenerate}>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <MessageSquare size={16} />
                        Ask AI about {tableName ? `\`${tableName}\`` : 'your data'}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder={tableName ? `e.g., Show rows where id > 10` : "e.g., Show me total revenue by month"}
                            className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-slate-50"
                        />
                        <button
                            type="submit"
                            disabled={isGenerating || !question.trim()}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isGenerating ? <LoadingSpinner size={18} message="" /> : <Send size={18} />}
                            Generate
                        </button>
                    </div>
                </form>
                {error && <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}
            </div>

            {/* Generated Query */}
            {generatedQuery && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <p className="text-sm text-slate-600">{generatedQuery.explanation}</p>
                    </div>
                    <div className="p-4">
                        <SQLEditor sql={generatedQuery.sql} />
                    </div>
                    <div className="p-4 border-t border-slate-100 flex justify-end">
                        <button
                            onClick={handleExecute}
                            disabled={isExecuting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                            Run Query
                        </button>
                    </div>
                </div>
            )}

            {/* Results */}
            {queryResult && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="font-bold text-slate-800 mb-4">Results</h3>
                    <ResultsTable
                        result={queryResult}
                        tableName={queryResult.affected_table}
                        primaryKey={queryResult.primary_keys?.[0]}
                        onCellUpdate={handleCellUpdate}
                        onRowUpdate={handleRowUpdate}
                    />
                </div>
            )}
        </div>
    );
};
