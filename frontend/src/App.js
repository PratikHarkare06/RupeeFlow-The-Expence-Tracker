import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL;

// Auth Context
const AuthContext = createContext(null);

// Configure axios
axios.defaults.timeout = 30000;

// Add response interceptor for global error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear authentication if we get a 401
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      // Redirect to login page or show login modal
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Auth Provider Component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          // Set axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // Fetch user profile
          await fetchUserProfile();
        } catch (error) {
          console.error('Auth initialization failed:', error);
          delete axios.defaults.headers.common['Authorization'];
        }
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
      setLoading(false);
    };
    
    initAuth();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  };

  const login = async (email, password) => {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('API URL:', API);
    
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);
      
      console.log('Making login request to:', `${API}/auth/login`);
      
      const response = await axios.post(`${API}/auth/login`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('Login response:', response.data);
      
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setToken(access_token);
      
      // Immediately fetch user profile after successful login
      await fetchUserProfile();
      
      console.log('Login successful!');
      return true;
    } catch (error) {
      console.error('=== LOGIN ERROR ===');
      console.error('Error object:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      
      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error('Incorrect email or password. Please check your credentials and try again.');
      } else if (error.response?.status === 422) {
        throw new Error('Invalid email format. Please enter a valid email address.');
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      } else {
        throw new Error(error.response?.data?.detail || error.message || 'Login failed. Please try again.');
      }
    }
  };

  const register = async (email, password, fullName) => {
    try {
      const response = await axios.post(`${API}/auth/register`, {
        email,
        password,
        full_name: fullName
      });
      return response.data;
    } catch (error) {
      console.error('Registration failed:', error);
      if (error.response) {
        // Server responded with an error
        if (error.response.status === 400) {
          const errorMessage = error.response.data.detail || 'Invalid registration data';
          if (errorMessage.includes('already registered')) {
            throw new Error('This email is already registered. Please try logging in instead.');
          }
          throw new Error(errorMessage);
        } else if (error.response.status === 500) {
          throw new Error('Server error. Please try again later.');
        }
      } else if (error.request) {
        // Request was made but no response received
        throw new Error('Unable to reach the server. Please check your internet connection.');
      } else {
        // Something else went wrong
        throw new Error('An unexpected error occurred. Please try again.');
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

// Register Form Component
function RegisterForm({ onToggleForm }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const { register } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (fullName.trim().length === 0) {
      setError('Please enter your full name');
      return;
    }

    try {
      await register(email, password, fullName);
      onToggleForm(); // Switch to login form after successful registration
    } catch (err) {
      const errorMessage = err.message || 'Registration failed';
      setError(errorMessage);
      
      // If email already exists, suggest login
      if (errorMessage.includes('already registered')) {
        setTimeout(() => {
          if (window.confirm('This email is already registered. Would you like to go to the login page instead?')) {
            onToggleForm();
          }
        }, 2000); // Show confirmation after 2 seconds
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo Section */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-700 rounded-md flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join RupeeFlow today
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="full-name"
                    name="fullName"
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </span>
                Create Account
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={onToggleForm}
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Your intelligent expense companion
          </p>
        </div>
      </div>
    </div>
  );
}

// Login Form Component
function LoginForm({ onToggleForm }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    console.log('Login form submitted with:', { email, password: '***' });
    
    // Basic validation
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    try {
      await login(email, password);
      console.log('Login successful, redirecting...');
    } catch (err) {
      console.error('Login form error:', err);
      const errorMessage = err.message || err.response?.data?.detail || 'Login failed. Please try again.';
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo Section */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-700 rounded-md flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to RupeeFlow
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </span>
                Sign in
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={onToggleForm}
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                New user? Create an account
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Your intelligent expense companion
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, logout, isAuthenticated } = useContext(AuthContext);
  const [showRegister, setShowRegister] = useState(true); // Show register form by default
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState([]);
  const [insights, setInsights] = useState([]);
  const [userDashboard, setUserDashboard] = useState(null);
  const [loadingUserDashboard, setLoadingUserDashboard] = useState(false);
  
  // Form states
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category: '',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Chat assistant state
  const [chatMessages, setChatMessages] = useState([]); // { role: 'user'|'bot', text }
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Expense details modal state
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);

  // Indian expense categories
  const categories = [
    "Food & Dining", "Groceries & Household", "Transportation", "Shopping & Clothes", 
    "Bills & Utilities", "Mobile & Internet", "Healthcare", "Entertainment", 
    "Travel & Vacation", "Education & Courses", "Home & Family", "Personal Care", 
    "Gifts & Festivals", "EMI & Loans", "Investments & SIP", "Other"
  ];

  // Configure axios defaults
  useEffect(() => {
    axios.defaults.timeout = 10000; // 10 seconds timeout
    axios.defaults.timeoutErrorMessage = 'Request took too long to respond';
    axios.defaults.retry = 3;
    axios.defaults.retryDelay = 1000;
    
    // Add a response interceptor for retrying failed requests
    axios.interceptors.response.use(undefined, async (err) => {
      const { config, message } = err;
      if (!config || !config.retry) return Promise.reject(err);
      
      config.currentRetryAttempt = config.currentRetryAttempt || 0;
      
      if (config.currentRetryAttempt >= config.retry) {
        return Promise.reject(err);
      }
      
      config.currentRetryAttempt += 1;
      const delayRetryRequest = new Promise(resolve => {
        setTimeout(resolve, config.retryDelay || 1000);
      });
      
      await delayRetryRequest;
      console.log(`Retrying request (${config.currentRetryAttempt}/${config.retry})`);
      return axios(config);
    });
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAuthenticated) {
        return;
      }
      
      setLoading(true);
      try {
        await Promise.all([
          fetchExpenses(),
          fetchAnalytics(),
          fetchInsights()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (error.response?.status === 401) {
          logout();
          return;
        }
        alert('Failed to load data. Please check if the backend server is running.');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [isAuthenticated, logout]);

  // Fetch user dashboard data when tab is active
  useEffect(() => {
    if (activeTab === 'user-dashboard' && isAuthenticated && !userDashboard && !loadingUserDashboard) {
      fetchUserDashboard();
    }
  }, [activeTab, isAuthenticated]);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${API}/expenses`);
      console.log('=== EXPENSES FETCH DEBUG ===');
      console.log('Raw expenses response:', response.data);
      if (response.data && response.data.length > 0) {
        console.log('First expense sample:', response.data[0]);
        console.log('First expense keys:', Object.keys(response.data[0]));
        if (response.data[0].items) {
          console.log('Items found in first expense:', response.data[0].items.length);
        } else {
          console.log('No items field in first expense');
        }
      }
      setExpenses(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      if (error.response?.status === 401) {
        // Handle unauthorized - clear token and show login
        logout();
      }
      throw error;
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/analytics/monthly?months=6`);
      setAnalytics(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection to server timed out. Please check if the backend server is running.');
      }
      throw error;
    }
  };

  const fetchInsights = async () => {
    try {
      const response = await axios.get(`${API}/insights`);
      setInsights(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection to server timed out. Please check if the backend server is running.');
      }
      throw error;
    }
  };

  const fetchUserDashboard = async () => {
    try {
      setLoadingUserDashboard(true);
      console.log('Fetching user dashboard data...');
      const response = await axios.get(`${API}/user/dashboard`);
      console.log('User dashboard response:', response.data);
      setUserDashboard(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user dashboard:', error);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Connection to server timed out. Please check if the backend server is running.');
      }
      throw error;
    } finally {
      setLoadingUserDashboard(false);
    }
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API}/expenses`, {
        title: expenseForm.description, // Backend expects 'title' field
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        category: expenseForm.category || 'Other',
        description: expenseForm.description,
        receipt_url: null,
        user_id: '' // This will be set by the backend
      });
      
      // Reset form
      setExpenseForm({
        amount: '',
        description: '',
        category: '',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
      // Refresh data including user dashboard
      await Promise.all([
        fetchExpenses(),
        fetchAnalytics(),
        fetchInsights()
      ]);
      
      // Refresh user dashboard if it was loaded
      if (userDashboard) {
        await fetchUserDashboard();
      }
      
      setActiveTab('expenses');
    } catch (error) {
      console.error('Failed to create expense:', error);
      alert('Failed to create expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      alert('Please select a receipt image');
      return;
    }

    try {
      setProcessingReceipt(true);
      const formData = new FormData();
      formData.append('file', receiptFile);
      
      const response = await axios.post(`${API}/expenses/receipt`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success && response.data.extracted_data) {
        const data = response.data.extracted_data;
        setExtractedData(data);
        
        // Auto-fill form with extracted data
        if (data.amount) setExpenseForm(prev => ({ ...prev, amount: data.amount.toString() }));
        if (data.description) setExpenseForm(prev => ({ ...prev, description: data.description }));
        if (data.merchant) setExpenseForm(prev => ({ ...prev, merchant: data.merchant }));
        if (data.category) setExpenseForm(prev => ({ ...prev, category: data.category }));
        else setExpenseForm(prev => ({ ...prev, category: 'Other' }));
        if (data.date) setExpenseForm(prev => ({ ...prev, date: data.date }));
        
        // Check if expense was automatically created
        if (response.data.expense_created) {
          // Refresh data and switch to expenses view
          await fetchExpenses();
          await fetchAnalytics();
          await fetchInsights();
          setActiveTab('expenses');
          alert(response.data.message || 'Receipt processed and expense created automatically!');
        } else {
          // Show success message for manual review
          alert(response.data.message || 'Receipt processed successfully! Please review the extracted data.');
        }
      } else if (response.data.success) {
        // Handle case where processing was successful but no extracted_data
        setExtractedData(response.data);
        alert('Receipt processed successfully! Data: ' + JSON.stringify(response.data));
      } else {
        console.error('Receipt processing failed:', response.data);
        let errorMsg = response.data.error || 'Unknown error';
        if (response.data.raw_text) {
          errorMsg += '\n\nExtracted text preview: ' + response.data.raw_text.substring(0, 200) + '...';
        }
        alert('Failed to extract data from receipt: ' + errorMsg);
      }
    } catch (error) {
      console.error('Receipt processing failed:', error);
      console.error('Error response:', error.response?.data);
      
      let errorMessage = 'Failed to process receipt. Please try again.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setProcessingReceipt(false);
      setReceiptFile(null);
    }
  };

  const deleteExpense = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    console.log('=== DELETE EXPENSE DEBUG ===');
    console.log('Attempting to delete expense ID:', expenseId);
    console.log('API URL:', `${API}/expenses/${expenseId}`);
    console.log('Current expenses count:', (expenses || []).length);
    
    try {
      const response = await axios.delete(`${API}/expenses/${expenseId}`);
      console.log('Delete response:', response.data);
      
      // Refresh data after successful deletion including user dashboard
      await Promise.all([
        fetchExpenses(),
        fetchAnalytics(),
        fetchInsights()
      ]);
      
      // Refresh user dashboard if it was loaded
      if (userDashboard) {
        await fetchUserDashboard();
      }
      
      console.log('Expense deleted successfully and data refreshed');
      alert('Expense deleted successfully!');
      
    } catch (error) {
      console.error('=== DELETE EXPENSE ERROR ===');
      console.error('Error object:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Provide specific error messages based on error type
      if (error.response?.status === 404) {
        console.warn('Expense not found, refreshing data...');
        // Refresh the expenses list since the expense might already be deleted
        await fetchExpenses();
        alert('This expense no longer exists. The list has been refreshed.');
      } else if (error.response?.status === 401) {
        alert('You are not authorized to delete this expense. Please log in again.');
      } else if (error.response?.status === 403) {
        alert('You do not have permission to delete this expense.');
      } else if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
        alert('Cannot connect to server. Please check your internet connection and try again.');
      } else {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete expense';
        alert(`Failed to delete expense: ${errorMessage}`);
      }
    }
  };

  const openExpenseDetails = (expense) => {
    console.log('Opening expense details for:', expense);
    setSelectedExpense(expense);
    setShowExpenseDetails(true);
  };

  const closeExpenseDetails = () => {
    setSelectedExpense(null);
    setShowExpenseDetails(false);
  };

  const sendChatQuestion = async (question) => {
    if (!question) return;
    try {
      setChatLoading(true);
      // append user message
      setChatMessages(prev => [...prev, { role: 'user', text: question }]);

      // Simple client-side expense analysis
      const response = analyzeExpenseQuestion(question);
      
      // append bot message with optional structured data
      setChatMessages(prev => [...prev, { role: 'bot', text: response.answer, data: response.data || null }]);
      return response;
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error. Please try again.' }]);
      throw err;
    } finally {
      setChatLoading(false);
    }
  };

  const analyzeExpenseQuestion = (question) => {
    const q = question.toLowerCase().trim();
    const currentExpenses = expenses || [];
    
    console.log('Question:', question);
    console.log('Normalized query:', q);
    console.log('Total expenses available:', currentExpenses.length);

    // Total spending questions (be more specific to avoid conflicts)
    if ((q.includes('total') && (q.includes('spent') || q.includes('spending'))) || 
        q === 'total' || q.includes('how much have i spent in total')) {
      const total = getTotalExpenses();
      console.log('Matched: Total spending');
      return {
        answer: `Your total spending is ${formatCurrency(total)} across ${currentExpenses.length} expenses.`,
        data: { total, count: currentExpenses.length }
      };
    }

    // Recent expenses - limit to 3 most recent
    if (q.includes('recent') || q.includes('latest') || q.includes('last') || q.includes('show me')) {
      console.log('Matched: Recent expenses question');
      let recent = [...currentExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
      if (q.includes('5') || q.includes('five')) recent = recent.slice(0, 5);
      if (q.includes('10') || q.includes('ten')) recent = recent.slice(0, 10);
      
      console.log('Recent expenses found:', recent.length);
      
      return {
        answer: `Here are your ${recent.length} most recent expenses:`,
        data: { expenses: recent }
      };
    }

    // Specific amount queries
    if (q.includes('above') || q.includes('over') || q.includes('more than')) {
      const amountMatch = q.match(/(\d+)/);
      if (amountMatch) {
        const threshold = parseInt(amountMatch[1]);
        const highExpenses = currentExpenses.filter(exp => exp.amount > threshold);
        return {
          answer: `You have ${highExpenses.length} expenses above ₹${threshold}:`,
          data: { expenses: highExpenses.slice(0, 5) } // Limit to 5
        };
      }
    }

    // Date-specific queries
    if (q.includes('today')) {
      const today = new Date().toISOString().split('T')[0];
      const todayExpenses = currentExpenses.filter(exp => exp.date === today);
      return {
        answer: `Today you've spent ${formatCurrency(todayExpenses.reduce((sum, exp) => sum + exp.amount, 0))} on ${todayExpenses.length} expenses:`,
        data: { expenses: todayExpenses }
      };
    }

    if (q.includes('yesterday')) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const yesterdayExpenses = currentExpenses.filter(exp => exp.date === yesterday);
      return {
        answer: `Yesterday you spent ${formatCurrency(yesterdayExpenses.reduce((sum, exp) => sum + exp.amount, 0))} on ${yesterdayExpenses.length} expenses:`,
        data: { expenses: yesterdayExpenses }
      };
    }

    // Enhanced category-specific questions with better matching
    const categoryMap = {
      'food': ['Food & Dining'],
      'dining': ['Food & Dining'],
      'restaurant': ['Food & Dining'],
      'eat': ['Food & Dining'],
      'meal': ['Food & Dining'],
      'grocery': ['Groceries & Household'],
      'groceries': ['Groceries & Household'],
      'household': ['Groceries & Household'],
      'transport': ['Transportation'],
      'transportation': ['Transportation'],
      'travel': ['Transportation', 'Travel & Vacation'],
      'cab': ['Transportation'],
      'uber': ['Transportation'],
      'ola': ['Transportation'],
      'shopping': ['Shopping & Clothes'],
      'clothes': ['Shopping & Clothes'],
      'fashion': ['Shopping & Clothes'],
      'bills': ['Bills & Utilities'],
      'utilities': ['Bills & Utilities'],
      'electricity': ['Bills & Utilities'],
      'power': ['Bills & Utilities'],
      'water': ['Bills & Utilities'],
      'gas': ['Bills & Utilities'],
      'mobile': ['Mobile & Internet'],
      'internet': ['Mobile & Internet'],
      'phone': ['Mobile & Internet'],
      'health': ['Healthcare'],
      'healthcare': ['Healthcare'],
      'medical': ['Healthcare'],
      'entertainment': ['Entertainment'],
      'movie': ['Entertainment'],
      'education': ['Education & Courses'],
      'accommodation': ['Accommodation']
    };

    // Check category-specific questions
    for (const [keyword, categories] of Object.entries(categoryMap)) {
      if (q.includes(keyword)) {
        console.log(`Matched category keyword: ${keyword}`);
        const categoryExpenses = currentExpenses.filter(exp => 
          categories.some(cat => exp.category === cat)
        );
        const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        console.log(`Found ${categoryExpenses.length} expenses for ${keyword}`);
        console.log('Matching expenses:', categoryExpenses.slice(0, 2));
        
        if (categoryExpenses.length === 0) {
          return {
            answer: `You haven't spent anything on ${keyword} yet.`,
            data: { total: 0, category: keyword, expenses: [] }
          };
        }
        
        return {
          answer: `You've spent ${formatCurrency(categoryTotal)} on ${keyword} (${categoryExpenses.length} transactions):`,
          data: { total: categoryTotal, category: keyword, expenses: categoryExpenses.slice(0, 5) }
        };
      }
    }

    // This week questions
    if (q.includes('week') || q.includes('weekly')) {
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const weeklyExpenses = currentExpenses.filter(exp => exp.date >= oneWeekAgo);
      const weeklyTotal = weeklyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      return {
        answer: `This week you've spent ${formatCurrency(weeklyTotal)} across ${weeklyExpenses.length} expenses:`,
        data: { total: weeklyTotal, expenses: weeklyExpenses.slice(0, 5) } // Limit to 5
      };
    }

    // This month questions
    if (q.includes('month') || q.includes('monthly')) {
      const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const monthlyExpenses = currentExpenses.filter(exp => exp.date?.startsWith(thisMonth));
      const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      return {
        answer: `This month you've spent ${formatCurrency(monthlyTotal)} across ${monthlyExpenses.length} expenses:`,
        data: { total: monthlyTotal, expenses: monthlyExpenses.slice(0, 5) } // Limit to 5
      };
    }

    // Top/highest spending questions
    if (q.includes('highest') || q.includes('largest') || q.includes('biggest') || q.includes('top')) {
      const sortedExpenses = [...currentExpenses].sort((a, b) => b.amount - a.amount);
      const topExpenses = sortedExpenses.slice(0, 5);
      
      return {
        answer: `Your highest expenses are:`,
        data: { expenses: topExpenses }
      };
    }

    // Category breakdown - only show summary
    if (q.includes('category') || q.includes('breakdown') || q.includes('categories')) {
      const categoryTotals = getCategoryTotals();
      const topCategories = Object.entries(categoryTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      const breakdown = topCategories.map(([cat, amount]) => `${cat}: ${formatCurrency(amount)}`).join(', ');
      
      return {
        answer: `Your top spending categories are: ${breakdown}`,
        data: { categories: topCategories }
      };
    }

    // Merchant-specific questions
    if (q.includes('from') || q.includes('at')) {
      const words = q.split(' ');
      const fromIndex = words.indexOf('from');
      const atIndex = words.indexOf('at');
      const keywordIndex = Math.max(fromIndex, atIndex);
      
      if (keywordIndex !== -1 && words[keywordIndex + 1]) {
        const merchantKeyword = words[keywordIndex + 1];
        const merchantExpenses = currentExpenses.filter(exp => 
          exp.description?.toLowerCase().includes(merchantKeyword) ||
          exp.merchant?.toLowerCase().includes(merchantKeyword)
        );
        
        if (merchantExpenses.length > 0) {
          const merchantTotal = merchantExpenses.reduce((sum, exp) => sum + exp.amount, 0);
          return {
            answer: `You've spent ${formatCurrency(merchantTotal)} at places matching '${merchantKeyword}' (${merchantExpenses.length} transactions):`,
            data: { expenses: merchantExpenses.slice(0, 5) }
          };
        }
      }
    }

    // If no matches found, provide helpful response with debugging
    console.log('No specific match found, showing default response');
    console.log('Question did not match any patterns for:', q);
    
    return {
      answer: "I can help you analyze your expenses! Try asking:\n\n💰 'How much have I spent in total?'\n📅 'Show me recent expenses'\n🍽️ 'How much did I spend on food?'\n📊 'What's my monthly spending?'\n🏆 'Show my highest expenses'\n📈 'Show category breakdown'\n🗓️ 'What did I spend today?'",
      data: null
    };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getTotalExpenses = () => {
    return (expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
  };

  const getCategoryTotals = () => {
    const totals = {};
    (expenses || []).forEach(expense => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    });
    return totals;
  };

  // If no user is logged in, show login form
  if (!isAuthenticated) {
    return showRegister ? 
      <RegisterForm onToggleForm={() => setShowRegister(false)} /> : 
      <LoginForm onToggleForm={() => setShowRegister(true)} />;
  }

  // Show loading while user profile is being fetched
  if (isAuthenticated && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-700 rounded-md flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">RupeeFlow</h1>
                <p className="text-sm text-gray-500 font-medium">Your intelligent expense companion</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { 
                id: 'user-dashboard', 
                name: 'Profile', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              },
              { 
                id: 'dashboard', 
                name: 'Dashboard', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              },
              { 
                id: 'add-expense', 
                name: 'Add Expense', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              },
              { 
                id: 'receipt-scan', 
                name: 'Scan Receipt', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              },
              { 
                id: 'assistant', 
                name: 'Assistant', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              },
              { 
                id: 'expenses', 
                name: 'All Expenses', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              },
              { 
                id: 'analytics', 
                name: 'Analytics', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Dashboard Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-slate-700 rounded-md flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Dashboard Overview</h2>
                  <p className="text-gray-600">Comprehensive view of your expense tracking</p>
                </div>
              </div>
            </div>

            {/* Expense Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-semibold text-gray-900">{(expenses || []).length}</p>
                    <p className="text-sm text-gray-500 mt-1">All time transactions</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Amount</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(getTotalExpenses())}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Current spending total</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Categories</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {Object.keys(getCategoryTotals()).length}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Expense categories used</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Category Breakdown</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {Object.entries(getCategoryTotals()).sort(([,a], [,b]) => b - a).slice(0, 6).map(([category, total], index) => {
                    const percentage = (total / getTotalExpenses()) * 100;
                    return (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{category}</p>
                            <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(total)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Expenses</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {(expenses || []).slice(0, 5).map(expense => (
                  <div 
                    key={expense.id} 
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                    onClick={() => openExpenseDetails(expense)}
                    title="Click to view full details"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {expense.category === 'Food & Dining' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /> :
                           expense.category === 'Groceries & Household' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.35 2.65a1 1 0 00.7 1.71h11.65M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v4.01" /> :
                           expense.category === 'Transportation' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /> :
                           expense.category === 'Shopping & Clothes' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /> :
                           expense.category === 'Bills & Utilities' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /> :
                           expense.category === 'Mobile & Internet' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /> :
                           expense.category === 'Healthcare' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> :
                           expense.category === 'Entertainment' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.01M15 10h1.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> :
                           expense.category === 'Travel & Vacation' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /> :
                           expense.category === 'Education & Courses' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> :
                           expense.category === 'Home & Family' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> :
                           expense.category === 'Personal Care' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> :
                           expense.category === 'Gifts & Festivals' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /> :
                           expense.category === 'EMI & Loans' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /> :
                           expense.category === 'Investments & SIP' ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> :
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                        <p className="text-sm text-gray-500">{expense.category} • {expense.date}</p>
                        {expense.items && expense.items.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">📦 {expense.items.length} items</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(expense.amount)}
                      </p>
                      {expense.ai_categorized && (
                        <p className="text-xs text-blue-600">AI categorized</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            {insights && insights.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">💡 AI Insights</h3>
                </div>
                <div className="p-6 space-y-4">
                  {(insights || []).map((insight, index) => (
                    <div key={index} className={`p-4 rounded-lg border transition-colors duration-200 hover:shadow-sm ${
                      insight.type === 'overspending' ? 'bg-red-50 border-red-200' :
                      insight.type === 'suggestion' ? 'bg-green-50 border-green-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <h4 className="font-medium text-gray-900">{insight.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'user-dashboard' && (
          <div className="space-y-6">
            {loadingUserDashboard ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading your profile...</p>
                </div>
              </div>
            ) : userDashboard ? (
              <>
                {/* User Profile Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <span className="text-3xl text-white font-bold">
                          {userDashboard?.user_info?.full_name ? userDashboard.user_info.full_name.charAt(0).toUpperCase() : '👤'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">{userDashboard?.user_info?.full_name || 'User'}</h2>
                        <p className="text-gray-600">{userDashboard?.user_info?.email || 'No email'}</p>
                        <p className="text-sm text-gray-500 mt-1">Member since {userDashboard?.account_info?.member_since ? new Date(userDashboard.account_info.member_since).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={logout}
                        className="px-4 py-2 text-sm text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expense Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Spent</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(userDashboard?.expense_statistics?.total_spent || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">💰</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {userDashboard?.expense_statistics?.total_transactions || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">📝</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Average per Expense</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(userDashboard?.expense_statistics?.average_per_transaction || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Monthly Average</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency((userDashboard?.expense_statistics?.total_spent || 0) / Math.max((userDashboard?.monthly_trend || []).length, 1))}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">📅</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Category Breakdown</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {(userDashboard?.category_breakdown || []).map((category, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">
                              {category.category === 'Food & Dining' ? '🍽️' :
                               category.category === 'Groceries & Household' ? '🛒' :
                               category.category === 'Transportation' ? '🚗' :
                               category.category === 'Shopping & Clothes' ? '👕' :
                               category.category === 'Bills & Utilities' ? '⚡' :
                               category.category === 'Mobile & Internet' ? '📱' :
                               category.category === 'Healthcare' ? '🏥' :
                               category.category === 'Entertainment' ? '🎬' :
                               category.category === 'Travel & Vacation' ? '✈️' :
                               category.category === 'Education & Courses' ? '📚' :
                               category.category === 'Home & Family' ? '🏠' :
                               category.category === 'Personal Care' ? '💅' :
                               category.category === 'Gifts & Festivals' ? '🎁' :
                               category.category === 'EMI & Loans' ? '💳' :
                               category.category === 'Investments & SIP' ? '📈' : '💼'}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{category.category}</p>
                              <div className="w-48 bg-gray-200 rounded-full h-2 mt-1">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full"
                                  style={{ width: `${category.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(category.total)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {category.percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Expenses */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Recent Expenses</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {(userDashboard?.recent_expenses || []).map(expense => (
                      <div 
                        key={expense.id} 
                        className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openExpenseDetails(expense)}
                        title="Click to view full details"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-lg">
                              {expense.category === 'Food & Dining' ? '🍽️' :
                               expense.category === 'Groceries & Household' ? '🛒' :
                               expense.category === 'Transportation' ? '🚗' :
                               expense.category === 'Shopping & Clothes' ? '👕' :
                               expense.category === 'Bills & Utilities' ? '⚡' :
                               expense.category === 'Mobile & Internet' ? '📱' :
                               expense.category === 'Healthcare' ? '🏥' :
                               expense.category === 'Entertainment' ? '🎬' :
                               expense.category === 'Travel & Vacation' ? '✈️' :
                               expense.category === 'Education & Courses' ? '📚' :
                               expense.category === 'Home & Family' ? '🏠' :
                               expense.category === 'Personal Care' ? '💅' :
                               expense.category === 'Gifts & Festivals' ? '🎁' :
                               expense.category === 'EMI & Loans' ? '💳' :
                               expense.category === 'Investments & SIP' ? '📈' : '💼'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                            <p className="text-sm text-gray-500">{expense.category} • {expense.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monthly Trends */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Monthly Spending Trends</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {(userDashboard?.monthly_trend || []).map((month, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-900 w-24">
                              {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                            <div className="flex-1">
                              <div className="w-48 bg-gray-200 rounded-full h-3">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full"
                                  style={{ width: `${Math.min(month.total / Math.max(...(userDashboard?.monthly_trend || []).map(m => m.total || 0), 1) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(month.total)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {month.count} expenses
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="text-center">
                  <p className="text-gray-500">Failed to load user dashboard. Please try again.</p>
                  <button
                    onClick={fetchUserDashboard}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'add-expense' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Add New Expense</h3>
                <p className="text-sm text-gray-500 mt-1">Enter expense details manually</p>
              </div>
              
              <form onSubmit={handleSubmitExpense} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm(prev => ({...prev, amount: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="₹0.00"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm(prev => ({...prev, date: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({...prev, description: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="What did you spend money on? (e.g., Zomato order, auto fare, grocery shopping)"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm(prev => ({...prev, category: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">AI will categorize</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Merchant
                    </label>
                    <input
                      type="text"
                      value={expenseForm.merchant}
                      onChange={(e) => setExpenseForm(prev => ({...prev, merchant: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Store or company name"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm(prev => ({...prev, notes: e.target.value}))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Additional notes (optional)"
                  />
                </div>
                
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setExpenseForm({
                      amount: '',
                      description: '',
                      category: '',
                      merchant: '',
                      date: new Date().toISOString().split('T')[0],
                      notes: ''
                    })}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'receipt-scan' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">📄 Scan Bill/Receipt</h3>
                <p className="text-sm text-gray-500 mt-1">Upload your Indian bill/receipt and let AI extract expense details automatically</p>
              </div>
              
              <form onSubmit={handleReceiptUpload} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bill/Receipt Image *
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-gray-600">
                        <label htmlFor="receipt-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500">
                          <span>Upload your bill/receipt</span>
                          <input 
                            id="receipt-upload" 
                            name="receipt-upload" 
                            type="file" 
                            accept="image/*" 
                            className="sr-only"
                            onChange={(e) => setReceiptFile(e.target.files[0])}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      {receiptFile && (
                        <p className="text-sm text-indigo-600 font-medium">Selected: {receiptFile.name}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!receiptFile || processingReceipt}
                    className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {processingReceipt ? 'Processing...' : 'Process Receipt'}
                  </button>
                </div>
              </form>
              
              {extractedData && (
                <div className="px-6 pb-6">
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-green-800 mb-2">✅ Extracted Data</h4>
                    <div className="text-sm text-green-700 space-y-1">
                      <p><strong>Amount:</strong> {extractedData.amount ? formatCurrency(extractedData.amount) : 'Not found'}</p>
                      <p><strong>Description:</strong> {extractedData.description || 'Not found'}</p>
                      <p><strong>Merchant:</strong> {extractedData.merchant || 'Not found'}</p>
                      <p><strong>Category:</strong> <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">{extractedData.category || 'Not found'}</span></p>
                      <p><strong>Date:</strong> {extractedData.date || 'Not found'}</p>
                    </div>

                    {/* Show per-item prices when available */}
                    {extractedData.items && extractedData.items.length > 0 && (
                      <div className="mt-3 text-sm text-green-700">
                        <p className="font-medium">📦 Items ({extractedData.items.length})</p>
                        <div className="mt-1 max-h-32 overflow-y-auto">
                          <ul className="list-disc ml-5 space-y-1">
                            {(extractedData.items || []).map((it, idx) => (
                              <li key={idx} className="flex justify-between items-center">
                                <span>{it.quantity > 1 && `${it.quantity}x `}{it.name || 'Item'}</span>
                                <span className="font-medium">{formatCurrency(Number(it.amount || 0))}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {extractedData.receipt_url && (
                      <div className="mt-2">
                        <p className="text-xs text-green-600">📄 Receipt saved successfully</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">💬 Assistant</h3>
              <p className="text-sm text-gray-500 mb-4">Ask questions about your expenses (e.g., "How much did I spend this month?", "Show recent expenses").</p>

              <div className="h-64 overflow-y-auto border rounded p-3 mb-4 bg-gray-50" id="chatWindow">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-gray-500">Start by asking a question below.</p>
                ) : (
                  (chatMessages || []).map((m, i) => (
                    <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block px-3 py-1.5 rounded ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 shadow-sm'}`}>
                        {m.text}
                      </div>
                      {/* Render structured data returned by bot */}
                      {m.role === 'bot' && m.data && (
                        <div className="mt-2 text-left bg-white p-2 rounded shadow-sm">
                          {m.data.total !== undefined && (
                            <div className="mb-2">
                              <p className="text-sm text-gray-600">Total:</p>
                              <p className="text-lg font-semibold">{formatCurrency(Number(m.data.total || 0))}</p>
                            </div>
                          )}

                          {m.data.category && (
                            <div className="mb-2 text-sm text-gray-700">Category: {m.data.category}</div>
                          )}

                          {m.data.expenses && Array.isArray(m.data.expenses) && m.data.expenses.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr>
                                    <th className="px-2 py-1">Date</th>
                                    <th className="px-2 py-1">Description</th>
                                    <th className="px-2 py-1">Category</th>
                                    <th className="px-2 py-1 text-right">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(m.data.expenses || []).slice(0, 5).map((ex, idx) => (
                                    <tr key={idx} className="border-t">
                                      <td className="px-2 py-1">{ex.date || (ex.created_at ? new Date(ex.created_at).toLocaleDateString() : '')}</td>
                                      <td className="px-2 py-1 truncate">{ex.description}</td>
                                      <td className="px-2 py-1">{ex.category}</td>
                                      <td className="px-2 py-1 text-right">{formatCurrency(Number(ex.amount || 0))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {m.data.expenses.length > 5 && (
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                  Showing 5 of {m.data.expenses.length} expenses
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={async (e) => { e.preventDefault(); if (!chatInput) return; await sendChatQuestion(chatInput); setChatInput(''); setActiveTab('assistant'); }} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your expenses..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
                />
                <button type="submit" disabled={chatLoading || !chatInput} className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50">
                  {chatLoading ? 'Thinking...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">All Expenses</h3>
              <p className="text-sm text-gray-500">{(expenses || []).length} total expenses</p>
            </div>
            
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-indigo-500 bg-white">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading expenses...
                </div>
              </div>
            ) : (expenses || []).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No expenses yet. Add your first expense to get started!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {(expenses || []).map(expense => (
                  <div key={expense.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-3 flex-1 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                        onClick={() => openExpenseDetails(expense)}
                        title="Click to view full details"
                      >
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="text-xl">
                            {expense.category === 'Food & Dining' ? '🍽️' :
                             expense.category === 'Groceries & Household' ? '🛒' :
                             expense.category === 'Transportation' ? '🚗' :
                             expense.category === 'Shopping & Clothes' ? '👕' :
                             expense.category === 'Bills & Utilities' ? '⚡' :
                             expense.category === 'Mobile & Internet' ? '📱' :
                             expense.category === 'Healthcare' ? '🏥' :
                             expense.category === 'Entertainment' ? '🎬' :
                             expense.category === 'Travel & Vacation' ? '✈️' :
                             expense.category === 'Education & Courses' ? '📚' :
                             expense.category === 'Home & Family' ? '🏠' :
                             expense.category === 'Personal Care' ? '💅' :
                             expense.category === 'Gifts & Festivals' ? '🎁' :
                             expense.category === 'EMI & Loans' ? '💳' :
                             expense.category === 'Investments & SIP' ? '📈' : '💼'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                          <p className="text-sm text-gray-500">
                            {expense.category}
                            {expense.merchant && ` • ${expense.merchant}`}
                            {expense.ai_categorized && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                AI
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{expense.date}</p>

                          {/* Show preview of itemized lines */}
                          {expense.items && expense.items.length > 0 && (
                            <p className="text-xs text-gray-600 mt-1">
                              📦 {expense.items.length} items • Click to view details
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(expense.amount)}
                          </p>
                          {expense.ai_confidence && (
                            <p className="text-xs text-gray-500">
                              {Math.round(expense.ai_confidence * 100)}% confidence
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteExpense(expense.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete expense"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Category Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">📊 Category Breakdown</h3>
              </div>
              <div className="p-6">
                {Object.entries(getCategoryTotals()).length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No expenses to analyze yet</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(getCategoryTotals())
                      .sort(([,a], [,b]) => b - a)
                      .map(([category, total]) => {
                        const percentage = (total / getTotalExpenses()) * 100;
                        return (
                          <div key={category} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <span className="text-lg">
                                {category === 'Food & Dining' ? '🍽️' :
                                 category === 'Groceries & Household' ? '🛒' :
                                 category === 'Transportation' ? '🚗' :
                                 category === 'Shopping & Clothes' ? '👕' :
                                 category === 'Bills & Utilities' ? '⚡' :
                                 category === 'Mobile & Internet' ? '📱' :
                                 category === 'Healthcare' ? '🏥' :
                                 category === 'Entertainment' ? '🎬' :
                                 category === 'Travel & Vacation' ? '✈️' :
                                 category === 'Education & Courses' ? '📚' :
                                 category === 'Home & Family' ? '🏠' :
                                 category === 'Personal Care' ? '💅' :
                                 category === 'Gifts & Festivals' ? '🎁' :
                                 category === 'EMI & Loans' ? '💳' :
                                 category === 'Investments & SIP' ? '📈' : '💼'}
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-medium text-gray-900">{category}</p>
                                  <p className="text-sm font-medium text-gray-900">{formatCurrency(total)}</p>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                    style={{width: `${percentage}%`}}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% of total</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Trends */}
            {(analytics || []).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">📈 Monthly Trends</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {(analytics || []).map(month => (
                      <div key={month.month} className="border-b border-gray-100 pb-4 last:border-b-0">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900">{month.month}</h4>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">{formatCurrency(month.total)}</p>
                            <p className="text-sm text-gray-500">{month.expense_count} expenses</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {(month.categories || []).slice(0, 6).map(cat => (
                            <div key={cat.category} className="text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600 truncate">{cat.category}</span>
                                <span className="font-medium text-gray-900 ml-2">{formatCurrency(cat.total)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                <div 
                                  className="bg-indigo-600 h-1 rounded-full" 
                                  style={{width: `${cat.percentage}%`}}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Expense Details Modal */}
      {showExpenseDetails && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Expense Details</h3>
              <button
                onClick={closeExpenseDetails}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Comprehensive Extracted Data Display */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-green-800 mb-3">✅ Extracted Data</h4>
                <div className="space-y-2 text-sm text-green-700">
                  <p><strong>Amount:</strong> {formatCurrency(selectedExpense.amount)}</p>
                  <p><strong>Description:</strong> {selectedExpense.description}</p>
                  {selectedExpense.merchant && (
                    <p><strong>Merchant:</strong> {selectedExpense.merchant}</p>
                  )}
                  <p><strong>Category:</strong> {selectedExpense.category}</p>
                  <p><strong>Date:</strong> {selectedExpense.date}</p>
                </div>
              </div>

              {/* Items Breakdown - Enhanced Format */}
              {selectedExpense.items && selectedExpense.items.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-blue-800 mb-3">📦 Items ({selectedExpense.items.length})</h4>
                  <div className="space-y-2">
                    {selectedExpense.items.map((item, idx) => (
                      <div key={idx} className="bg-white rounded p-3 border">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-sm text-gray-900">
                              <span className="font-medium">{item.quantity || 1}</span> {item.name || item.description || `Item ${idx + 1}`}
                              {item.unit_price && (
                                <span className="text-gray-600 ml-2">{formatCurrency(Number(item.unit_price))}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {formatCurrency(Number(item.amount || 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Amount Paid */}
                    <div className="border-t-2 border-gray-300 pt-2 mt-3">
                      <div className="flex justify-between items-center bg-gray-100 rounded p-3">
                        <span className="font-semibold text-gray-900">Amount Paid:</span>
                        <span className="font-bold text-lg text-gray-900">{formatCurrency(selectedExpense.amount)}</span>
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 rounded p-2 mt-1">
                        <span className="text-sm text-gray-700">Change:</span>
                        <span className="text-sm text-gray-700">₹0.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Receipt Image */}
              {selectedExpense.receipt_url && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-800 mb-3">📄 Receipt Image</h4>
                  <div className="text-center">
                    <img 
                      src={`${API}${selectedExpense.receipt_url}`}
                      alt="Receipt"
                      className="max-w-full h-auto rounded border mx-auto"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                </div>
              )}

              {/* Additional Extracted Information */}
              {(selectedExpense.category_reason || selectedExpense.category_confidence || selectedExpense.raw_text || selectedExpense.needs_confirmation) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-gray-800 mb-3">ℹ️ Additional Information</h4>
                  
                  {selectedExpense.category_confidence && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">AI Categorization Confidence:</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        selectedExpense.category_confidence === 'high' ? 'bg-green-100 text-green-800' :
                        selectedExpense.category_confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedExpense.category_confidence.toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {selectedExpense.category_reason && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">Categorization Reason:</p>
                      <p className="text-sm text-gray-900">{selectedExpense.category_reason}</p>
                    </div>
                  )}
                  
                  {selectedExpense.needs_confirmation && (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        ⚠️ Needs Manual Review
                      </span>
                    </div>
                  )}
                  
                  {selectedExpense.extracted_date && selectedExpense.extracted_date !== selectedExpense.date && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">Original Extracted Date:</p>
                      <p className="text-sm text-gray-900">{selectedExpense.extracted_date}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeExpenseDetails}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this expense?')) {
                      deleteExpense(selectedExpense.id);
                      closeExpenseDetails();
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                >
                  Delete Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;