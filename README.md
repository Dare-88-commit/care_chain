# 🩺 CareChain

**CareChain** is a decentralized, offline-first electronic medical records system designed to provide secure and efficient access to patient data using QR codes. Built for health clinics in connectivity-constrained regions, CareChain combines simplicity, accessibility, and security to empower healthcare workers in underserved communities.

---

## 🌍 Project Goal

The goal of CareChain is to empower healthcare workers in underserved communities with a digital health record system that works **offline**, syncs data **securely**, and **flags critical symptoms**, helping improve timely diagnosis and care.

---

## ✅ Core Features

### 🔐 User Management
- Secure authentication using JWT.
- Role-based access control (Admin, Doctor, Nurse).

### 🧑‍⚕️ Patient Records
- Add, view, and update patient records.
- Each patient is associated with the user who created the record.

### 📸 QR Code Access
- Every patient has a unique QR code linked to their medical record.
- Scanning the QR code retrieves their data without login.
- Tokens are time-limited and secure.

### 🌐 Offline-First Sync (Basic Support)
- Patients can be created offline and later synced when back online.

### 🧠 Symptom Flagging System
- Uses a dictionary-based rule set to flag risky symptoms as **critical**, **warning**, or **safe**.
- (AI module planned for future development.)

### 📈 Audit Logs
- Access to patient records is logged (user, action, IP address, etc.).

---

## 🧰 Tech Stack

### Frontend
- **Next.js**
- **Tailwind CSS**
- Browser-based QR scanner

### Backend
- **FastAPI**
- **SQLAlchemy + PostgreSQL**
- JWT Authentication
- QR Code generation (`qrcode` library)
- Custom access logging middleware

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
