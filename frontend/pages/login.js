'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const [form, setForm] = useState({
        email: '',
        password: '',
        rememberMe: false
    })
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState({ email: '', password: '', form: '' })

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Reset previous errors
        setErrors({ email: '', password: '', form: '' })

        // Basic validation
        if (!form.email.trim()) {
            setErrors(prev => ({ ...prev, email: 'Email is required' }))
            return
        }
        if (!form.password) {
            setErrors(prev => ({ ...prev, password: 'Password is required' }))
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch('http://localhost:8000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: form.email,
                    password: form.password
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                if (data.detail) {
                    if (Array.isArray(data.detail)) {
                        const backendErrors = {}
                        data.detail.forEach(err => {
                            if (err.loc.includes('username')) {
                                backendErrors.email = err.msg
                            } else if (err.loc.includes('password')) {
                                backendErrors.password = err.msg
                            }
                        })
                        setErrors(prev => ({ ...prev, ...backendErrors }))
                    } else {
                        setErrors(prev => ({ ...prev, form: data.detail }))
                    }
                } else {
                    setErrors(prev => ({ ...prev, form: 'Login failed. Please try again.' }))
                }
                return
            }

            const storage = form.rememberMe ? localStorage : sessionStorage
            storage.setItem('auth', data.access_token)
            router.push('/dashboard')

        } catch (err) {
            setErrors(prev => ({ ...prev, form: 'Network error. Please try again.' }))
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
                            />
                            <h1 className="text-3xl font-bold text-black">CareChain</h1>
                        </div>
                        <h2 className="text-xl text-black mt-2">Welcome Back</h2>
                    </div>

                    {/* Error Messages */}
                    {(errors.form || errors.email || errors.password) && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded space-y-1">
                            {errors.form && <div>{errors.form}</div>}
                            {errors.email && <div>{errors.email}</div>}
                            {errors.password && <div>{errors.password}</div>}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Email address</label>
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

                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Password</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black"
                                placeholder="Enter your password"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    id="rememberMe"
                                    checked={form.rememberMe}
                                    onChange={handleChange}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="rememberMe" className="ml-2 block text-sm text-black">
                                    Remember me
                                </label>
                            </div>
                            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>

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
