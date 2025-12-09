import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    message?: string;
    size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...', size = 24 }) => {
    return (
        <div className="flex flex-col items-center justify-center p-4">
            <Loader2 className="animate-spin text-primary-600 mb-2" size={size} />
            {message && <span className="text-slate-500 text-sm font-medium">{message}</span>}
        </div>
    );
};
