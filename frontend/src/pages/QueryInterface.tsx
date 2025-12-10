import React, { useState, useEffect } from 'react';
import { dbApi } from '../services/api';
import { QueryHistory } from '../components/QueryHistory';
import { SQLEditor } from '../components/SQLEditor';
import { ResultsTable } from '../components/ResultsTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { GenerateResponse, ExecuteResponse, QueryHistoryItem } from '../types';
import { Send, Play, MessageSquare, Database, Loader2 } from 'lucide-react';

export const QueryInterface: React.FC = () => {
    const [question, setQuestion] = useState('');
    const [generatedQuery, setGeneratedQuery] = useState<GenerateResponse | null>(null);
    const [queryResult, setQueryResult] = useState<ExecuteResponse | null>(null);
    const [history, setHistory] = useState<QueryHistoryItem[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const data = await dbApi.getHistory();
        setHistory(data);
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim()) return;

        setIsGenerating(true);
        setGeneratedQuery(null);
        setQueryResult(null);
        setError(null);

        try {
            const res = await dbApi.generateQuery(question);
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
        setQueryResult(null); // Clear previous results immediately

        try {
            const res = await dbApi.executeQuery(generatedQuery.sql, question);
            setQueryResult(res);
            loadHistory(); // Refresh history

            if (!res.success && res.error) {
                // Provide safe fail feedback or keep it in table component?
                // Table handles error display too.
            }
        } catch (err: any) {
            setQueryResult({ success: false, error: 'Execution failed unexpectedly' });
        } finally {
            setIsExecuting(false);
        }
    };

    const handleHistorySelect = (sql: string) => {
        // Load raw SQL into editor? 
        // For MVP we assume re-running is common or checking results.
        // Let's just set it as "generated" so they can run it.
        setGeneratedQuery({
            sql: sql,
            explanation: "Loaded from history",
            confidence: "N/A"
        });
        setQueryResult(null);
        setQuestion(""); // Or fetch question if we stored map
    };

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            <QueryHistory history={history} onSelect={handleHistorySelect} />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Database className="text-primary-600" size={20} />
                        <h1 className="font-bold text-slate-800">QueryPop</h1>
                    </div>
                    <div className="text-xs text-slate-400">Connected</div>
                </header>

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    <div className="max-w-4xl mx-auto space-y-6">

                        {/* Question Input */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <form onSubmit={handleGenerate}>
                                <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                    <MessageSquare size={16} />
                                    Ask your data
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        placeholder="e.g., Show me total revenue by month for 2023"
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

                            {error && (
                                <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Generated SQL & Actions */}
                        {(generatedQuery || isGenerating) && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {isGenerating && (
                                    <div className="h-32 flex items-center justify-center bg-white rounded-xl border border-dashed border-slate-300">
                                        <LoadingSpinner message="Generating SQL..." />
                                    </div>
                                )}

                                {!isGenerating && generatedQuery && (
                                    <>
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                                                >
                                                    {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                                                    Run Query
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Results */}
                        {(queryResult || isExecuting) && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {isExecuting && (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <LoadingSpinner size={32} message="Executing query..." />
                                    </div>
                                )}
                                {!isExecuting && queryResult && (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
                                        <h3 className="font-bold text-slate-800 mb-4">Results</h3>
                                        <ResultsTable result={queryResult} />
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
};
