// pages/forgot-password.js
'use client'
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus('');

        if (!email.trim()) {
            setStatus('Please enter your email.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('https://care-chain.onrender.com/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to send reset email');
            }

            setStatus('Password reset link sent! Check your email.');
        } catch (error) {
            console.error(error);
            setStatus(error.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Illustration Side */}
            <div className="w-2/5 bg-blue-50 hidden md:flex items-center justify-center">
                <Image
                    src="/images/doctor-illustration.svg"
                    alt="Doctor Illustration"
                    width={450}
                    height={450}
                    priority
                />
            </div>

            {/* Form Side */}
            <div className="w-full md:w-3/5 flex items-center justify-center px-6 py-12 bg-white">
                <div className="max-w-md w-full mx-auto space-y-8">
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
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Forgot your password?
                        </h2>
                        <p className="text-xl text-black mt-2">
                            Enter your email to receive reset instructions.
                        </p>
                    </div>

                    {status && (
                        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                            {status}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                className="mt-1 w-full px-4 py-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black border-gray-300"
                                placeholder="Enter your email"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>

                    <div className="text-center text-sm mt-6">
                        <Link href="/login" className="text-blue-600 hover:underline">
                            Back to login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
