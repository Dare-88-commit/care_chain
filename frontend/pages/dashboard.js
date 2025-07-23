'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import QRCode from 'react-qr-code'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { openDB } from 'idb'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

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
    const { isAuthenticated, isLoading, token, logout } = useAuth()
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')
    const [activeTab, setActiveTab] = useState('dashboard')
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showAddPatientModal, setShowAddPatientModal] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)
    const [newPatient, setNewPatient] = useState({
        fullName: '',
        age: '',
        gender: 'male',
        bloodType: '',
        condition: '',
        severity: 'medium',
        warnings: [],
        allergies: '',
        symptoms: '',
        emergencyContact: '',
        insuranceInfo: ''
    })
    const [patients, setPatients] = useState([])
    const [isOnline, setIsOnline] = useState(true)
    const [syncStatus, setSyncStatus] = useState('up-to-date')

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [isAuthenticated, isLoading, router])

    useEffect(() => {
        if (isAuthenticated && token) {
            fetchPatients()
        }
    }, [isAuthenticated, token])

    useEffect(() => {
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
    }, [])

    const fetchPatients = async () => {
        try {
            const response = await axios.get('https://care-chain.onrender.com/patients', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setPatients(response.data)

            const db = await initDB()
            const tx = db.transaction('patients', 'readwrite')
            await Promise.all(
                response.data.map(patient => tx.objectStore('patients').put(patient))
            ) // This closing parenthesis was missing
        } catch (error) {
            console.error('Online fetch failed, loading from cache:', error)
            try {
                const db = await initDB()
                const cached = await db.getAll('patients')
                setPatients(cached)
                toast.error('Using cached data - offline mode')
            } catch (dbError) {
                console.error('Failed to load from cache:', dbError)
                toast.error('Failed to load patient data')
            }
        }
    }

    const syncPendingPatients = async () => {
        if (!isOnline || !token) return

        try {
            setSyncStatus('syncing')
            const db = await initDB()
            const pending = await db.getAll('pending')

            if (pending.length === 0) {
                setSyncStatus('up-to-date')
                return
            }

            const synced = []
            for (const patient of pending) {
                try {
                    const response = await axios.post(
                        'https://care-chain.onrender.com/patients',
                        {
                            full_name: patient.fullName,
                            age: Number(patient.age),
                            gender: patient.gender,
                            blood_type: patient.bloodType || null,
                            condition: patient.condition,
                            severity: patient.severity,
                            warnings: patient.warnings,
                            allergies: patient.allergies,
                            symptoms: patient.symptoms,
                            emergency_contact: patient.emergencyContact || '',
                            insurance_info: patient.insuranceInfo || ''
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    )
                    await db.delete('pending', patient.id)
                    synced.push(response.data)
                } catch (syncError) {
                    console.error('Failed to sync patient:', syncError)
                    setSyncStatus('error')
                    toast.error(`Failed to sync patient: ${patient.fullName}`)
                    break
                }
            }

            if (synced.length > 0) {
                toast.success(`Synced ${synced.length} patient(s)!`)
                setPatients(prev => [...prev.filter(p => !p.offline), ...synced])
            }
            setSyncStatus('up-to-date')
        } catch (error) {
            console.error('Error syncing pending patients:', error)
            setSyncStatus('error')
            toast.error('Error syncing pending patients')
        }
    }

    const handleLogout = () => {
        logout()
        router.push('/login')
    }

    const handlePatientChange = (e) => {
        const { name, value } = e.target
        setNewPatient(prev => ({ ...prev, [name]: value }))
    }

    // Update handlePatientSubmit to support offline saving and warnings array
    const handlePatientSubmit = async (e) => {
        e.preventDefault();

        // Validate required fields
        if (!newPatient.fullName || !newPatient.age || !newPatient.condition) {
            toast.error('Name, age and condition are required');
            return;
        }

        // Always ensure warnings is an array
        const warningsArr = Array.isArray(newPatient.warnings)
            ? newPatient.warnings
            : String(newPatient.warnings || "").split(",").map(w => w.trim()).filter(Boolean);

        const patientData = {
            full_name: newPatient.fullName.trim(),
            age: Number(newPatient.age),
            gender: newPatient.gender || "male",
            blood_type: newPatient.bloodType || null,
            condition: newPatient.condition.trim(),
            severity: newPatient.severity || "medium",
            warnings: warningsArr,
            allergies: String(newPatient.allergies || "").trim(),
            symptoms: String(newPatient.symptoms || "").trim(),
            emergency_contact: String(newPatient.emergencyContact || "").trim(),
            insurance_info: String(newPatient.insuranceInfo || "").trim()
        };

        if (!isOnline) {
            // Save locally to IndexedDB
            try {
                const db = await initDB();
                const offlinePatient = {
                    ...patientData,
                    id: `offline-${Date.now()}`,
                    fullName: patientData.full_name,
                    offline: true
                };
                await db.put('pending', offlinePatient);
                setPatients(prev => [...prev, offlinePatient]);
                setShowAddPatientModal(false);
                setNewPatient({
                    fullName: '',
                    age: '',
                    gender: 'male',
                    bloodType: '',
                    condition: '',
                    severity: 'medium',
                    warnings: [],
                    allergies: '',
                    symptoms: '',
                    emergencyContact: '',
                    insuranceInfo: ''
                });
                toast.success('Patient saved locally! Will sync when online.');
            } catch (err) {
                toast.error('Failed to save patient locally');
                console.error('IndexedDB error:', err);
            }
            return;
        }

        try {
            const response = await axios.post(
                'https://care-chain.onrender.com/patients',
                patientData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setPatients(prev => [...prev, response.data]);
            setShowAddPatientModal(false);
            setNewPatient({
                fullName: '',
                age: '',
                gender: 'male',
                bloodType: '',
                condition: '',
                severity: 'medium',
                warnings: [],
                allergies: '',
                symptoms: '',
                emergencyContact: '',
                insuranceInfo: ''
            });
            toast.success('Patient added successfully!');
        } catch (error) {
            let errorMessage = 'Failed to add patient';
            if (error.response) {
                if (error.response.status === 422) {
                    const details = error.response.data.detail;
                    if (Array.isArray(details)) {
                        errorMessage = details.map(d => d.msg).join(', ');
                    } else {
                        errorMessage = 'Validation failed';
                    }
                } else if (error.response.status === 401) {
                    errorMessage = 'Session expired - please login again';
                    logout();
                    router.push('/login');
                } else {
                    errorMessage = error.response.data?.detail || `Server error (${error.response.status})`;
                }
            }
            toast.error(errorMessage);
        }
    };


    const handleScanSuccess = (result) => {
        const patientId = result.split('/').pop()
        setShowQRScanner(false)
        if (patientId) {
            router.push(`/patients/${patientId}`)
        }
    }

    const downloadQRCode = (patientId) => {
        try {
            const svgElement = document.getElementById(`qrcode-${patientId}`)?.querySelector('svg');
            if (!svgElement) {
                toast.error('QR code not found for download');
                return;
            }
            // Serialize the SVG
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new window.Image();

            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const pngUrl = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.download = `patient-${patientId}-qrcode.png`;
                downloadLink.href = pngUrl;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            };

            img.onerror = (e) => {
                toast.error('Error loading QR code image');
                console.error('Error loading image:', e);
            };

            // Properly encode SVG
            const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
            img.src = `data:image/svg+xml;base64,${svgBase64}`;
        } catch (error) {
            toast.error('Error downloading QR code');
            console.error('Error in downloadQRCode:', error);
        }
    };
    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-2xl">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Mobile Header with Hamburger */}
            <div className="md:hidden flex justify-between items-center p-4 bg-blue-700 text-white">
                <div className="flex items-center space-x-3">
                    <Image src="/images/carechain-logo.png" alt="CareChain Logo" width={40} height={40} />
                    <div className="text-2xl font-bold">CareChain</div>
                </div>
                <button
                    className="text-white"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Sidebar - Mobile overlay, Tablet+ sticky */}
            <div
                className={`${isSidebarOpen ? 'block fixed inset-0 z-50 bg-black bg-opacity-50' : 'hidden'} md:block md:relative md:w-64`}
                onClick={() => setIsSidebarOpen(false)}
            >
                <div
                    className={`w-64 bg-blue-700 text-white p-6 space-y-8 h-full transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative`}
                    onClick={(e) => e.stopPropagation()}
                >
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
                                onClick={() => {
                                    setActiveTab(tab);
                                    setIsSidebarOpen(false);
                                }}
                                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition ${activeTab === tab ? 'bg-blue-600' : 'hover:bg-blue-800'
                                    }`}
                            >
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="absolute bottom-6 left-6 right-6">
                        <div className="mb-4 text-sm">
                            Status: {isOnline ? (
                                <span className="text-green-300">
                                    Online{syncStatus !== 'up-to-date' && ` (${syncStatus})`}
                                </span>
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
            </div>

            {/* Main Content */}
            <div className="flex-1 md:ml-2 p-4 md:p-8 space-y-6 md:space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                    <div className="text-2xl md:text-3xl font-bold text-black capitalize">
                        {activeTab}
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm md:text-base">
                                JD
                            </div>
                            <span className="font-medium text-black text-sm md:text-base">Dr. John Doe</span>
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="overflow-x-auto">
                    {activeTab === 'dashboard' && <DashboardHome setShowAddPatientModal={setShowAddPatientModal} isOnline={isOnline} />}
                    {activeTab === 'patients' && <PatientsPage patients={patients} onScanClick={() => setShowQRScanner(true)} downloadQRCode={downloadQRCode} token={token} />}
                    {activeTab === 'qr-scanner' && <QRScannerPage onScanSuccess={handleScanSuccess} />}
                    {activeTab === 'appointments' && <AppointmentsPage />}
                    {activeTab === 'settings' && <SettingsPage />}
                </div>

                {/* Add Patient Modal */}
                {showAddPatientModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 overflow-y-auto py-8">
                        <div className="bg-white p-6 md:p-8 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
                            <div className="sticky top-0 bg-white pb-4">
                                <h2 className="text-xl md:text-2xl font-bold text-black mb-4 md:mb-6">Add New Patient</h2>
                                {!isOnline && (
                                    <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-sm md:text-base">
                                        You're offline. Patient will be saved locally and synced when you're back online.
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handlePatientSubmit} className="space-y-4 md:space-y-6">
                                {/* Form fields with responsive padding */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Full Name<span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={newPatient.fullName}
                                        onChange={handlePatientChange}
                                        placeholder="Enter patient's full name"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                        required
                                    />
                                </div>

                                {/* Age */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Age<span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={newPatient.age}
                                        onChange={handlePatientChange}
                                        placeholder="Enter patient's age"
                                        min="0"
                                        max="120"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                        required
                                    />
                                </div>

                                {/* Gender */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Gender<span className="text-red-500">*</span></label>
                                    <select
                                        name="gender"
                                        value={newPatient.gender}
                                        onChange={handlePatientChange}
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                        required
                                    >
                                        <option value="">Select gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                        <option value="unknown">Unknown</option>
                                    </select>
                                </div>

                                {/* Blood Type */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Blood Type</label>
                                    <select
                                        name="bloodType"
                                        value={newPatient.bloodType}
                                        onChange={handlePatientChange}
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                    >
                                        <option value="">Select blood type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="unknown">Unknown</option>
                                    </select>
                                </div>

                                {/* Condition */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Condition<span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="condition"
                                        value={newPatient.condition}
                                        onChange={handlePatientChange}
                                        placeholder="Describe the medical condition"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                        required
                                    />
                                </div>

                                {/* Severity */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Severity<span className="text-red-500">*</span></label>
                                    <select
                                        name="severity"
                                        value={newPatient.severity}
                                        onChange={handlePatientChange}
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                        required
                                    >
                                        <option value="">Select severity</option>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                        <option value="emergency">Emergency</option>
                                    </select>
                                </div>

                                {/* Allergies */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Allergies</label>
                                    <input
                                        type="text"
                                        name="allergies"
                                        value={newPatient.allergies}
                                        onChange={handlePatientChange}
                                        placeholder="List any allergies"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                    />
                                </div>

                                {/* Symptoms */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Symptoms</label>
                                    <input
                                        type="text"
                                        name="symptoms"
                                        value={newPatient.symptoms}
                                        onChange={handlePatientChange}
                                        placeholder="Describe symptoms"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                    />
                                </div>

                                {/* Emergency Contact */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Emergency Contact</label>
                                    <input
                                        type="text"
                                        name="emergencyContact"
                                        value={newPatient.emergencyContact}
                                        onChange={handlePatientChange}
                                        placeholder="Enter emergency contact"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                    />
                                </div>

                                {/* Insurance Info */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Insurance Info</label>
                                    <input
                                        type="text"
                                        name="insuranceInfo"
                                        value={newPatient.insuranceInfo}
                                        onChange={handlePatientChange}
                                        placeholder="Enter insurance information"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                    />
                                </div>

                                {/* Warnings */}
                                <div>
                                    <label className="block text-sm md:text-base font-medium text-black mb-1 md:mb-2">Warnings (comma separated)</label>
                                    <input
                                        type="text"
                                        name="warnings"
                                        value={Array.isArray(newPatient.warnings) ? newPatient.warnings.join(', ') : ''}
                                        onChange={(e) => setNewPatient(prev => ({
                                            ...prev,
                                            warnings: e.target.value.split(',').map(w => w.trim()).filter(Boolean)
                                        }))}
                                        placeholder="Important warnings, alerts"
                                        className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm md:text-base"
                                    />
                                </div>

                                {/* Buttons */}
                                <div className="sticky bottom-0 bg-white pt-4 border-t">
                                    <div className="flex justify-end space-x-3 md:space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddPatientModal(false)}
                                            className="px-4 md:px-6 py-2 md:py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm md:text-base"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm md:text-base"
                                        >
                                            {isOnline ? 'Save' : 'Save Locally'}
                                        </button>
                                    </div>
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

    function DashboardHome({ setShowAddPatientModal, isOnline }) {
        return (
            <div className="space-y-6 md:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    <StatCard label="Total Patients" value="142" icon="group" growth="↑ 12%" color="green" />
                    <StatCard label="Critical Cases" value="8" icon="warning" growth="↑ 3 this week" color="red" />
                    <StatCard label="Today's Appointments" value="5" icon="events" growth="2 in next hour" color="gray" />
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-black">Quick Actions</h2>
                    <div className="flex flex-wrap gap-3 md:gap-4">
                        <button
                            onClick={() => setShowAddPatientModal(true)}
                            className="bg-blue-600 text-white px-3 md:px-4 py-1 md:py-2 rounded-lg hover:bg-blue-800 transition text-sm md:text-base"
                        >
                            Add New Patient
                        </button>
                        <button className="bg-gray-600 text-white px-3 md:px-4 py-1 md:py-2 rounded-lg hover:bg-gray-800 transition text-sm md:text-base">
                            View Appointments
                        </button>
                        <button className="bg-red-600 text-white px-3 md:px-4 py-1 md:py-2 rounded-lg hover:bg-red-800 transition text-sm md:text-base">
                            Emergency Alert
                        </button>
                        {!isOnline && (
                            <span className="flex items-center text-yellow-600 text-sm md:text-base">
                                (Working in offline mode)
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-black">Recent Activities</h2>
                    <ul className="space-y-2 md:space-y-3 text-black text-sm md:text-base">
                        <li>🟢 Patient <strong>Jane Smith</strong> was admitted (10 mins ago)</li>
                        <li>🔴 Emergency case flagged: <strong>Heart Attack</strong> (30 mins ago)</li>
                        <li>🟡 Updated record for <strong>Mike Johnson</strong> (1 hr ago)</li>
                    </ul>
                </div>
            </div>
        )
    }

    function PatientsPage({ patients, onScanClick, downloadQRCode, token }) {
        const [selectedPatient, setSelectedPatient] = useState(null)
        const [qrCodeData, setQrCodeData] = useState(null)
        const [searchTerm, setSearchTerm] = useState('')

        const severityColors = {
            high: "bg-red-100 text-red-800",
            medium: "bg-yellow-100 text-yellow-800",
            low: "bg-green-100 text-green-800",
            critical: "bg-purple-100 text-purple-800"
        }

        const fetchQRCode = async (patientId) => {
            try {
                const response = await axios.get(
                    `https://care-chain.onrender.com/patients/${patientId}/qrcode`,
                    { headers: { Authorization: `Bearer ${token}` } }
                )
                setQrCodeData(response.data.qr_code)
                setSelectedPatient(patientId)
            } catch (error) {
                console.error('Error fetching QR code:', error)
                toast.error('Failed to generate QR code')
            }
        }

        const filteredPatients = patients.filter((patient) => {
            const name = patient.full_name || patient.fullName || '';
            return name.toLowerCase().includes(searchTerm.toLowerCase());
        });

        return (
            <div className="text-black space-y-4 md:space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0">
                    <h2 className="text-xl md:text-2xl font-bold">Patients List</h2>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Search patients"
                            className="text-black pl-3 md:pl-4 pr-3 md:pr-4 py-1 md:py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base w-full"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <button
                            onClick={onScanClick}
                            className="bg-blue-600 text-white px-3 md:px-4 py-1 md:py-2 rounded-lg hover:bg-blue-800 transition text-sm md:text-base whitespace-nowrap"
                        >
                            Scan QR
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {filteredPatients.map((patient) => (
                        <div key={patient.id} className="bg-white p-3 md:p-4 rounded-xl shadow border border-gray-100 space-y-3 md:space-y-4">
                            <div>
                                <h3 className="text-base md:text-lg font-semibold">{patient.full_name || patient.fullName}</h3>
                                <p className="text-sm md:text-base">Age: {patient.age}</p>
                                <p className="text-sm md:text-base">Condition: {patient.condition}</p>
                                {patient.offline && <p className="text-yellow-600 text-xs md:text-sm">(Pending sync)</p>}
                                {patient.severity && (
                                    <div className={`mt-1 md:mt-2 p-1 md:p-2 rounded text-xs md:text-sm ${severityColors[patient.severity] || 'bg-gray-100 text-gray-800'}`}>
                                        {Array.isArray(patient.warnings) ? patient.warnings.join(", ") : 'No warnings'}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col space-y-2">
                                <button
                                    onClick={() => fetchQRCode(patient.id)}
                                    className="w-full bg-blue-600 text-white py-1 md:py-2 rounded-lg hover:bg-blue-700 transition text-sm md:text-base"
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
                                    className="w-full bg-green-600 text-white py-1 md:py-2 rounded-lg hover:bg-green-700 transition text-sm md:text-base"
                                >
                                    Download QR Code
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {qrCodeData && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                        <div className="bg-white p-4 md:p-6 rounded-xl w-full max-w-xs sm:max-w-sm md:max-w-md mx-4">
                            <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Patient QR Code</h2>
                            <div className="flex flex-col items-center space-y-3 md:space-y-4">
                                <img
                                    src={`data:image/png;base64,${qrCodeData}`}
                                    alt="Patient QR Code"
                                    className="w-32 h-32 md:w-48 md:h-48"
                                />
                                <div className="flex space-x-2 md:space-x-3">
                                    <button
                                        onClick={() => {
                                            const link = document.createElement('a')
                                            link.href = `data:image/png;base64,${qrCodeData}`
                                            link.download = `patient-${selectedPatient}-qrcode.png`
                                            link.click()
                                        }}
                                        className="bg-blue-600 text-white px-3 md:px-4 py-1 md:py-2 rounded-lg hover:bg-blue-700 transition text-sm md:text-base"
                                    >
                                        Download
                                    </button>
                                    <button
                                        onClick={() => setQrCodeData(null)}
                                        className="bg-gray-300 text-gray-800 px-3 md:px-4 py-1 md:py-2 rounded-lg hover:bg-gray-400 transition text-sm md:text-base"
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
                qrbox: { width: 200, height: 200 },
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
            <div className="p-4 md:p-8 text-black">
                <h1 className="text-black text-xl md:text-2xl font-bold mb-3 md:mb-4">Scan Patient QR Code</h1>
                {scanResult ? (
                    <div className="p-3 md:p-4 bg-green-100 rounded-lg text-sm md:text-base text-black">
                        Found: {scanResult}
                    </div>
                ) : (
                    <div id="qr-scanner" className="w-full max-w-xs sm:max-w-sm md:max-w-md text-black"></div>
                )}
            </div>
        )
    }

    function QRScannerModal({ onClose, onScanSuccess }) {
        const [scanResult, setScanResult] = useState(null)

        useEffect(() => {
            const scanner = new Html5QrcodeScanner('qr-scanner-modal', {
                qrbox: { width: 200, height: 200 },
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
                <div className="bg-white p-4 md:p-6 rounded-xl w-full max-w-xs sm:max-w-sm md:max-w-md mx-4">
                    <h2 className="text-black text-xl md:text-2xl font-bold mb-3 md:mb-4">Scan Patient QR Code</h2>
                    {scanResult ? (
                        <div className="p-3 md:p-4 bg-green-100 rounded-lg text-sm md:text-base text-black">
                            Found: {scanResult}
                        </div>
                    ) : (
                        <div id="qr-scanner-modal" className="w-full text-black"></div>
                    )}
                    <button
                        onClick={onClose}
                        className="mt-3 md:mt-4 px-3 md:px-4 py-1 md:py-2 bg-gray-200 rounded-lg hover:bg-gray-500 transition text-black text-sm md:text-base"
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
                <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Appointments</h2>
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 text-sm md:text-base">
                    <p>Appointment scheduler coming soon.</p>
                </div>
            </div>
        )
    }

    function SettingsPage() {
        return (
            <div className="text-black">
                <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Settings</h2>
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 text-sm md:text-base">
                    <p>Settings will be configurable here.</p>
                </div>
            </div>
        )
    }

    function StatCard({ label, value, icon, growth, color }) {
        const colorMap = {
            green: 'text-green-600 bg-green-100',
            red: 'text-red-600 bg-red-100',
            gray: 'text-gray-600 bg-gray-100',
            purple: 'text-purple-600 bg-purple-100'
        }
        return (
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-black font-medium text-sm md:text-base">{label}</h3>
                        <p className="text-2xl md:text-3xl font-bold mt-1 md:mt-2 text-black">{value}</p>
                    </div>
                    <div className={`p-2 md:p-3 rounded-lg ${colorMap[color]}`}>
                        <span className="material-icons text-sm md:text-base">{icon}</span>
                    </div>
                </div>
                <p className={`text-xs md:text-sm mt-2 md:mt-4 ${colorMap[color].split(' ')[0]}`}>{growth}</p>
            </div>
        )
    }
}