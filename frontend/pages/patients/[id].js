import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://care-chain.onrender.com';

export default function PatientPage() {
  const router = useRouter();
  const { id } = router.query;
  const { token, isLoading: authLoading, isAuthenticated, logout } = useAuth();

  const [patient, setPatient] = useState({
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // ✅ Toast state
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  useEffect(() => {
    if (!id || !token) return;

    const fetchPatient = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/patients/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPatient({
          fullName: res.data.full_name || '',
          age: res.data.age || '',
          gender: res.data.gender || 'male',
          bloodType: res.data.blood_type || '',
          condition: res.data.condition || '',
          severity: res.data.severity || 'medium',
          warnings: res.data.warnings || [],
          allergies: res.data.allergies || '',
          symptoms: res.data.symptoms || '',
          emergencyContact: res.data.emergency_contact || '',
          insuranceInfo: res.data.insurance_info || ''
        });
      } catch (err) {
        console.error(err);
        setError("Failed to fetch patient data");
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPatient((prev) => ({ ...prev, [name]: value }));
  };

  const showToast = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await axios.put(
        `${API_BASE_URL}/patients/${id}`,
        {
          full_name: patient.fullName,
          age: Number(patient.age),
          gender: patient.gender,
          blood_type: patient.bloodType,
          condition: patient.condition,
          severity: patient.severity,
          warnings: patient.warnings,
          allergies: patient.allergies,
          symptoms: patient.symptoms,
          emergency_contact: patient.emergencyContact,
          insurance_info: patient.insuranceInfo
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast("Patient updated successfully!");
    } catch (err) {
      console.error(err);
      showToast("Failed to update patient", "error");
      if (err.response?.status === 401) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this patient?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/patients/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast("Patient deleted successfully!");
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      showToast("Failed to delete patient", "error");
    }
  };

  if (authLoading || loading)
    return <p className="text-center text-gray-500">Loading...</p>;
  if (!isAuthenticated)
    return <p className="text-center text-red-600">Not authenticated</p>;
  if (error)
    return <p className="text-center text-red-600">{error}</p>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen relative">
      {/* ✅ Toast notification */}
      {message && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white ${messageType === "success" ? "bg-green-600" : "bg-red-600"
          }`}>
          {message}
        </div>
      )}

      {/* Illustration Side */}
      <div className="md:w-2/5 w-full bg-blue-50 flex items-center justify-center p-6 md:p-0">
        <Image
          src="/images/doctor-illustration.svg"
          alt="Doctor Illustration"
          width={300}
          height={300}
          className="w-auto h-auto md:w-[450px] md:h-[450px]"
          priority
        />
      </div>

      {/* Patient Info Side */}
      <div className="w-full md:w-3/5 flex items-center justify-center px-4 sm:px-6 py-8 bg-white overflow-y-auto">
        <div className="max-w-md w-full mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-2 sm:space-y-0">
            <Image
              src="/images/carechain-logo.png"
              alt="CareChain Logo"
              width={40}
              height={40}
              priority
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-black">CareChain</h1>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 shadow text-black space-y-4">
            {[
              { label: "Full Name", name: "fullName" },
              { label: "Age", name: "age" },
              { label: "Gender", name: "gender" },
              { label: "Blood Type", name: "bloodType" },
              { label: "Condition", name: "condition" },
              { label: "Severity", name: "severity" },
              { label: "Allergies", name: "allergies" },
              { label: "Symptoms", name: "symptoms" },
              { label: "Emergency Contact", name: "emergencyContact" },
              { label: "Insurance Info", name: "insuranceInfo" }
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-semibold">{field.label}</label>
                <input
                  type="text"
                  name={field.name}
                  value={patient[field.name]}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 mt-1 text-sm sm:text-base"
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-semibold">Warnings</label>
              <input
                type="text"
                name="warnings"
                value={Array.isArray(patient.warnings) ? patient.warnings.join(", ") : ""}
                onChange={(e) =>
                  setPatient((prev) => ({
                    ...prev,
                    warnings: e.target.value.split(",").map((w) => w.trim())
                  }))
                }
                className="w-full border border-gray-300 rounded px-3 py-2 mt-1 text-sm sm:text-base"
              />
            </div>

            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 text-sm sm:text-base"
            >
              {isUpdating ? "Updating..." : "Update Patient"}
            </button>

            <button
              onClick={handleDelete}
              className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 mt-2 text-sm sm:text-base"
            >
              Delete Patient
            </button>
          </div>

          <div className="text-center text-sm mt-6">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:underline"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
