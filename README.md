# Postgraduate Academic Management System (PAMS)

## Overview
The **Postgraduate Academic Management System (PAMS)** is a web-based application developed to support and streamline postgraduate academic and thesis management processes. It provides a centralized platform for students, faculty members, the Postgraduate Committee (PGC), and administrators to collaborate efficiently.  

The system ensures transparency, role-based access, and automation of academic rules such as credit eligibility, supervisor assignment, and thesis progress monitoring. This project was developed as part of **Software Project Lab II (SPL II)** in the Department of Software Engineering.  

---

## Features

### Authentication and User Management
- Role-based authentication: Admin, Student, Faculty, PGC  
- Admin-controlled user registration  
- Automatic creation of related profiles (e.g., Student, Faculty) during registration  
- Secure password hashing and reset-password mechanism with email support  

### Student Module
- Automatic eligibility check for thesis enrollment based on credit hours and CGPA  
- Supervisor request submission with ranked preferences  
- Proposal submission and feedback workflow  
- Progress tracking across thesis milestones  

### Faculty Module
- Management of supervision requests (approval or rejection)  
- Review and feedback on thesis proposals  
- Tracking of supervised students and their progress  

### PGC Module
- Approval of supervisor assignments  
- Oversight of thesis proposals and defenses  
- Enforcement of academic regulations  

### Admin Module
- Management of all user accounts  
- Oversight of system-wide activities  
- Control of role-based permissions  

---

## Technology Stack
- **Backend:** Node.js, Express.js  
- **Database:** MongoDB with Mongoose ODM  
- **Authentication:** JSON Web Tokens (JWT), bcrypt  
- **Email Services:** Nodemailer (password reset and notifications)  
- **Frontend:** React with Next.js  

---

## Installation and Setup

### Prerequisites
- Node.js (v16 or higher)  
- MongoDB (local instance or cloud service)  
- Git  

### Steps

Clone repository:  
```bash
git clone https://github.com/ayeshamashiat/PAMS_Backend.git
```

Navigate to project directory:  
```bash
cd backend
```
Install dependencies:
```bash
npm install
```
Configure environment variables:
```bash
cp .env.example .env
```
Edit .env with your MongoDB URI, JWT secret, and email credentials.

Run in development mode:
```bash
npm run dev
```

