# RupeeFlow

**Your intelligent expense companion**

A professional, AI-powered expense tracking application designed for comprehensive financial management. RupeeFlow provides intelligent categorization, receipt scanning, and detailed analytics to help you manage your expenses efficiently.

## 🌟 Features

### 💰 Expense Management
- **Quick Expense Entry**: Add expenses manually with detailed categorization
- **AI-Powered Categorization**: Automatic expense categorization using intelligent algorithms
- **Receipt Scanning**: Upload and scan receipts with OCR technology for automatic data extraction
- **Multi-Category Support**: 16 predefined categories for Indian expense patterns

### 📊 Analytics & Insights
- **Dashboard Overview**: Comprehensive view of spending patterns and statistics
- **Category Breakdown**: Visual representation of spending by category with progress bars
- **Monthly Trends**: Track spending patterns over time with trend analysis
- **AI Insights**: Get personalized recommendations and spending alerts

### 👤 User Management
- **User Profiles**: Detailed user dashboard with account information
- **Secure Authentication**: JWT-based authentication system
- **Profile Management**: View user statistics, recent expenses, and account details

### 🤖 AI Assistant
- **Intelligent Chat**: Ask questions about your expenses in natural language
- **Expense Queries**: Get instant answers about spending patterns, categories, and totals
- **Smart Analytics**: AI-powered expense analysis and recommendations

## 🛠️ Technology Stack

### Frontend
- **React.js**: Modern JavaScript framework for building user interfaces
- **Tailwind CSS**: Utility-first CSS framework for professional styling
- **Axios**: HTTP client for API communication
- **JavaScript ES6+**: Modern JavaScript features and syntax

### Backend
- **FastAPI**: High-performance Python web framework
- **MongoDB**: NoSQL database for flexible data storage
- **Python 3.8+**: Backend programming language
- **JWT Authentication**: Secure token-based authentication
- **OCR Integration**: Receipt scanning and data extraction

### Additional Features
- **Professional UI**: Corporate-grade design with clean typography
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Live data synchronization across components

## 📁 Project Structure

```
RupeeFlow/
├── frontend/                 # React.js frontend application
│   ├── public/              # Static assets and HTML template
│   ├── src/                 # Source code
│   │   ├── App.js          # Main application component
│   │   ├── App.css         # Application styles
│   │   └── index.js        # Application entry point
│   ├── package.json        # Frontend dependencies
│   └── package-lock.json   # Dependency lock file
├── backend/                 # FastAPI backend application
│   ├── server.py           # Main server file with API endpoints
│   └── requirements.txt    # Python dependencies
└── README.md               # Project documentation
```

## 🚀 Installation & Setup

### Prerequisites
- **Node.js** (v14 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn** package manager

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   Create a `.env` file in the backend directory:
   ```env
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=rupeeflow
   SECRET_KEY=your-secret-key-here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

5. **Start MongoDB service**
   ```bash
   # On macOS with Homebrew
   brew services start mongodb/brew/mongodb-community
   
   # On Ubuntu/Debian
   sudo systemctl start mongod
   
   # On Windows
   net start MongoDB
   ```

6. **Run the backend server**
   ```bash
   python server.py
   ```
   
   The backend will be available at `http://127.0.0.1:8001`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the frontend directory:
   ```env
   REACT_APP_API_URL=http://127.0.0.1:8001
   ```

4. **Start the development server**
   ```bash
   npm start
   ```
   
   The frontend will be available at `http://localhost:3000`

## 🎯 Usage Guide

### Getting Started

1. **User Registration**
   - Open RupeeFlow in your browser
   - Click "Create an account" on the welcome page
   - Fill in your details (Full Name, Email, Password)
   - Click "Create Account" to register

2. **User Login**
   - Enter your email and password
   - Click "Sign in" to access your dashboard

### Adding Expenses

#### Manual Entry
1. Navigate to "Add Expense" tab
2. Fill in expense details:
   - Amount
   - Description
   - Category (from 16 predefined options)
   - Date
   - Optional notes
3. Click "Add Expense" to save

#### Receipt Scanning
1. Navigate to "Scan Receipt" tab
2. Upload a receipt image (PNG, JPG, PDF)
3. Wait for AI processing
4. Review extracted data
5. Confirm or edit details
6. Save the expense

### Viewing Analytics

#### Dashboard Overview
- View total expenses, spending amount, and active categories
- See recent expenses with quick details
- Monitor category breakdown with visual progress bars

#### Profile Dashboard
- Access comprehensive user statistics
- View expense statistics (total spent, transaction count, averages)
- Monitor category breakdown with percentages
- Track monthly spending trends
- Review recent expense history

### Using AI Assistant

1. Navigate to "Assistant" tab
2. Ask questions in natural language:
   - "How much did I spend this month?"
   - "Show me my food expenses"
   - "What are my top spending categories?"
   - "Show recent expenses"
3. Get instant answers with formatted data

## 📊 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=securepassword
```

### Expense Endpoints

#### Create Expense
```http
POST /expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Grocery Shopping",
  "amount": 1500.00,
  "date": "2024-01-15",
  "category": "Groceries & Household",
  "description": "Weekly groceries"
}
```

#### Get All Expenses
```http
GET /expenses
Authorization: Bearer <token>
```

#### Delete Expense
```http
DELETE /expenses/{expense_id}
Authorization: Bearer <token>
```

### Analytics Endpoints

#### Monthly Analytics
```http
GET /analytics/monthly?months=6
Authorization: Bearer <token>
```

#### AI Insights
```http
GET /insights
Authorization: Bearer <token>
```

#### User Dashboard
```http
GET /user/dashboard
Authorization: Bearer <token>
```

### Receipt Processing

#### Upload Receipt
```http
POST /expenses/receipt
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <receipt_image>
```

## 🎨 Design System

### Color Palette
- **Primary**: Slate-700 (Corporate branding)
- **Secondary**: Blue-600 (Accent elements)
- **Text**: Gray-900 (Primary text)
- **Muted**: Gray-500 (Secondary text)
- **Background**: Gray-50 (Page background)
- **Cards**: White (Content containers)

### Typography
- **Headers**: Font-semibold, tracking-tight
- **Body**: Font-medium for emphasis, font-normal for content
- **Labels**: Font-medium, text-sm for form labels

### Components
- **Cards**: Rounded-lg with subtle shadows
- **Buttons**: Professional styling with hover effects
- **Forms**: Clean inputs with proper spacing
- **Navigation**: Tab-based navigation with professional styling

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
# Database Configuration
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=rupeeflow

# Authentication
SECRET_KEY=your-super-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Server Configuration
HOST=127.0.0.1
PORT=8001
DEBUG=True
```

