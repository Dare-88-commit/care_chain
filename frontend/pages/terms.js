// pages/terms.js
'use client'
import Link from 'next/link'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white px-6 py-12 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold text-black mb-6">Terms and Conditions</h1>

            <p className="text-black mb-4">
                Welcome to CareChain. By using our website and services, you agree to the following terms and conditions. Please read them carefully.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">1. Acceptance of Terms</h2>
            <p className="text-black mb-4">
                By accessing or using CareChain, you agree to be bound by these terms and all applicable laws and regulations.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">2. Use of Services</h2>
            <p className="text-black mb-4">
                CareChain provides secure health record management services. You agree to use our services only for lawful purposes and not to misuse any part of our platform.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">3. Privacy</h2>
            <p className="text-black mb-4">
                Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use your information.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">4. Accounts</h2>
            <p className="text-black mb-4">
                You are responsible for maintaining the confidentiality of your account information and password. CareChain is not liable for any loss or damage from your failure to protect this information.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">5. Termination</h2>
            <p className="text-black mb-4">
                We reserve the right to suspend or terminate your account if you violate any of these terms.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">6. Changes to Terms</h2>
            <p className="text-black mb-4">
                CareChain may revise these terms at any time without notice. By using this site, you agree to be bound by the current version of these terms.
            </p>

            <h2 className="text-xl font-semibold text-black mb-2">7. Contact Us</h2>
            <p className="text-black mb-8">
                If you have any questions about these Terms, please contact us at support@carechain.com.
            </p>

            <Link href="/signup" className="text-blue-600 hover:underline">
                Back to Sign Up
            </Link>
        </div>
    )
}
