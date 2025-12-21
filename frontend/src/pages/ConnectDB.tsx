import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbApi } from '../services/api';
import { Database, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const ConnectDB: React.FC = () => {
    const [connectionString, setConnectionString] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!connectionString) return;

        setLoading(true);
        setError(null);

        try {
            const response = await dbApi.connect(connectionString);
            if (response.success) {
                navigate('/browse');
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError('Failed to connect to backend');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-100 p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                        <Database className="text-primary-600" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Connect Database</h1>
                    <p className="text-slate-500 text-center mt-2">
                        Enter your PostgreSQL or MySQL connection string to get started
                    </p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <form onSubmit={handleConnect} className="space-y-4">
                    <div>
                        <label htmlFor="connString" className="sr-only">Connection String</label>
                        <input
                            id="connString"
                            type="text"
                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                            placeholder="postgresql://user:password@localhost:5432/dbname"
                            value={connectionString}
                            onChange={(e) => setConnectionString(e.target.value)}
                            disabled={loading}
                            autoFocus
                        />
                        <p className="text-xs text-slate-400 mt-2 ml-1">
                            Supports PostgreSQL and MySQL URLs
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !connectionString}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Connecting...
                            </>
                        ) : (
                            <>
                                Connect
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">
                        QueryPop Phase 0.3 • Local MVP
                    </p>
                </div>
            </div>
        </div>
    );
};
