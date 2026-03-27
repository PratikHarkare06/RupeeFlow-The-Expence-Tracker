# RupeeFlow 💸

> **Your intelligent, AI-powered expense companion — built for modern Indian financial management.**

![RupeeFlow](frontend/public/logo.png)

RupeeFlow is a full-stack expense tracking platform that combines **AI-driven insights**, **shared wallet capabilities**, **receipt OCR scanning**, **multi-currency support**, and a bold **Neo-brutalism UI** to make personal finance tracking effortless and engaging.

---

## ✨ Features

### 💰 Expense Management
- **Quick Manual Entry** — Add expenses with title, amount, category, date, notes, and currency
- **AI-Powered Auto-Categorization** — Gemini AI automatically suggests the correct category on entry
- **Anomaly Detection** — Real-time alerts when an expense is statistically unusual for its category
- **Delete Expenses** — Remove any individual expense from your history
- **Export to CSV** — Download your full expense history as a spreadsheet
- **Export to PDF** — Generate a formatted PDF report of all expenses (via ReportLab)
- **16 Predefined Categories** — Tailored for Indian spending patterns (Food & Dining, Transport, Home & Family, etc.)

### 📸 Receipt Scanning (OCR)
- **Upload Receipt Images** — PNG, JPG, JPEG supported
- **AI Data Extraction** — Gemini Vision extracts: merchant name, total amount, date, currency, tax, items
- **Multi-Currency Receipt Support** — Auto-detects currency and converts to INR
- **Auto-Fill Form** — Extracted data pre-populates the expense form for quick confirmation

### 🌍 Multi-Currency Support
- **5 Currencies** — INR, USD, EUR, GBP, JPY
- **Live Exchange Rates** — Fetched from ExchangeRate-API with caching
- **Per-Expense Currency** — Each expense can be recorded in its original currency
- **Dashboard Conversion** — All totals displayed in your selected currency

### 👥 Shared Wallets (Group Expenses)
- **Create Wallets** — Create named shared expense groups
- **Join by Invite Code** — Share a unique code for others to join your wallet
- **Group Expense Tracking** — Add and view expenses within a shared wallet
- **Settlement Calculation** — Automatic who-owes-whom calculation for the group
- **Dashboard Overview** — See all your wallets at a glance from the main dashboard

### 📊 Analytics & Insights
- **Dashboard** — Total expenses, total amount, active categories, recent activity
- **Monthly Analytics** — Configurable look-back (default 6 months) with bar chart
- **Category Breakdown** — Pie chart + ranked list with amounts per category
- **Monthly Trends Chart** — Line/bar chart of spending month by month
- **AI Insights Panel** — Personalized tips, overspending alerts, and pattern observations
- **Spending Forecasting** — Predicts next month's expected spend based on historical data

### 🤖 AI Assistant
- **Natural Language Chat** — Ask anything about your finances in plain English or Hindi
- **Expense Queries** — "How much did I spend on food this month?", "Show my top 5 expenses"
- **Spending Summaries** — Instant summaries by category, time range, or custom queries
- **Powered by Gemini** — Uses Google Gemini with automatic model fallback

### 🎯 Budget Management
- **Set Monthly Budgets** — Define a spending limit per category per month
- **Live Progress Tracking** — Visual progress bar showing spent vs budget
- **Overspend Warnings** — Color-coded alerts when approaching or exceeding budget
- **Budget CRUD** — Create, view, and delete budgets

### 🔁 Recurring Expenses
- **Automated Tracking** — Define expenses that recur daily, weekly, or monthly
- **Background Worker** — Server auto-creates recurring entries on schedule
- **Toggle On/Off** — Pause/resume recurring expenses without deleting them
- **Manage Subscriptions** — Perfect for rent, subscriptions, EMIs

### 🏆 Financial Goals
- **Create Goals** — Set a target amount with a name (e.g., "Emergency Fund ₹1,00,000")
- **Contribute Progress** — Log contributions toward a goal over time
- **Visual Progress** — Percentage and progress bar for each goal
- **Delete Goals** — Remove completed or abandoned goals

### 🔐 Authentication & Security
- **JWT Authentication** — Secure token-based auth with configurable expiry
- **Bcrypt Password Hashing** — Industry-standard password storage
- **Rate Limiting** — SlowAPI-based rate limiting to prevent abuse
- **Route Protection** — All data endpoints require valid Bearer tokens
- **CORS Configured** — Controlled cross-origin access

