// pages/404.js

import Link from 'next/link'
import Image from 'next/image'

export default function Custom404() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
            <Image
                src="/images/doctor-illustration.svg"
                alt="Page Not Found"
                width={350}
                height={350}
            />
            <h1 className="text-4xl font-bold text-gray-800 mt-6">404 - Page Not Found</h1>
            <p className="text-gray-600 mt-2 text-center">
                Sorry, the page you are looking for does not exist.
            </p>
            <Link href="/dashboard" className="mt-4 text-blue-600 hover:underline">
                <button className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Go Home
                </button>
            </Link>
        </div>
    )
}
