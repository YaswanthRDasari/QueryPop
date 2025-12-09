import React from 'react';

interface SQLEditorProps {
    sql: string;
}

export const SQLEditor: React.FC<SQLEditorProps> = ({ sql }) => {
    if (!sql) return null;

    return (
        <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-sm">
            <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                <span className="text-slate-400 text-xs font-mono uppercase tracking-wider">Generated SQL</span>
                <button
                    className="text-slate-400 hover:text-white text-xs transition-colors"
                    onClick={() => navigator.clipboard.writeText(sql)}
                >
                    Copy
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-emerald-400 leading-relaxed">
                <code>{sql}</code>
            </pre>
        </div>
    );
};
