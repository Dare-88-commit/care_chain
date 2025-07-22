import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://care-chain.onrender.com';

export default function PatientPage() {
  const router = useRouter()
  const { id } = router.query
  const { token, isLoading: authLoading, isAuthenticated } = useAuth()
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id || !token) return;

    const fetchPatient = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/patients/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setPatient(res.data)
      } catch (err) {
        console.error(err)
        setError("Failed to fetch patient data")
      } finally {
        setLoading(false)
      }
    }

    fetchPatient()
  }, [id, token])

  if (authLoading || loading) return <p className="text-center text-gray-500">Loading...</p>
  if (!isAuthenticated) return <p className="text-center text-red-600">Not authenticated</p>
  if (error) return <p className="text-center text-red-600">{error}</p>
  if (!patient) return <p className="text-center text-gray-500">No data found</p>

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">{patient.full_name}</h1>
      <p><span className="font-semibold">Age:</span> {patient.age}</p>
      <p><span className="font-semibold">Condition:</span> {patient.condition}</p>
      <p><span className="font-semibold">Severity:</span> {patient.severity}</p>
      <p><span className="font-semibold">Gender:</span> {patient.gender}</p>
      <p><span className="font-semibold">Allergies:</span> {patient.allergies || "None"}</p>
      <p><span className="font-semibold">Symptoms:</span> {patient.symptoms || "None"}</p>
      <div className="mt-4 p-3 rounded bg-yellow-100 text-yellow-800">
        {patient.warnings?.join(", ") || "No warnings"}
      </div>
    </div>
  )
}
