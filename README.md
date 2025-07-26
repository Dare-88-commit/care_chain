# 🩺 CareChain

**CareChain** is a decentralized, offline-first electronic medical record system that empowers healthcare workers in underserved regions. It enables secure, QR-based access to patient data—even without internet connectivity. CareChain is built for resilience, accessibility, and clarity in low-resource environments.

---

## 🌍 Project Goal

To provide frontline health workers with a robust and responsive medical record platform that:

- Works **offline-first** in rural or network-constrained settings
- Uses **QR codes** for secure, shareable access
- Implements **severity-based triage** through a flagging system
- Ensures **data privacy** and accountability

---

## 🚑 Challenges Addressed

- 🚫 Internet inaccessibility in remote locations
- 🔁 Disconnected patient record systems across clinics
- 🔐 Sensitive data requiring secure handling
- ⚠️ Delayed response due to unclear symptom prioritization
- 📱 Need for mobile-friendly, low-latency interfaces
- 🆘 Emergency access to patient data when servers are unreachable

---

## ✅ Core Features

### 🔐 Authentication & Roles
- JWT-based secure login system
- Role-based access control for doctors, nurses, and admins

### 🧑‍⚕️ Patient Records
- Create, edit, and browse records with dynamic severity badges
- Records linked to the creator and timestamped

### 📸 QR Code Integration
- Auto-generates secure, UUID-based QR codes per patient
- Tokens expire after 1 hour for security
- Offline patients are excluded from QR sharing to avoid stale links

### 🌐 Offline-First Support
- Patients can be created and stored offline
- App checks connectivity status and adjusts UI accordingly
- Planned: IndexedDB + background sync across devices

### 🧠 Symptom Flagging Logic
- Keyword-based flagging of symptoms as: **Critical**, **Warning**, or **Safe**
- Designed to be lightweight and usable offline
- (AI-based version coming soon)

### 📊 Access Logs
- Each record access is tracked by user and timestamp
- Helps maintain medical accountability

---

## 🛠️ Tech Stack

### Frontend
- **Next.js** + **Tailwind CSS**
- **React Hooks** for UI state (loading, empty, offline)
- **react-qr-code** for patient code generation

### Backend
- **FastAPI** + **SQLAlchemy** + **PostgreSQL**
- **JWT** authentication (with role claims)
- Custom **middleware** for access logging

### Infrastructure
- Deployable via **Vercel** (frontend) and **Railway** (backend)
- Environment-based secrets using `.env`

---

## 🧪 Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- `pip`, `npm`, `virtualenv`

### Setup Instructions

```bash
# Clone the repo
git clone https://github.com/Dare-88-commit/care_chain.git
cd care_chain

# Backend setup
cd backend
python -m venv env
source env/bin/activate  # Windows: env\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Add DB credentials

# Frontend setup
cd ../frontend
npm install
npm run dev
