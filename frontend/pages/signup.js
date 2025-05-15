'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignUpPage() {
    const router = useRouter()
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        agree: false,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    // Submit handler with enhanced error handling
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // Client-side validation
        if (!form.agree) {
            setError('You must agree to the Terms and Conditions.')
            return
        }

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match!')
            return
        }

        if (form.password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        setIsLoading(true)

        try {
            // API request to FastAPI backend
            const response = await fetch('http://localhost:8000/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password
                }),
            })

            // Handle HTTP errors
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Signup failed')
            }

            // Success case
            const data = await response.json()
            localStorage.setItem('authToken', data.access_token) // Store token
            router.push('/dashboard') // Redirect to dashboard

        } catch (err) {
            // Network/backend errors
            console.error('Signup error:', err)
            setError(err.message || 'Signup failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen">
            {/* Left Side - Illustration */}
            <div className="w-2/5 bg-blue-50 hidden md:flex items-center justify-center">
                <Image
                    src="/images/doctor-illustration2.svg"
                    alt="Doctor Illustration"
                    width={450}
                    height={450}
                    priority
                />
            </div>

            {/* Right Side - Sign Up Form */}
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
                        <h2 className="text-xl text-black mt-2">Create Account</h2>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {/* Sign Up Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name Field */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                                placeholder="Enter your full name"
                                minLength={2}
                            />
                        </div>

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
                                required
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                                placeholder="Enter your email"
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
                                required
                                minLength={8}
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                                placeholder="Create a password (min 8 characters)"
                            />
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                                placeholder="Confirm your password"
                            />
                        </div>

                        {/* Terms Checkbox */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                name="agree"
                                checked={form.agree}
                                onChange={handleChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-black">
                                I agree to the{' '}
                                <Link href="/terms" className="text-blue-600 hover:underline">
                                    Terms and Conditions
                                </Link>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                        >
                            {isLoading ? 'Signing Up...' : 'Sign Up'}
                        </button>
                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-black mt-6">
                        Already have an account?{' '}
                        <Link href="/login" className="text-blue-600 hover:underline font-medium">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}