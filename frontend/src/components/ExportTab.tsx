import React from 'react';
import { FileText, Database, Upload } from 'lucide-react';

interface ExportTabProps {
    tableName: string;
}

export const ExportTab: React.FC<ExportTabProps> = ({ tableName }) => {
    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
                <h3 className="text-xl font-bold text-slate-800">Export `{tableName}`</h3>
                <p className="text-slate-500">Select a format to export the data from this table.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <a
                        href={`http://localhost:5000/api/tables/${tableName}/export/csv`}
                        className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                    >
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200">
                            <FileText size={24} />
                        </div>
                        <span className="font-semibold text-slate-700 group-hover:text-primary-700">CSV</span>
                        <span className="text-xs text-slate-400 mt-1">Spreadsheet compatible</span>
                    </a>

                    <a
                        href={`http://localhost:5000/api/tables/${tableName}/export/sql`}
                        className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all group"
                    >
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200">
                            <Upload size={24} />
                        </div>
                        <span className="font-semibold text-slate-700 group-hover:text-primary-700">SQL</span>
                        <span className="text-xs text-slate-400 mt-1">INSERT statements</span>
                    </a>
                </div>

                <div className="border-t border-slate-100 pt-6 mt-6">
                    <h4 className="text-sm font-semibold text-slate-600 mb-4">Other Exports</h4>
                    <a
                        href="http://localhost:5000/api/export/database"
                        className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm px-4 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                    >
                        <Database size={16} />
                        Export Entire Database (SQL)
                    </a>
                </div>
            </div>
        </div>
    );
};
