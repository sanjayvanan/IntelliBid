# IntelliBid · [Live Demo](https://intelli-bid.vercel.app)

IntelliBid is a modern, AI-powered auction platform that enables real-time bidding, intelligent item recommendations, automated auction management, and seamless online product selling. With a hybrid database architecture, it combines real-time sockets, vector similarity search, and generative AI to deliver a powerful, high-performance auction and e-commerce experience.

## 🚀 Key Features

- **Real-Time Bidding**: Live bid updates using WebSockets (Socket.io), ensuring instant feedback for all participants.

- **AI-Powered Listings**: Auto-generate professional item descriptions using Google Gemini AI.

- **AI Smart & Vector-Based Recommendations**: By pairing AI smart recommendations with vector-based logic, the system embeds item descriptions into vector space. When a user views an item, the recommendation service calculates the L2 (Euclidean) distance between vectors to suggest the most semantically similar active auctions, and then the similar items are also filtered by AI for better relevance.
- **Hybrid Database Architecture**:
  - **MongoDB**: Manages user authentication and profiles.
  - **PostgreSQL**: Handles transactional data like items, bids, and vector embeddings.

- **Multi-Image Support**: Upload and display multiple images for auction items via AWS S3.

- **Automated Auction Management**: A dedicated background process autonomously manages the auction lifecycle. It continually monitors for expired listings, instantly transitioning their status from 'active' to 'ended' and triggering automated email notifications to winners using Nodemailer, ensuring the platform operates without manual intervention.

- **Secure Authentication**: JSON Web Token (JWT) based authentication.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React (Vite)
- **State Management**: Redux Toolkit
- **Routing**: React Router DOM
- **Styling**: CSS Modules / Custom CSS
- **Real-Time**: Socket.io Client

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Databases**:
  - MongoDB (Mongoose)
  - PostgreSQL (pg) with pgvector extension
- **AI & ML**: Google Generative AI (Gemini)
- **Storage**: AWS S3
- **Email**: Nodemailer
- **Scheduling**: Node-cron

## ⚙️ Prerequisites

Before running the application, ensure you have the following installed:

- Node.js (v16 or higher)
- PostgreSQL (with pgvector extension enabled)
- MongoDB (Local or Atlas)
- An AWS Account (S3 Bucket)
- Google Gemini API Key

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/intellibid.git
cd intellibid
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```

**Environment Variables**: Create a `.env` file in the backend directory and populate it with the following:
```env
# Server Configuration
PORT=4000
FRONTEND_PORT=http://localhost:5173

# Database - MongoDB (Users)
MONGO_URI=mongodb://localhost:27017/intellibid

# Database - PostgreSQL (Items & Bids)
PG_USER=your_pg_user
PG_PASSWORD=your_pg_password
PG_HOST=localhost
PG_DATABASE=intellibid_db
PG_PORT=5432

# Authentication
SECRET=your_jwt_secret_key

# AWS S3 (Image Storage)
BUCKET_NAME=your_s3_bucket_name
BUCKET_REGION=your_s3_region
ACCESS_KEY=your_aws_access_key
SECRET_ACCESS_KEY=your_aws_secret_key

# AI Services (Gemini)
GEMINI_API_KEY=your_google_gemini_key

# Email Service (Nodemailer)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
EMAIL_FROM="IntelliBid <no-reply@intellibid.com>"
```

**Note**: Ensure the pgvector extension is enabled in your PostgreSQL database (`CREATE EXTENSION vector;`).

Start the backend server:
```bash
npm start
# or for development
npm run dev
```

### 3. Frontend Setup

Navigate to the frontend directory and install dependencies:
```bash
cd ../frontend
npm install
```

**Environment Variables**: Create a `.env` file in the frontend directory:
```env
VITE_API_URL=http://localhost:4000
```

Start the frontend development server:
```bash
npm run dev
```

## 🏃‍♂️ Running the Application

1. Ensure your MongoDB and PostgreSQL databases are running.
2. **Start the Backend**: `cd backend && npm run dev`
3. **Start the Frontend**: `cd frontend && npm run dev`
4. Open your browser and navigate to `http://localhost:5173`.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a Pull Request.

## 📄 License

This project is licensed under the ISC License.
