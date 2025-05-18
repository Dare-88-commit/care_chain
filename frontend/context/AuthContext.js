// context/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [authState, setAuthState] = useState({
        isAuthenticated: false,
        token: null,
        user: null,
        isLoading: true
    });
    const router = useRouter();

    useEffect(() => {
        const initializeAuth = async () => {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

            if (!token) {
                setAuthState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            try {
                const response = await fetch('http://localhost:8000/auth/verify', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const userData = await fetchUserData(token);
                    setAuthState({
                        isAuthenticated: true,
                        token,
                        user: userData,
                        isLoading: false
                    });
                } else {
                    logout();
                }
            } catch (error) {
                logout();
            }
        };

        initializeAuth();
    }, []);

    const fetchUserData = async (token) => {
        try {
            const response = await fetch('http://localhost:8000/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            return null;
        }
    };

    const login = async (token, rememberMe) => {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('authToken', token);

        const userData = await fetchUserData(token);
        setAuthState({
            isAuthenticated: true,
            token,
            user: userData,
            isLoading: false
        });
    };

    const logout = () => {
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('authToken');
        setAuthState({
            isAuthenticated: false,
            token: null,
            user: null,
            isLoading: false
        });
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ ...authState, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);