### 🎨 Neo-brutalism UI Design
- **Bold Design System** — Thick black borders, hard box-shadows, sharp corners
- **Custom Logo** — Branded ₹ rupee + bar-chart icon
- **IBM Plex Sans** — Primary font (clean, geometric)
- **Work Sans** — Display/heading font
- **IBM Plex Mono** — Monospace for code/data
- **Collapsible Sidebar** — Close/open with animated transition and floating hamburger button
- **Active Nav Indicator** — Black background + yellow text + yellow left-border bar
- **Yellow Accent System** — `#FDE047` as the primary accent for active/highlight states
- **Responsive Layout** — Mobile horizontal tab bar, desktop vertical sidebar

---

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Tailwind CSS v3** | Utility-first styling |
| **Recharts** | Charts (bar, pie, line) |
| **Axios** | HTTP client |
| **IBM Plex Sans / Work Sans / IBM Plex Mono** | Google Fonts typography |

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | Async Python web framework |
| **Motor (AsyncIOMotorClient)** | Async MongoDB driver |
| **MongoDB** | NoSQL database |
| **Google Generative AI (Gemini)** | AI chat, categorization, forecasting, OCR |
| **python-jose (JWT)** | Authentication tokens |
| **Passlib + Bcrypt** | Password hashing |
| **SlowAPI** | Rate limiting |
| **ReportLab** | PDF export generation |
| **Pillow** | Image processing for receipts |
| **aiofiles** | Async file handling |
| **httpx** | Async HTTP for exchange rate API |

---

## 📁 Project Structure

```
RupeeFlow-The-Expence-Tracker/
├── backend/
│   ├── server.py              # FastAPI app — all routes & business logic
│   ├── receipt_processor.py   # Gemini Vision OCR receipt extraction
│   ├── requirements.txt       # Python dependencies
│   ├── pytest.ini             # Test configuration
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py        # Pytest fixtures
│   │   └── test_budgets.py    # Budget API tests
│   └── .env                   # Backend environment variables (not committed)
│
├── frontend/
│   ├── public/
│   │   ├── index.html         # HTML template + Google Fonts
│   │   └── logo.png           # Custom RupeeFlow brand logo
│   ├── src/
│   │   ├── App.js             # Main application (all pages/components)
│   │   ├── App.css            # Global application styles
│   │   ├── index.css          # Tailwind directives + base font config
│   │   └── index.js           # React entry point
│   ├── tailwind.config.js     # Tailwind theme (fonts, colors, animations)
│   ├── package.json           # Frontend dependencies
│   └── .env                   # Frontend environment variables (not committed)
│
├── .gitignore                 # Comprehensive ignore rules
└── README.md                  # This file
```

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** v16+
- **Python** 3.9+
- **MongoDB** 4.4+ (local or Atlas)
- **Google Gemini API Key** — [Get one here](https://aistudio.google.com/app/apikey)

---

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt
```

Create `backend/.env`:
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=rupeeflow
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash
```

Start MongoDB:
```bash
# macOS (Homebrew)
brew services start mongodb/brew/mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

Run the server:
```bash
python server.py
# → Available at http://127.0.0.1:8001
# → Swagger docs at http://127.0.0.1:8001/docs
```

---

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create frontend/.env
echo "REACT_APP_API_URL=http://127.0.0.1:8001" > .env

# Start development server
npm start
# → Available at http://localhost:3000
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT token |
| `GET` | `/auth/me` | Get current user info |

### Expenses
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/expenses` | List all expenses |
| `POST` | `/expenses` | Create a new expense |
| `DELETE` | `/expenses/{id}` | Delete an expense |
| `GET` | `/expenses/export/csv` | Export expenses as CSV |
| `GET` | `/expenses/export/pdf` | Export expenses as PDF |
| `POST` | `/expenses/receipt` | Upload receipt image for OCR extraction |

### Analytics & AI
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analytics/monthly?months=6` | Monthly spending breakdown |
| `GET` | `/insights` | AI-generated spending insights |
| `GET` | `/forecast` | AI spending forecast for next month |
| `POST` | `/assistant/chat` | Natural language AI chat |

### Budgets
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/budgets` | List all budgets |
| `POST` | `/budgets` | Create a budget |
| `DELETE` | `/budgets/{id}` | Delete a budget |

### Recurring Expenses
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/recurring` | List recurring expenses |
| `POST` | `/recurring` | Create a recurring expense |
| `PUT` | `/recurring/{id}/toggle` | Enable/disable recurring expense |
| `DELETE` | `/recurring/{id}` | Delete recurring expense |

### Financial Goals
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/goals` | List all goals |
| `POST` | `/goals` | Create a goal |
| `POST` | `/goals/{id}/contribute` | Add contribution to a goal |
| `DELETE` | `/goals/{id}` | Delete a goal |

### Shared Wallets
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/groups` | Create a shared wallet |
| `GET` | `/groups` | List your wallets |
| `POST` | `/groups/join` | Join wallet by invite code |
| `POST` | `/groups/{id}/expenses` | Add expense to wallet |
| `GET` | `/groups/{id}/expenses` | List wallet expenses |
| `GET` | `/groups/{id}/settlements` | Get settlement breakdown |

### User Profile
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/user/dashboard` | Full profile stats (totals, categories, trends) |

---

## 🎨 Design System

### Color Palette
| Token | Color | Usage |
|---|---|---|
| **Black** | `#000000` | Borders, active states, headers |
| **Yellow** | `#FDE047` | Active nav, accents, icon badges |
| **White** | `#FFFFFF` | Cards, backgrounds |
| **Gray-50** | `#F9FAFB` | Page background |
| **Red-600** | `#DC2626` | Destructive actions, sign out hover |

### Typography
| Font | Family | Usage |
|---|---|---|
| **IBM Plex Sans** | `font-sans` | All body text, labels, nav |
| **Work Sans** | `font-display` | Display headings |
| **IBM Plex Mono** | `font-mono` | Code, numeric data |

### Neo-brutalism Component Rules
```css
/* Card */
border: 2px solid black;
box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);

/* Active nav item */
background: black;
color: #FDE047;
border-left: 4px solid #FDE047;

/* Buttons */
border: 2px solid black;
box-shadow: 2px 2px 0px 0px rgba(0,0,0,1);
/* On hover: shadow collapses → simulates press */
```

---

## 🔧 Environment Variables

### Backend (`backend/.env`)
```env
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=rupeeflow
SECRET_KEY=change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
```

### Frontend (`frontend/.env`)
```env
REACT_APP_API_URL=http://127.0.0.1:8001
```

---

## 🚨 Troubleshooting

### Backend

**MongoDB won't connect**
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB
brew services start mongodb/brew/mongodb-community   # macOS
sudo systemctl start mongod                          # Linux
```

**Port 8001 already in use**
```bash
lsof -i :8001
kill -9 <PID>
```

**Gemini API errors**
- Ensure `GEMINI_API_KEY` is set in `backend/.env`
- The server auto-discovers available models — check logs for which model is in use
- Free tier has quota limits; the assistant will return an error message if quota exceeded

### Frontend

**Module not found / build errors**
```bash
cd frontend
rm -rf node_modules
npm install
```

**CORS errors**
- Confirm backend is running on port `8001`
- Confirm `REACT_APP_API_URL=http://127.0.0.1:8001` in `frontend/.env`
- Restart frontend dev server after changing `.env`

---

## 🚢 Deployment

### Backend (Production)
```bash
# Install deps
pip install -r requirements.txt

# Set environment variables
export DEBUG=False
export MONGODB_URL=your-atlas-connection-string
export SECRET_KEY=your-production-secret

# Run with uvicorn
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
```

### Frontend (Production)
```bash
cd frontend
npm run build
# Serve the build/ folder with nginx, Vercel, Netlify, or any static host
```

### Docker (Quick Start)
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]

