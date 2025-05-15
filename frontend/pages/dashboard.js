'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import QRCode from 'react-qr-code'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { openDB } from 'idb'

// Initialize IndexedDB
const initDB = async () => {
    return openDB('CareChainDB', 1, {
        upgrade(db) {
            db.createObjectStore('patients', { keyPath: 'id' })
            db.createObjectStore('pending', { keyPath: 'id' })
        },
    })
}

export default function DashboardPage() {
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('dashboard')
    const [showAddPatientModal, setShowAddPatientModal] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)
    const [newPatient, setNewPatient] = useState({
        fullName: '',
        age: '',
        condition: ''
    })
    const [patients, setPatients] = useState([])
    const [token, setToken] = useState('')
    const [isOnline, setIsOnline] = useState(true)
    const [syncStatus, setSyncStatus] = useState('up-to-date')
    const router = useRouter()

    useEffect(() => {
        const storedToken = localStorage.getItem('auth')
        if (!storedToken) {
            router.push('/login')
        }
        setToken(storedToken)

        // Set up online/offline detection
        const handleOnline = () => {
            setIsOnline(true)
            syncPendingPatients()
        }
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        setIsOnline(navigator.onLine)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [router])

    useEffect(() => {
        if (token) {
            fetchPatients()
        }
    }, [token])

    const fetchPatients = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:8000/patients', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            setPatients(response.data)

            // Cache in IndexedDB
            const db = await initDB()
            const tx = db.transaction('patients', 'readwrite')
            await Promise.all(
                response.data.map(patient =>
                    tx.objectStore('patients').put(patient)
                )
            )
        } catch (error) {
            console.error('Online fetch failed, loading from cache:', error)
            try {
                const db = await initDB()
                const cached = await db.getAll('patients')
                setPatients(cached)
            } catch (dbError) {
                console.error('Failed to load from cache:', dbError)
            }
        }
    }

    const syncPendingPatients = async () => {
        if (!isOnline) return

        try {
            setSyncStatus('syncing')
            const db = await initDB()
            const pending = await db.getAll('pending')

            if (pending.length === 0) {
                setSyncStatus('up-to-date')
                return
            }

            for (const patient of pending) {
                try {
                    const response = await axios.post(
                        'http://127.0.0.1:8000/patients',
                        {
                            fullName: patient.fullName,
                            age: Number(patient.age),
                            condition: patient.condition
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    )

                    // Remove from pending and add to patients
                    await db.delete('pending', patient.id)
                    setPatients(prev => [...prev, response.data])
                } catch (syncError) {
                    console.error('Failed to sync patient:', syncError)
                    setSyncStatus('error')
                    break // Stop on first error
                }
            }
            setSyncStatus('up-to-date')
        } catch (error) {
            console.error('Error syncing pending patients:', error)
            setSyncStatus('error')
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('auth')
        router.push('/login')
    }

    const handlePatientChange = (e) => {
        const { name, value } = e.target
        setNewPatient(prev => ({ ...prev, [name]: value }))
    }

    const handlePatientSubmit = async (e) => {
        e.preventDefault()

        if (!isOnline) {
            try {
                const db = await initDB()
                const offlinePatient = {
                    ...newPatient,
                    id: Date.now(), // Temp ID
                    offline: true
                }
                await db.add('pending', offlinePatient)
                setPatients(prev => [...prev, offlinePatient])
                setShowAddPatientModal(false)
                setNewPatient({ fullName: '', age: '', condition: '' })
                alert('Patient saved locally and will sync when online!')
            } catch (error) {
                console.error('Error saving offline:', error)
                alert('Failed to save patient locally')
            }
            return
        }

        try {
            const response = await axios.post(
                'http://127.0.0.1:8000/patients',
                {
                    ...newPatient,
                    age: Number(newPatient.age)
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            )
            setPatients(prev => [...prev, response.data])
            setShowAddPatientModal(false)
            setNewPatient({ fullName: '', age: '', condition: '' })
            alert('Patient added successfully!')
        } catch (error) {
            console.error('Error adding patient:', error)
            alert(`Failed to add patient: ${error.response?.data?.detail || error.message}`)
            if (error.response?.status === 401) {
                handleLogout()
            }
        }
    }

    const handleScanSuccess = (result) => {
        const patientId = result.split('/').pop()
        setShowQRScanner(false)
        if (patientId) {
            router.push(`/patients/${patientId}`)
        }
    }

    const downloadQRCode = (patientId) => {
        const svg = document.getElementById(`qrcode-${patientId}`)
        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        const img = new Image()

        img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            const pngFile = canvas.toDataURL("image/png")
            const downloadLink = document.createElement("a")
            downloadLink.download = `patient-${patientId}-qrcode.png`
            downloadLink.href = `${pngFile}`
            downloadLink.click()
        }

        img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <div className="w-64 bg-blue-700 text-white p-6 space-y-8 fixed h-full">
                <div className="flex items-center space-x-3">
                    <Image src="/images/carechain-logo.png" alt="CareChain Logo" width={40} height={40} />
                    <div className="text-2xl font-bold">CareChain</div>
                </div>

                <div className="space-y-2">
                    {[
                        { tab: 'dashboard', label: 'Overview' },
                        { tab: 'patients', label: 'Patients' },
                        { tab: 'qr-scanner', label: 'QR Scanner' },
                        { tab: 'appointments', label: 'Appointments' },
                        { tab: 'settings', label: 'Settings' }
                    ].map(({ tab, label }) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${activeTab === tab ? 'bg-blue-600' : 'hover:bg-blue-800'}`}
                        >
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                    <div className="mb-4 text-sm">
                        Status: {isOnline ? (
                            <span className="text-green-300">Online{syncStatus !== 'up-to-date' && ` (${syncStatus})`}</span>
                        ) : (
                            <span className="text-yellow-300">Offline - Working locally</span>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 p-3 bg-blue-800 hover:bg-blue-900 rounded-lg transition"
                    >
                        <span>Logout</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 ml-64 p-8 space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="text-3xl font-bold text-black capitalize">
                        {activeTab}
                    </div>
                    <div className="flex items-center space-x-4">
                        <input
                            type="text"
                            placeholder="Search"
                            className="text-black pl-4 pr-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="flex items-center space-x-2">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                                JD
                            </div>
                            <span className="font-medium text-black">Dr. John Doe</span>
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'dashboard' && <DashboardHome setShowAddPatientModal={setShowAddPatientModal} isOnline={isOnline} />}
                {activeTab === 'patients' && <PatientsPage patients={patients} onScanClick={() => setShowQRScanner(true)} downloadQRCode={downloadQRCode} />}
                {activeTab === 'qr-scanner' && <QRScannerPage onScanSuccess={handleScanSuccess} />}
                {activeTab === 'appointments' && <AppointmentsPage />}
                {activeTab === 'settings' && <SettingsPage />}

                {/* Add Patient Modal */}
                {showAddPatientModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <div className="bg-white p-8 rounded-xl w-full max-w-md">
                            <h2 className="text-2xl font-bold text-black mb-6">Add New Patient</h2>
                            {!isOnline && (
                                <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded">
                                    You're offline. Patient will be saved locally and synced when you're back online.
                                </div>
                            )}
                            <form onSubmit={handlePatientSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={newPatient.fullName}
                                        onChange={handlePatientChange}
                                        placeholder="Enter patient's full name"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">Age</label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={newPatient.age}
                                        onChange={handlePatientChange}
                                        placeholder="Enter patient's age"
                                        min="0"
                                        max="120"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">Condition</label>
                                    <input
                                        type="text"
                                        name="condition"
                                        value={newPatient.condition}
                                        onChange={handlePatientChange}
                                        placeholder="Describe the medical condition"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end space-x-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddPatientModal(false)}
                                        className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                    >
                                        {isOnline ? 'Save' : 'Save Locally'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* QR Scanner Modal */}
                {showQRScanner && (
                    <QRScannerModal
                        onClose={() => setShowQRScanner(false)}
                        onScanSuccess={handleScanSuccess}
                    />
                )}
            </div>
        </div>
    )
}

function DashboardHome({ setShowAddPatientModal, isOnline }) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Patients" value="142" icon="group" growth="↑ 12%" color="green" />
                <StatCard label="Critical Cases" value="8" icon="warning" growth="↑ 3 this week" color="red" />
                <StatCard label="Today's Appointments" value="5" icon="event_available" growth="2 in next hour" color="gray" />
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4 text-black">Quick Actions</h2>
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={() => setShowAddPatientModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition"
                    >
                        Add New Patient
                    </button>
                    <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition">
                        View Appointments
                    </button>
                    <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-800 transition">
                        Emergency Alert
                    </button>
                    {!isOnline && (
                        <span className="flex items-center text-yellow-600">
                            (Working in offline mode)
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4 text-black">Recent Activities</h2>
                <ul className="space-y-3 text-black">
                    <li>🟢 Patient <strong>Jane Smith</strong> was admitted (10 mins ago)</li>
                    <li>🔴 Emergency case flagged: <strong>Heart Attack</strong> (30 mins ago)</li>
                    <li>🟡 Updated record for <strong>Mike Johnson</strong> (1 hr ago)</li>
                </ul>
            </div>
        </div>
    )
}

function PatientsPage({ patients, onScanClick, downloadQRCode }) {
    const [selectedPatient, setSelectedPatient] = useState(null)
    const [qrCodeData, setQrCodeData] = useState(null)
    const token = localStorage.getItem('auth')

    const fetchQRCode = async (patientId) => {
        try {
            const response = await axios.get(
                `http://127.0.0.1:8000/patients/${patientId}/qrcode`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )
            setQrCodeData(response.data.qr_code)
            setSelectedPatient(patientId)
        } catch (error) {
            console.error('Error fetching QR code:', error)
            alert('Failed to generate QR code')
        }
    }

    return (
        <div className="text-black space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Patients List</h2>
                <button
                    onClick={onScanClick}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition"
                >
                    Scan QR
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {patients.map((patient) => (
                    <div key={patient.id} className="bg-white p-4 rounded-xl shadow border border-gray-100 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">{patient.fullName}</h3>
                            <p>Age: {patient.age}</p>
                            <p>Condition: {patient.condition}</p>
                            {patient.offline && <p className="text-yellow-600 text-sm">(Pending sync)</p>}
                        </div>
                        <div className="flex flex-col space-y-2">
                            <button
                                onClick={() => fetchQRCode(patient.id)}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                                disabled={patient.offline}
                            >
                                {patient.offline ? 'Generate when online' : 'Generate QR Code'}
                            </button>
                            <div id={`qrcode-${patient.id}`} className="flex justify-center">
                                <QRCode
                                    value={`http://localhost:3000/patients/${patient.id}`}
                                    size={128}
                                    bgColor="#ffffff"
                                    fgColor="#000000"
                                    level="H"
                                />
                            </div>
                            <button
                                onClick={() => downloadQRCode(patient.id)}
                                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                            >
                                Download QR Code
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {qrCodeData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Patient QR Code</h2>
                        <div className="flex flex-col items-center space-y-4">
                            <img
                                src={`data:image/png;base64,${qrCodeData}`}
                                alt="Patient QR Code"
                                className="w-48 h-48"
                            />
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a')
                                        link.href = `data:image/png;base64,${qrCodeData}`
                                        link.download = `patient-${selectedPatient}-qrcode.png`
                                        link.click()
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                                >
                                    Download
                                </button>
                                <button
                                    onClick={() => setQrCodeData(null)}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function QRScannerPage({ onScanSuccess }) {
    const [scanResult, setScanResult] = useState(null)

    useEffect(() => {
        const scanner = new Html5QrcodeScanner('qr-scanner', {
            qrbox: { width: 250, height: 250 },
            fps: 5,
        })

        scanner.render(
            (result) => {
                scanner.clear()
                setScanResult(result)
                onScanSuccess(result)
            },
            (error) => console.warn('QR Scan Error:', error)
        )

        return () => scanner.clear()
    }, [onScanSuccess])

    return (
        <div className="p-8">
            <h1 className="text-black text-2xl font-bold mb-4">Scan Patient QR Code</h1>
            {scanResult ? (
                <div className="p-4 bg-green-100 rounded-lg">
                    Found: {scanResult}
                </div>
            ) : (
                <div id="qr-scanner" className="w-full max-w-md"></div>
            )}
        </div>
    )
}

function QRScannerModal({ onClose, onScanSuccess }) {
    const [scanResult, setScanResult] = useState(null)

    useEffect(() => {
        const scanner = new Html5QrcodeScanner('qr-scanner-modal', {
            qrbox: { width: 250, height: 250 },
            fps: 5,
        })

        scanner.render(
            (result) => {
                scanner.clear()
                setScanResult(result)
                onScanSuccess(result)
            },
            (error) => console.warn('QR Scan Error:', error)
        )

        return () => scanner.clear()
    }, [onScanSuccess])

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-xl w-full max-w-md">
                <h2 className="text-black text-2xl font-bold mb-4">Scan Patient QR Code</h2>
                {scanResult ? (
                    <div className="p-4 bg-green-100 rounded-lg">
                        Found: {scanResult}
                    </div>
                ) : (
                    <div id="qr-scanner-modal" className="w-full"></div>
                )}
                <button
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-500 transition text-black"
                >
                    Close Scanner
                </button>
            </div>
        </div>
    )
}

function AppointmentsPage() {
    return (
        <div className="text-black">
            <h2 className="text-2xl font-bold mb-6">Appointments</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p>Appointment scheduler coming soon.</p>
            </div>
        </div>
    )
}

function SettingsPage() {
    return (
        <div className="text-black">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p>Settings will be configurable here.</p>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon, growth, color }) {
    const colorMap = {
        green: 'text-green-600 bg-green-100',
        red: 'text-red-600 bg-red-100',
        gray: 'text-gray-600 bg-gray-100'
    }
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-black font-medium">{label}</h3>
                    <p className="text-3xl font-bold mt-2 text-black">{value}</p>
                </div>
                <div className={`p-3 rounded-lg ${colorMap[color]}`}>
                    <span className="material-icons">{icon}</span>
                </div>
            </div>
            <p className={`text-sm mt-4 ${colorMap[color].split(' ')[0]}`}>{growth}</p>
        </div>
    )
}