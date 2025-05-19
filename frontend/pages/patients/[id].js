import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function PatientPage() {
  const router = useRouter()
  const { id } = router.query
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:8000/patients/${id}`) // or hosted backend
      .then(res => res.json())
      .then(data => {
        setPatient(data)
        setLoading(false)
      })
      .catch(err => {
        setError("Failed to fetch patient data")
        setLoading(false)
      })
  }, [id])

  if (loading) return <p>Loading...</p>
  if (error) return <p>{error}</p>
  if (!patient) return <p>No data found</p>

  return (
    <div className="p-4 bg-white rounded shadow">
      <h1 className="text-xl font-bold">{patient.name}</h1>
      <p>Age: {patient.age}</p>
      <p>Condition: {patient.condition}</p>
      <div className="mt-2 p-2 bg-yellow-100">
        {patient.warning || "No warnings"}
      </div>
    </div>
  )
}