#### Frontend (.env)
```env
# API Configuration
REACT_APP_API_URL=http://127.0.0.1:8001

# Development Configuration
REACT_APP_DEBUG=true
GENERATE_SOURCEMAP=false
```

## 🚨 Troubleshooting

### Common Issues

#### Backend Issues

**MongoDB Connection Error**
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB service
brew services start mongodb/brew/mongodb-community  # macOS
sudo systemctl start mongod                         # Linux
```

**Port Already in Use**
```bash
# Find process using port 8001
lsof -i :8001

# Kill the process
kill -9 <PID>
```

#### Frontend Issues

**Module Not Found Error**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**CORS Error**
- Ensure backend is running on correct port
- Check REACT_APP_API_URL in frontend .env file
- Verify CORS configuration in backend

#### Database Issues

**Authentication Failed**
- Check MongoDB credentials
- Verify database permissions
- Ensure user has read/write access

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Commit with descriptive messages**
   ```bash
   git commit -m "Add: New expense categorization feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Code Style Guidelines

#### Frontend (JavaScript/React)
- Use functional components with hooks
- Follow ESLint configuration
- Use meaningful variable and function names
- Add comments for complex logic
- Maintain consistent indentation (2 spaces)

#### Backend (Python)
- Follow PEP 8 style guidelines
- Use type hints where applicable
- Add docstrings for functions and classes
- Handle errors gracefully
- Use meaningful variable names

## 📝 License

This project is licensed under the MIT License. See the LICENSE file for details.

## 🏗️ Architecture

### System Architecture
```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│   React.js      │◄──────────────►│   FastAPI       │
│   Frontend      │                 │   Backend       │
└─────────────────┘                 └─────────────────┘
                                             │
                                             │ Database
                                             ▼
                                    ┌─────────────────┐
                                    │   MongoDB       │
                                    │   Database      │
                                    └─────────────────┘
```

### Data Flow
1. **User Interaction**: User interacts with React frontend
2. **API Request**: Frontend sends HTTP requests to FastAPI backend
3. **Authentication**: JWT tokens validate user requests
4. **Data Processing**: Backend processes data and business logic
5. **Database Operations**: MongoDB stores and retrieves data
6. **Response**: Data flows back through the stack to the user

## 🔐 Security

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: Bcrypt for secure password storage
- **Token Expiration**: Configurable token expiry times
- **Route Protection**: Protected routes require valid tokens

### Data Security
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: MongoDB queries with proper sanitization
- **CORS Configuration**: Controlled cross-origin resource sharing
- **Error Handling**: Secure error messages without sensitive data exposure

## 📈 Performance

### Frontend Optimization
- **Code Splitting**: Lazy loading for improved initial load times
- **Memoization**: React optimization hooks for expensive calculations
- **Image Optimization**: Optimized image loading and caching
- **Bundle Size**: Minimal dependencies for faster loading

### Backend Optimization
- **Database Indexing**: Optimized MongoDB queries with proper indexing
- **Async Operations**: Non-blocking I/O operations
- **Error Handling**: Efficient error handling and logging
- **API Rate Limiting**: Protection against abuse

## 🌐 Deployment

### Production Deployment

#### Backend Deployment
```bash
# Install production dependencies
pip install -r requirements.txt

# Set production environment variables
export DEBUG=False
export MONGODB_URL=your-production-mongodb-url

# Run with production server
uvicorn server:app --host 0.0.0.0 --port 8001
```

#### Frontend Deployment
```bash
# Build for production
npm run build

# Serve static files
# Deploy dist/ folder to your hosting service
```

### Docker Deployment
```dockerfile
# Backend Dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]

# Frontend Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## 📞 Support

### Getting Help
- **Documentation**: Check this README for detailed information
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Community**: Join our community discussions
- **Support**: Contact support for enterprise inquiries

### FAQ

**Q: How do I reset my password?**
A: Currently, password reset functionality is not implemented. Contact support for assistance.

**Q: Can I export my expense data?**
A: Data export functionality is planned for future releases.

**Q: Is my financial data secure?**
A: Yes, we use industry-standard security practices including JWT authentication and encrypted data storage.

**Q: Can I use RupeeFlow offline?**
A: Currently, RupeeFlow requires an internet connection. Offline functionality is planned for future releases.

---

**RupeeFlow** - Your intelligent expense companion
Built with ❤️ for better financial management