# frontend/Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages: `git commit -m "feat: add expense filtering"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

### Code Style
- **Frontend**: Functional React components, hooks, Tailwind utility classes
- **Backend**: PEP 8, type hints, async/await throughout, docstrings on public functions

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🏗️ Architecture

```
┌──────────────────────────┐       REST/JSON        ┌──────────────────────────┐
│   React 19 Frontend      │◄─────────────────────►│   FastAPI Backend        │
│                          │                         │                          │
│  • Neo-brutalism UI      │                         │  • JWT Auth              │
│  • Recharts analytics    │                         │  • Rate Limiting         │
│  • IBM Plex Sans fonts   │                         │  • Async Motor driver    │
│  • Sidebar + 11 tabs     │                         │  • Gemini AI integration │
└──────────────────────────┘                         └──────────┬───────────────┘
                                                                │
                                          ┌─────────────────────┼──────────────┐
                                          │                     │              │
                                   ┌──────▼──────┐   ┌─────────▼──────┐  ┌────▼────────┐
                                   │   MongoDB   │   │  Google Gemini │  │ ExchangeRate│
                                   │  (Motor)    │   │   AI (Vision,  │  │    API      │
                                   │             │   │   Chat, NLP)   │  │  (Cached)   │
                                   └─────────────┘   └────────────────┘  └─────────────┘
```

---

<div align="center">

**RupeeFlow** — Built with ❤️ for better financial clarity

[GitHub](https://github.com/PratikHarkare06/RupeeFlow-The-Expence-Tracker) · [Report Bug](https://github.com/PratikHarkare06/RupeeFlow-The-Expence-Tracker/issues) · [Request Feature](https://github.com/PratikHarkare06/RupeeFlow-The-Expence-Tracker/issues)

</div>