'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
    const router = useRouter()
    const [form, setForm] = useState({
        email: '',
        password: '',
        rememberMe: false,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState({
        email: '',
        password: '',
        form: ''
    })

    // Unified input handler
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
        // Clear error when typing
        setErrors(prev => ({ ...prev, [name]: '' }))
    }

    // Enhanced login handler
    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsLoading(true)
        setErrors({ email: '', password: '', form: '' })

        // Client-side validation
        if (!form.email.trim()) {
            setErrors(prev => ({ ...prev, email: 'Email is required' }))
            setIsLoading(false)
            return
        }

        if (!form.password) {
            setErrors(prev => ({ ...prev, password: 'Password is required' }))
            setIsLoading(false)
            return
        }

        try {
            // API request with proper OAuth2 formatting
            const formData = new URLSearchParams()
            formData.append('username', form.email) // FastAPI expects 'username'
            formData.append('password', form.password)

            const response = await fetch('http://localhost:8000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
                credentials: 'include' // For cookies if using them
            })

            // Handle HTTP errors
            if (!response.ok) {
                const errorData = await response.json()

                // Backend validation errors
                if (errorData.detail === "Incorrect email or password") {
                    throw new Error("Invalid credentials")
                } else if (Array.isArray(errorData.detail)) {
                    const backendErrors = {}
                    errorData.detail.forEach(err => {
                        if (err.loc.includes('username')) {
                            backendErrors.email = err.msg
                        } else if (err.loc.includes('password')) {
                            backendErrors.password = err.msg
                        }
                    })
                    throw new Error(backendErrors.email || backendErrors.password || "Login failed")
                } else {
                    throw new Error(errorData.detail || "Login failed")
                }
            }

            // Success case
            const { access_token } = await response.json()

            // Store token based on rememberMe choice
            const storage = form.rememberMe ? localStorage : sessionStorage
            storage.setItem('authToken', access_token)

            // Set default auth header for subsequent requests
            if (typeof window !== 'undefined') {
                window.__authToken = access_token
            }

            toast.success('Login successful!')
            router.push('/dashboard')

        } catch (err) {
            console.error('Login error:', err)
            setErrors(prev => ({
                ...prev,
                form: err.message || 'Login failed. Please try again.'
            }))
            toast.error(err.message || 'Login failed')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen">
            {/* Left Side - Illustration */}
            <div className="w-2/5 bg-blue-50 hidden md:flex items-center justify-center">
                <Image
                    src="/images/doctor-illustration.svg"
                    alt="Doctor Illustration"
                    width={450}
                    height={450}
                    priority
                />
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full md:w-3/5 bg-white flex flex-col justify-center px-10 py-12">
                <div className="max-w-md w-full mx-auto space-y-8">
                    {/* Logo + Heading */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center space-x-3">
                            <Image
                                src="/images/carechain-logo.png"
                                alt="CareChain Logo"
                                width={50}
                                height={50}
                                priority
                            />
                            <h1 className="text-3xl font-bold text-black">CareChain</h1>
                        </div>
                        <h2 className="text-xl text-black mt-2">Welcome Back</h2>
                    </div>

                    {/* Combined Error Display */}
                    {(errors.form || errors.email || errors.password) && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {errors.form || errors.email || errors.password}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Field */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">
                                Email address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className={`mt-1 w-full px-4 py-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black ${errors.email ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                placeholder="Enter your email"
                                disabled={isLoading}
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className={`mt-1 w-full px-4 py-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black ${errors.password ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                placeholder="Enter your password"
                                disabled={isLoading}
                            />
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    id="rememberMe"
                                    checked={form.rememberMe}
                                    onChange={handleChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    disabled={isLoading}
                                />
                                <label htmlFor="rememberMe" className="ml-2 block text-sm text-black">
                                    Remember me
                                </label>
                            </div>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-blue-600 hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing In...
                                </span>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    {/* Signup Link */}
                    <p className="text-center text-sm text-black mt-6">
                        Don't have an account?{' '}
                        <Link href="/signup" className="text-blue-600 hover:underline font-medium">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}