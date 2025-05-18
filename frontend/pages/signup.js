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

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

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
            const response = await fetch('http://localhost:8000/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    confirm_password: form.confirmPassword, // Add this line
                    role: "nurse" // Default role
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                console.log('Error response:', errorData) // For debugging

                // Handle different error formats
                let errorMessage = 'Signup failed'
                if (typeof errorData === 'string') {
                    errorMessage = errorData
                } else if (errorData?.detail) {
                    if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail
                    } else if (errorData.detail?.message) {
                        errorMessage = errorData.detail.message
                    } else if (Array.isArray(errorData.detail)) {
                        errorMessage = errorData.detail
                            .map(err => `${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`)
                            .join('\n')
                    }
                }

                throw new Error(errorMessage)
            }

            // Success case
            router.push('/login')

        } catch (err) {
            console.error('Signup error:', err)
            setError(err.message || 'Signup failed. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen">
            {/* Left Illustration */}
            <div className="w-2/5 bg-blue-50 hidden md:flex items-center justify-center">
                <Image
                    src="/images/doctor-illustration2.svg"
                    alt="Doctor Illustration"
                    width={450}
                    height={450}
                    priority
                />
            </div>

            {/* Sign Up Form */}
            <div className="w-full md:w-3/5 bg-white flex flex-col justify-center px-10 py-12">
                <div className="max-w-md w-full mx-auto space-y-8">
                    {/* Logo and Heading */}
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

                    {/* Error */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                placeholder="Enter your full name"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Email address</label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder="Enter your email"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                minLength={8}
                                placeholder="Create a password (min 8 characters)"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Confirm Password</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                required
                                placeholder="Confirm your password"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                            />
                        </div>

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

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'Signing Up...' : 'Sign Up'}
                        </button>
                    </form>

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
