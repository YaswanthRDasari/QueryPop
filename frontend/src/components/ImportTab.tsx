import React, { useRef, useState } from 'react';
import { Upload, Loader2, FileCode, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportTabProps {
    onImportSuccess: () => void;
}

export const ImportTab: React.FC<ImportTabProps> = ({ onImportSuccess }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('http://localhost:5000/api/import/sql', {
                method: 'POST',
                body: formData
            });

            const res = await response.json();

            if (res.success) {
                setResult({ success: true, message: `Successfully imported ${res.statements_executed} statements.` });
                onImportSuccess();
            } else {
                setResult({ success: false, error: res.error || 'Import failed' });
            }
        } catch (err) {
            setResult({ success: false, error: 'Network error occurred during import' });
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Import SQL File</h3>
                <p className="text-slate-500 mb-8">Upload a .sql file to execute against the current database.</p>

                <div
                    className={`border-2 border-dashed border-slate-300 rounded-xl p-10 hover:border-primary-400 hover:bg-primary-50 transition-all cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".sql"
                        className="hidden"
                    />

                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            {isImporting ? <Loader2 className="animate-spin" size={32} /> : <FileCode size={32} />}
                        </div>
                        <div>
                            <span className="text-primary-600 font-semibold text-lg">Click to upload</span>
                            <span className="text-slate-500"> or drag and drop</span>
                        </div>
                        <p className="text-xs text-slate-400">Maximum file size: 50MB</p>
                    </div>
                </div>

                {result && (
                    <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 text-left ${result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <div>
                            <p className="font-semibold">{result.success ? 'Import Successful' : 'Import Failed'}</p>
                            <p className="text-sm opacity-90">{result.message || result.error}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
