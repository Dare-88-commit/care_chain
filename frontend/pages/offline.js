'use client'
import { useEffect, useState } from 'react';
import { openDB } from 'idb';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className={`fixed bottom-4 right-4 p-3 rounded-lg ${isOnline ? 'bg-green-500' : 'bg-yellow-500'
            } text-white shadow-lg transition-all`}>
            {isOnline ? '✅ Online' : '⚠️ Offline - Working locally'}
        </div>
    );
}