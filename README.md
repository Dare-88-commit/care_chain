# 🩺 CareChain

**CareChain** is a decentralized, offline-first electronic medical records system designed to provide secure and efficient access to patient data using QR codes. Built for health clinics in connectivity-constrained regions, CareChain combines simplicity, accessibility, and security to empower healthcare workers in underserved communities.

---

## 🌍 Project Goal

The goal of CareChain is to empower healthcare workers in underserved communities with a digital health record system that works **offline**, syncs data **securely**, and **flags critical symptoms**, helping improve timely diagnosis and care.

---

## 🚑 Challenges Addressed

- 🚫 Limited or no internet access in rural/underserved areas
- 🔁 Lack of continuity and accessibility of patient records across clinics
- 🔐 Need for privacy and secure access to sensitive health data
- ⚠️ Delayed diagnosis due to lack of quick symptom flagging
- 🆘 Need for emergency access via QR codes when systems are down

---

## ✅ Core Features

### 🔐 User Management
- Secure authentication using JWT
- Role-based access control (Admin, Doctor, Nurse)

### 🧑‍⚕️ Patient Records
- Create, view, and update patient data
- Records are associated with the user who created them

### 📸 QR Code Access
- Each patient has a unique QR code linked to their record
- Scanning the QR code retrieves the record without needing login
- Tokens are time-limited and secured with JWT

### 🌐 Offline-First Sync (Basic Support)
- Basic support for offline patient record creation
- Data syncs automatically when back online

### 🧠 Symptom Flagging System
- Dictionary-based logic flags symptoms as **Critical**, **Warning**, or **Safe**
- Lightweight and offline-friendly
- (AI-enhanced system planned for future release)

### 📈 Audit Logs
- Tracks who accessed what record, when, and from where

---

## 🛠️ Technologies Used

### Frontend
- **Next.js**
- **Tailwind CSS**
- Browser-based QR scanner for patient lookup

### Backend
- **FastAPI**
- **SQLAlchemy + PostgreSQL**
- JWT Authentication & token system
- **qrcode** Python library for QR generation
- Custom middleware for access logging

### Other
- Offline support via browser localStorage
- Simple AI symptom checker (keyword-based)
- Version Control via **GitHub**

---

## 🚧 Features In Progress / Planned

- [x] Patient data CRUD
- [x] QR Code linking
- [x] Token-based QR authentication
- [x] Symptom flagging (basic keyword-based)
- [x] Role-based login
- [x] Access logging
- [x] Frontend QR scanner integration
- [ ] **AI symptom analysis module** (future)
- [ ] Full offline sync system with caching/merge
- [ ] Password reset & user management dashboard
- [ ] Multi-language support

---

## 🧪 Getting Started (Development)

### Prerequisites
- Python 3.10+
- Node.js
- PostgreSQL
- `dotenv` for environment variables

### Setup Instructions

1. Clone the repo:

   ```bash
   git clone https://github.com/Dare-88-commit/care_chain.git
