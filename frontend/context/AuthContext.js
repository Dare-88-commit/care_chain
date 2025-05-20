import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const AuthContext = createContext();

// Use environment variable with localhost fallback
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
            console.log('initializeAuth token:', token);

            if (!token) {
                setAuthState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            try {
                // Use API_BASE_URL instead of hardcoded URL
                const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    credentials: 'include' // Important for cookies
                });

                console.log('verify status:', response.status);

                if (response.ok) {
                    const userData = await response.json(); // Get user data directly from verify endpoint
                    setAuthState({
                        isAuthenticated: true,
                        token,
                        user: userData.user, // Changed from fetchUserData()
                        isLoading: false
                    });
                } else {
                    console.log('Token invalid, logging out...');
                    logout();
                }
            } catch (error) {
                console.log('Error during token verification:', error);
                logout();
            }
        };

        initializeAuth();
    }, []);

    const login = async (token, rememberMe) => {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('authToken', token);

        try {
            // Verify token immediately after login
            const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!verifyResponse.ok) {
                throw new Error('Session verification failed');
            }

            const userData = await verifyResponse.json();
            
            setAuthState({
                isAuthenticated: true,
                token,
                user: userData.user, // Use user data from verify endpoint
                isLoading: false
            });
        } catch (error) {
            console.error('Login verification failed:', error);
            logout();
            throw error; // Re-throw to show error in UI
        }
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