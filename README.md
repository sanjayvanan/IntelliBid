# IntelliBid · [Live Demo](https://intelli-bid.vercel.app)

IntelliBid is a modern, AI-powered auction platform that enables real-time bidding, intelligent item recommendations, automated auction management, and seamless online product selling. With a **hybrid high-performance architecture**, it combines Redis caching, BullMQ event queues, real-time sockets, and generative AI to deliver a scalable e-commerce experience.

## 🚀 Key Features

### **1️⃣ High-Performance Architecture**
- **⚡ Hybrid Real-Time System**: Uses a "Look-Aside" caching strategy. The initial feed loads instantly via **Redis Cache** (REST API), while live price updates are injected via **WebSockets (Socket.io)**. This ensures zero database load for browsing users while keeping data 100% fresh.
- **🔄 Event-Driven Job Queue**: Powered by **BullMQ** (Redis-based message queue). Auction closures are scheduled as precise delayed jobs, meaning the CPU sleeps until the exact millisecond an auction ends, ensuring maximum resource efficiency without constant database polling.
- **🛡️ Resilience & Recovery**: Includes a "Safety Sync" mechanism that automatically recovers and reschedules auction timers from PostgreSQL if the server restarts or Redis is flushed.

### **2️⃣ Core Auction Functionality**
- **Live Bidding**: Instant visual feedback on price changes across the Homepage and Item Details without page refreshes.
- **Proxy Bidding System**: Users set their maximum bid, and the system automatically bids the minimum amount needed to maintain their lead, up to their limit.
- **Smart Auction Closing**: Handles winner determination, payment status updates, and automated email notifications using distributed workers.
- **Voice Search**: Integrated browser-based speech recognition allows users to search for items using voice commands.

---

### **3️⃣ AI-Powered Intelligence**
- **🤖 IntelliBid Assistant (Chatbot)**: A file-based RAG (Retrieval-Augmented Generation) chatbot that answers user questions about platform policies, fees, and features. It reads from a dynamic knowledge base (`policies.md`) to provide accurate, context-aware support.
- **✨ Smart Attribute Auto-Detection**: Uses Vector Search to find similar items in the database and reuse their specification fields (e.g., "Battery Health" for phones). If no match is found, it uses Gemini AI to generate a custom schema of relevant attributes for that specific product.
- **📝 AI Description Generator**: Auto-generate professional item descriptions using Google Gemini AI based on the item name and category.
- **🔍 RAG-Based Market Appraiser**: Analyzes draft listings against real sold item history. It retrieves similar sold items via vector search and uses Gemini to estimate the value and provide a "Deal Score."
- **💡 Vector-Based Recommendations**: Uses AI-generated vector embeddings to represent items in high-dimensional space, applying L2 (Euclidean) distance to recommend semantically similar active auctions.

---

### **4️⃣ Media & Asset Handling**
- **Multi-Image Support**: Upload and display multiple images for auction items via AWS S3.
- **Smart Image Optimization**: Automatically resizes and optimizes uploaded images using `Sharp` before storing them in AWS S3 for improved performance.

---

### **5️⃣ Security, Payments & Protection**
- **Secure Authentication**: JSON Web Token (JWT) based authentication.
- **Secure Payments**: Integrated Razorpay gateway enables seamless and secure payment processing for auction winners, including address collection via modal.
- **API Rate Limiting**: Prevents abuse with global rate limits and specific quotas for AI generation features using `express-rate-limit`.

---

  
## 🛠️ Tech Stack

### Frontend
- **Library**: React (Vite)
- **State Management**: Redux Toolkit
- **Routing**: React Router DOM
- **Real-Time**: Socket.io Client
- **Styling**: CSS Modules / Custom CSS
- **Voice**: Web Speech API

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Databases**:
  - **PostgreSQL**: Primary transactional data (Items, Bids) with `pgvector` for AI search.
  - **MongoDB**: User profiles and authentication.
  - **Redis**: Caching (Feed & Items) and Message Queue backing.
- **Background Jobs**: BullMQ (running on IORedis).
- **AI & ML**: Google Generative AI (Gemini 1.5 Flash & Text Embedding 004).
- **Storage**: AWS S3.
- **Email**: Nodemailer.

## ⚙️ Prerequisites

Before running the application, ensure you have the following installed:

- Node.js (v18 or higher)
- PostgreSQL (with `pgvector` extension enabled)
- MongoDB (Local or Atlas)
- Redis Server (Local or Cloud)
- An AWS Account (S3 Bucket)
- Google Gemini API Key

## 📦 Installation & Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/yourusername/intellibid.git](https://github.com/yourusername/intellibid.git)
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

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

#reddis
REDIS_URL=your_redis_cli
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
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
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
