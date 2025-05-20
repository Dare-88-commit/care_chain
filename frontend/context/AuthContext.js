import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const AuthContext = createContext();

// Enhanced API base URL configuration with validation
const getApiBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  if (!baseUrl) {
    console.warn('NEXT_PUBLIC_API_BASE_URL is not set!');
    return process.env.NODE_ENV === 'production' 
      ? 'https://care-chain.onrender.com' 
      : 'http://localhost:8000';
  }
  return baseUrl;
};

const API_BASE_URL = getApiBaseUrl();

export function AuthProvider({ children }) {
    const [authState, setAuthState] = useState({
        isAuthenticated: false,
        token: null,
        user: null,
        isLoading: true,
        error: null
    });
    const router = useRouter();

    // Enhanced fetch with timeout and retries
    const authFetch = async (endpoint, options = {}, retries = 2) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                credentials: 'include'
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeout);
            
            if (retries > 0 && !error.message.includes('aborted')) {
                console.warn(`Retrying ${endpoint}... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return authFetch(endpoint, options, retries - 1);
            }
            
            throw error;
        }
    };

    const initializeAuth = async () => {
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            console.debug('Auth initialization started', { hasToken: !!token });

            if (!token) {
                return setAuthState(prev => ({ ...prev, isLoading: false }));
            }

            const data = await authFetch('/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setAuthState({
                isAuthenticated: true,
                token,
                user: data.user,
                isLoading: false,
                error: null
            });
        } catch (error) {
            console.error('Auth initialization failed:', error);
            setAuthState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Session expired. Please login again.'
            }));
            logout();
        }
    };

    useEffect(() => {
        initializeAuth();
        
        // Optional: Add event listener for storage changes
        const handleStorageChange = (e) => {
            if (e.key === 'authToken') {
                initializeAuth();
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const login = async (token, rememberMe) => {
        try {
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('authToken', token);

            const data = await authFetch('/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setAuthState({
                isAuthenticated: true,
                token,
                user: data.user,
                isLoading: false,
                error: null
            });
            
            return data.user;
        } catch (error) {
            console.error('Login verification failed:', error);
            setAuthState(prev => ({
                ...prev,
                error: error.message || 'Login verification failed'
            }));
            logout();
            throw error;
        }
    };

    const logout = (redirect = true) => {
        console.debug('Logging out...');
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
        
        setAuthState({
            isAuthenticated: false,
            token: null,
            user: null,
            isLoading: false,
            error: null
        });
        
        if (redirect) {
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider value={{ 
            ...authState,
            login,
            logout,
            refreshAuth: initializeAuth
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};