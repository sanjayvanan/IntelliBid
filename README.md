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
- **🛡️ Automated Deadbeat Protection**: A self-healing system that monitors for non-paying winners. If a winner fails to pay within 24 hours, the system automatically:
  - **Revokes** the win and removes the invalid bids.
  - **Sequentially offers the item** to the next highest bidder if the previous bidder fails to pay, continuing down the bid history until a payment is completed.
  - **Auto-Relists** the item if no other valid bidders exist.
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

---

## 🗄️ Database Schema

IntelliBid uses a **Hybrid Database Architecture**. Transactional data (Items, Bids) is stored in **PostgreSQL** for ACID compliance and Vector Search, while User profiles are stored in **MongoDB** for flexibility.

### 🐘 PostgreSQL Tables (Transactional & Vector Data)

#### 1. `items`
The core table storing auction listings.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Unique identifier for the item. |
| `name` | VARCHAR(255) | Title of the item. |
| `description` | TEXT | Detailed description of the item. |
| `start_price` | NUMERIC | Starting bid amount. |
| `current_price` | NUMERIC | Current highest bid (visible price). |
| `image_url` | TEXT[] | Array of image URLs (stored in AWS S3). |
| `start_time` | TIMESTAMPTZ | Auction start time. |
| `end_time` | TIMESTAMPTZ | Auction expiration time. |
| `status` | VARCHAR(50) | Status: `'active'`, `'ended'`, or `'sold'`. |
| `condition` | VARCHAR(50) | Item condition (e.g., 'New', 'Used'). |
| `seller_id` | VARCHAR(255) | Reference to **MongoDB User ID**. |
| `category_id` | INTEGER | Foreign key linking to the `categories` table. |
| `winner_id` | TEXT | Reference to **MongoDB User ID** of the winner (set upon closing). |
| `payment_status` | TEXT | Status of payment (e.g., 'pending', 'paid'). |
| `razorpay_payment_id` | TEXT | Transaction ID from Razorpay. |
| `shipping_address` | TEXT | Shipping address collected from the winner. |
| `proxy_max_bid` | NUMERIC | **(Hidden)** The leader's maximum willingness to pay. |
| `proxy_bidder_id` | VARCHAR(255) | **(Hidden)** MongoDB `_id` of the current proxy leader. |
| `dynamic_details` | JSONB | Flexible schema for specific attributes (e.g., `{ "ram": "8GB" }`). |
| `return_status` | VARCHAR(50) | Status for return requests (if applicable). |
| `description_embedding` | VECTOR | `pgvector` embedding for AI Similarity Search. |

#### 2. `bids`
Records every bid placed (excluding internal proxy auto-bids).

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Unique bid ID. |
| `amount` | NUMERIC | The bid amount. |
| `item_id` | INTEGER | Foreign Key linking to `items`. |
| `bidder_id` | VARCHAR(255) | Reference to **MongoDB User ID**. |
| `bid_time` | TIMESTAMPTZ | Time the bid was recorded. |
| `created_at` | TIMESTAMPTZ | Record creation timestamp. |

#### 3. `categories`
Categorizes items for filtering and organization.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Unique category ID. |
| `name` | VARCHAR(255) | Category name (e.g., 'Electronics', 'Antiques'). |

---

### 🍃 MongoDB Collections (User Data)

#### `users`
| Field | Type | Description |
| :--- | :--- | :--- |
| `_id` | ObjectId | Unique User ID (Referenced by Postgres tables). |
| `email` | String | User's email address (unique). |
| `password` | String | Hashed password. |

---

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
FRONTEND_PORT=http://localhost:5173  # The primary frontend URL for CORS

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
