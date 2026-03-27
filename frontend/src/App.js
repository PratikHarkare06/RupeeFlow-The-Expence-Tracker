import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  LineChart, Line, AreaChart, Area, CartesianGrid, ComposedChart, ReferenceLine
} from 'recharts';


const API = process.env.REACT_APP_API_URL;

// Auth Context
const AuthContext = createContext(null);

// Configure axios
axios.defaults.timeout = 120000; // Increase to 120s for AI processing
axios.defaults.headers.common['Authorization'] = 'Bearer mock-token'; // Global auth bypass

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
  const [user, setUser] = useState({ id: 'dev-user', full_name: 'Development User', email: 'dev@rupeeflow.com' });
  const [token, setToken] = useState('mock-token');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Auth bypass: always set mock token and user
    axios.defaults.headers.common['Authorization'] = `Bearer mock-token`;
    setLoading(false);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/api/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  };

  const login = async (email, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await axios.post(`${API}/api/auth/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      await fetchUserProfile();
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error(error.response?.data?.detail || 'Invalid email or password');
    }
  };

  const register = async (email, password, fullName) => {
    try {
      const response = await axios.post(`${API}/api/auth/register`, {
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
    setIsAuthenticated(false);
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear all app specific data securely
    setExpenses([]);
    setBudgets([]);
    setRecurringItems([]);
    setGoals([]);
    setGroups([]);
    setSelectedGroup(null);
    setGroupExpenses([]);
    setAnalytics(null);
    setInsights(null);
    setUserDashboard(null);
    setForecast(null);
    setActiveTab('dashboard');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: true }}>
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    notes: '',
    original_currency: 'INR',
    original_amount: '',
    group_id: ''
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  // Multi-currency state
  const [exchangeRates, setExchangeRates] = useState({});
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [currencyLoading, setCurrencyLoading] = useState(false);

  // Group / Shared Wallet State
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [groupSettlements, setGroupSettlements] = useState([]);
  const [groupTab, setGroupTab] = useState('transactions'); // 'transactions' | 'settlements'
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupInviteCode, setGroupInviteCode] = useState('');
  const [showAddBill, setShowAddBill] = useState(false);
  const [groupBillForm, setGroupBillForm] = useState({ description: '', amount: '', category: 'Shared' });
  const [newWalletName, setNewWalletName] = useState('');

  const supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD'];

  const fetchCurrencyRates = async () => {
    try {
      const response = await axios.get(`${API}/api/currency/rates`);
      setExchangeRates(response.data.rates || {});
    } catch (error) {
      console.error('Failed to fetch currency rates:', error);
    }
  };

  const convertAmount = (amount, toCurrency) => {
    if (toCurrency === 'INR' || !exchangeRates[toCurrency]) return amount;
    return amount * exchangeRates[toCurrency];
  };

  const getCurrencySymbol = (code) => {
    switch(code) {
      case 'INR': return '₹';
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      default: return code;
    }
  };

  // Chat assistant state
  const [chatMessages, setChatMessages] = useState([]); // { role: 'user'|'bot', text }
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Expense details modal state
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);

  // Budget state
  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '', period: 'monthly' });
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Recurring expense state
  const [recurringItems, setRecurringItems] = useState([]);
  const [recurringForm, setRecurringForm] = useState({
    title: '', amount: '', category: '', frequency: 'monthly',
    next_date: new Date().toISOString().split('T')[0], description: '', is_active: true
  });
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  
  // Goals state
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', target_amount: '', target_date: '', color: 'indigo', icon: '💰' });
  const [contributionForm, setContributionForm] = useState({ goalId: null, amount: '' });
  
  // Forecasting state
  const [forecast, setForecast] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);

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
          fetchInsights(),
          fetchBudgets(),
          fetchRecurring(),
          fetchGoals(),
          fetchForecast(),
          fetchCurrencyRates(),
          fetchGroups()
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
    if (activeTab === 'budgets' && isAuthenticated) fetchBudgets();
    if (activeTab === 'recurring' && isAuthenticated) fetchRecurring();
    if (activeTab === 'goals' && isAuthenticated) fetchGoals();
    if (activeTab === 'groups' && isAuthenticated) fetchGroups();
  }, [activeTab, isAuthenticated]);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`${API}/api/expenses`);
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
      const response = await axios.get(`${API}/api/analytics/monthly?months=6`);
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
      const response = await axios.get(`${API}/api/insights`);
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

  const fetchBudgets = async () => {
    try {
      setBudgetLoading(true);
      const res = await axios.get(`${API}/api/budgets`);
      setBudgets(res.data);
    } catch (e) { console.error('Failed to fetch budgets:', e); }
    finally { setBudgetLoading(false); }
  };

  const createBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.category || !budgetForm.amount) return;
    try {
      await axios.post(`${API}/api/budgets`, {
        category: budgetForm.category,
        amount: parseFloat(budgetForm.amount),
        period: budgetForm.period
      });
      setBudgetForm({ category: '', amount: '', period: 'monthly' });
      await fetchBudgets();
    } catch (e) { alert('Failed to create budget'); }
  };

  const deleteBudget = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await axios.delete(`${API}/api/budgets/${id}`);
      await fetchBudgets();
    } catch (e) { alert('Failed to delete budget'); }
  };

  const fetchRecurring = async () => {
    try {
      setRecurringLoading(true);
      const res = await axios.get(`${API}/api/recurring`);
      setRecurringItems(res.data);
    } catch (e) { console.error('Failed to fetch recurring:', e); }
    finally { setRecurringLoading(false); }
  };

  const createRecurring = async (e) => {
    e.preventDefault();
    if (!recurringForm.title || !recurringForm.amount || !recurringForm.category) {
      alert("Please fill in all required fields including Category.");
      return;
    }
    try {
      await axios.post(`${API}/api/recurring`, {
        ...recurringForm,
        amount: parseFloat(recurringForm.amount)
      });
      setRecurringForm({ title: '', amount: '', category: '', frequency: 'monthly', next_date: new Date().toISOString().split('T')[0], description: '', is_active: true });
      setShowAddRecurring(false);
      await fetchRecurring();
      await fetchExpenses();
    } catch (e) { alert('Failed to create recurring expense'); }
  };

  const deleteRecurring = async (id) => {
    if (!window.confirm('Delete this recurring expense?')) return;
    try {
      await axios.delete(`${API}/api/recurring/${id}`);
      await fetchRecurring();
    } catch (e) { alert('Failed to delete recurring expense'); }
  };

  const toggleRecurring = async (id) => {
    try {
      const res = await axios.patch(`${API}/api/recurring/${id}`);
      setRecurringItems(prev => prev.map(r => r.id === id ? { ...r, is_active: res.data.is_active } : r));
    } catch (e) { alert('Failed to toggle recurring expense'); }
  };

  const fetchGoals = async () => {
    try {
      setGoalsLoading(true);
      const res = await axios.get(`${API}/api/goals`);
      setGoals(res.data);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setGoalsLoading(false);
    }
  };

  const createGoal = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/goals`, goalForm);
      setGoalForm({ title: '', target_amount: '', target_date: '', color: 'indigo', icon: '💰' });
      setShowAddGoal(false);
      fetchGoals();
    } catch (error) {
      alert('Failed to create goal');
    }
  };

  const contributeToGoal = async (e) => {
    e.preventDefault();
    if (!contributionForm.goalId || !contributionForm.amount) return;
    try {
      await axios.post(`${API}/api/goals/${contributionForm.goalId}/contribute`, { amount: contributionForm.amount });
      setContributionForm({ goalId: null, amount: '' });
      fetchGoals();
      if (activeTab === 'user-dashboard') fetchUserDashboard();
    } catch (error) {
      alert('Failed to contribute');
    }
  };

  const deleteGoal = async (id) => {
    if(!window.confirm('Are you sure you want to delete this goal?')) return;
    try {
      await axios.delete(`${API}/api/goals/${id}`);
      fetchGoals();
    } catch (error) {
      console.error('Failed to delete goal', error);
    }
  };

  const fetchForecast = async () => {
    try {
      setLoadingForecast(true);
      const res = await axios.get(`${API}/api/ai/forecast`);
      if (res.data.success) setForecast(res.data.forecast);
    } catch (e) { console.error('Failed to fetch forecast:', e); }
    finally { setLoadingForecast(false); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem('token');
    const a = document.createElement('a');
    a.href = `${API}/api/expenses/export`;
    a.setAttribute('download', 'rupeeflow_expenses.csv');
    // Add auth header via fetch and create object URL
    fetch(`${API}/api/expenses/export`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
  };

  const exportPDF = () => {
    const token = localStorage.getItem('token');
    const a = document.createElement('a');
    a.href = `${API}/api/expenses/pdf`;
    a.setAttribute('download', `rupeeflow_report_${new Date().toISOString().split('T')[0]}.pdf`);
    fetch(`${API}/api/expenses/pdf`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
  };

  const fetchUserDashboard = async () => {
    try {
      setLoadingUserDashboard(true);
      console.log('Fetching user dashboard data...');
      const response = await axios.get(`${API}/api/user/dashboard`);
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
      
      const payload = {
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        category: expenseForm.category || 'Other',
        date: expenseForm.date,
        merchant: expenseForm.merchant,
        notes: expenseForm.notes,
        original_currency: expenseForm.original_currency || 'INR',
        original_amount: expenseForm.amount
      };

      if (expenseForm.group_id) {
        // Post to shared wallet
        await axios.post(`${API}/groups/${expenseForm.group_id}/expenses`, payload);
        await fetchGroupExpenses(expenseForm.group_id);
        setActiveTab('groups');
      } else {
        // Post to personal account
        await axios.post(`${API}/api/expenses`, {
          ...payload,
          title: expenseForm.description // Legacy field name for backward compatibility
        });
        setActiveTab('expenses');
      }
      
      // Reset form
      setExpenseForm({
        amount: '',
        description: '',
        category: '',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        original_currency: 'INR',
        original_amount: '',
        group_id: ''
      });
      
      // Refresh personal data
      await Promise.all([
        fetchExpenses(),
        fetchAnalytics(),
        fetchInsights(),
        fetchUserDashboard()
      ]);
      
    } catch (error) {
      console.error('Failed to create expense:', error);
      alert('Failed to create expense. ' + (error.response?.data?.detail || 'Please try again.'));
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
      
      const response = await axios.post(`${API}/api/expenses/receipt`, formData, {
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
    console.log('API URL:', `${API}/api/expenses/${expenseId}`);
    console.log('Current expenses count:', (expenses || []).length);
    
    try {
      const response = await axios.delete(`${API}/api/expenses/${expenseId}`);
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

      // Try advanced AI assistant first
      try {
        const response = await axios.post(`${API}/api/ai-assistant/chat`, {
          query: question
        });
        
        const aiResponse = response.data;
        // append bot message with AI response and structured data
        setChatMessages(prev => [...prev, { 
          role: 'bot', 
          text: aiResponse.answer, 
          data: aiResponse.data || null,
          isAI: aiResponse.is_ai_response || false
        }]);
        return aiResponse;
      } catch (aiError) {
        console.log('AI assistant failed, falling back to basic analysis:', aiError);
        
        // Fallback to simple client-side expense analysis
        const response = analyzeExpenseQuestion(question);
        
        // append bot message with optional structured data
        setChatMessages(prev => [...prev, { 
          role: 'bot', 
          text: response.answer, 
          data: response.data || null,
          isAI: false
        }]);
        return response;
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error. Please try again.' }]);
      throw err;
    } finally {
      setChatLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const response = await axios.get(`${API}/api/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  const createGroup = async (name, description) => {
    try {
      const response = await axios.post(`${API}/api/groups`, { name, description });
      await fetchGroups();
      setSelectedGroup(response.data);
      return response.data;
    } catch (error) {
      console.error('Create group failed:', error);
      alert('Failed to create group: ' + (error.response?.data?.detail || error.message));
    }
  };

  const joinGroup = async (code) => {
    if (!code.trim()) return;
    try {
      const response = await axios.post(`${API}/api/groups/join`, { invite_code: code.trim() });
      await fetchGroups();
      setGroupInviteCode('');
      setSelectedGroup(response.data);
      return response.data;
    } catch (error) {
      console.error('Join group failed:', error);
      alert(error.response?.data?.detail || 'Invalid invite code. Please try again.');
    }
  };

  const fetchGroupExpenses = async (groupId) => {
    try {
      const [expensesRes, settlementsRes] = await Promise.all([
        axios.get(`${API}/api/groups/${groupId}/expenses`),
        axios.get(`${API}/api/groups/${groupId}/settlements`)
      ]);
      setGroupExpenses(expensesRes.data);
      setGroupSettlements(settlementsRes.data);
    } catch (error) {
      console.error('Failed to fetch group expenses/settlements:', error);
      setGroupExpenses([]);
      setGroupSettlements([]);
    }
  };

  const submitGroupBill = async (e) => {
    e.preventDefault();
    if (!groupBillForm.description || !groupBillForm.amount || !selectedGroup) return;
    try {
      await axios.post(`${API}/api/groups/${selectedGroup.id}/expenses`, {
        // Required fields for ExpenseCreate schema
        title: groupBillForm.description,
        user_id: user?.id || 'dev-user',
        // Form fields
        amount: parseFloat(groupBillForm.amount),
        description: groupBillForm.description,
        category: groupBillForm.category || 'Shared',
        date: new Date().toISOString().split('T')[0],
        original_currency: 'INR',
        original_amount: parseFloat(groupBillForm.amount),
        exchange_rate: 1.0,
      });
      setGroupBillForm({ description: '', amount: '', category: 'Shared' });
      setShowAddBill(false);
      await fetchGroupExpenses(selectedGroup.id);
    } catch (error) {
      console.error('Failed to add group bill:', error);
      // Show detailed validation error if available
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => `${d.loc?.join('.')}: ${d.msg}`).join('\n')
        : (detail || error.message);
      alert('Failed to add bill:\n' + msg);
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

  const formatCurrency = (amount, currencyCode = selectedCurrency) => {
    // If we're formatting for a specific currency, we MUST convert the base (INR) amount first
    const converted = convertAmount(amount, currencyCode);
    
    let locale = 'en-IN';
    if (currencyCode === 'USD' || currencyCode === 'CAD' || currencyCode === 'AUD') locale = 'en-US';
    if (currencyCode === 'EUR') locale = 'de-DE';
    if (currencyCode === 'GBP') locale = 'en-GB';
    if (currencyCode === 'JPY') locale = 'ja-JP';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currencyCode === 'JPY' ? 0 : 2
    }).format(converted);
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
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans antialiased">
      {/* Left Sidebar — Neo-brutalism */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 bg-white border-r-2 border-black transition-[width] duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-0 border-r-0'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b-2 border-black flex-shrink-0 bg-black min-w-[256px]">
          <div className="w-10 h-10 flex-shrink-0 mr-3 overflow-hidden">
            <img
              src="/logo.png"
              alt="RupeeFlow Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-black text-white tracking-tight leading-tight uppercase">RupeeFlow</h1>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Expense Tracker</p>
          </div>
          {/* Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-2 w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-yellow-300 hover:text-black text-white transition-colors duration-150 flex-shrink-0"
            title="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto py-3 no-scrollbar">
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
                id: 'groups', 
                name: 'Shared Wallets', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              },
              { 
                id: 'assistant', 
                name: 'Assistant', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              },
              { 
                id: 'analytics', 
                name: 'Analytics', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              },
              { 
                id: 'budgets', 
                name: 'Budgets', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              },
              { 
                id: 'recurring', 
                name: 'Recurring', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              },
              { 
                id: 'goals', 
                name: 'Goals', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              },
              { 
                id: 'predictions', 
                name: 'Predictions', 
                icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 font-black text-[11px] uppercase tracking-widest transition-all duration-150 relative ${
                activeTab === tab.id
                  ? 'bg-black text-yellow-300 border-l-4 border-yellow-300 pl-3'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-black border-l-4 border-transparent'
              }`}
            >
              <div className={activeTab === tab.id ? 'text-yellow-300' : 'text-gray-400'}>{tab.icon}</div>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <div className="p-4 border-t-2 border-black">
          <button onClick={logout} className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-white text-black border-2 border-black font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:shadow-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 relative">
        {/* Floating sidebar open button — shown when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden lg:flex fixed top-3 left-3 z-50 w-10 h-10 bg-black text-yellow-300 border-2 border-black items-center justify-center shadow-[3px_3px_0_0_rgba(0,0,0,0.3)] hover:bg-yellow-300 hover:text-black transition-colors duration-150"
            title="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <header className="lg:hidden bg-white shadow-sm border-b border-gray-200 z-10 p-2">
          <div className="flex space-x-4 overflow-x-auto no-scrollbar items-center pb-1 px-2">
            {[
              { id: 'user-dashboard', name: 'Profile' },
              { id: 'dashboard', name: 'Dashboard' },
              { id: 'add-expense', name: 'Add Expense' },
              { id: 'receipt-scan', name: 'Scan Receipt' },
              { id: 'groups', name: 'Wallets' },
              { id: 'assistant', name: 'Assistant' },
              { id: 'analytics', name: 'Analytics' },
              { id: 'budgets', name: 'Budgets' },
              { id: 'recurring', name: 'Recurring' },
              { id: 'goals', name: 'Goals' },
              { id: 'predictions', name: 'Predictions' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest transition-colors ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto pb-40">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-[slideDown_0.3s_ease-out]">
              <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0_0_rgba(99,102,241,1)]">
                  <svg className="w-8 h-8 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black text-black uppercase tracking-tight">Financial Insights</h2>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Real-time analysis in {selectedCurrency}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-1 bg-gray-100 p-1.5 border-2 border-black">
                {supportedCurrencies.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedCurrency(c)}
                    className={`px-3 py-1.5 text-xs font-black transition-all duration-150 border-2 ${
                      selectedCurrency === c 
                      ? 'bg-black text-yellow-300 border-black shadow-[2px_2px_0_0_rgba(99,102,241,1)]' 
                      : 'text-gray-500 border-transparent hover:border-black hover:bg-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Expense Statistics — Neo-brutalism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Expenses</p>
                    <p className="text-3xl font-black text-black">{(expenses || []).length}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tight">All time transactions</p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-300 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-black border-2 border-black shadow-[4px_4px_0_0_rgba(99,102,241,1)] p-6 hover:shadow-[6px_6px_0_0_rgba(99,102,241,1)] hover:-translate-y-0.5 transition-all duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Amount</p>
                    <p className="text-3xl font-black text-white">
                      {formatCurrency(getTotalExpenses())}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-tight">
                      Converted from INR
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-500 border-2 border-indigo-300 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Active Categories</p>
                    <p className="text-3xl font-black text-black">
                      {Object.keys(getCategoryTotals()).length}
                    </p>
                    <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tight">Expense categories used</p>
                  </div>
                  <div className="w-12 h-12 bg-green-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                    <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Shared Wallets Summary Widget */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] overflow-hidden">
              <div className="bg-black px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-widest">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  My Shared Wallets
                </h3>
                <button 
                   onClick={() => setActiveTab('groups')}
                   className="text-[10px] font-black text-yellow-300 hover:text-white uppercase tracking-tighter transition-colors border border-yellow-300 hover:border-white px-2 py-1"
                >
                  Manage All →
                </button>
              </div>
              <div className="p-6">
                {(groups || []).length === 0 ? (
                  <div className="text-center py-6">
                     <p className="text-xs text-gray-500 font-medium italic">No active shared wallets. Split bills effortlessly by creating one!</p>
                <button 
                        onClick={() => setActiveTab('groups')}
                        className="mt-3 px-4 py-2 bg-yellow-300 text-black border-2 border-black text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                     >
                       + Create Wallet
                     </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(groups || []).slice(0, 3).map(group => (
                      <div key={group.id} className="p-4 bg-gray-50 border-2 border-black flex items-center justify-between shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-yellow-300 border-2 border-black flex items-center justify-center font-black text-xs text-black">
                               {group.name?.substring(0, 2).toUpperCase() || 'SW'}
                            </div>
                            <div>
                               <p className="text-sm font-black text-gray-900">{group.name}</p>
                               <p className="text-[10px] text-gray-500 font-bold uppercase">{(group.members || []).length} members</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter">Code</p>
                            <p className="text-xs font-black text-indigo-600 select-all cursor-pointer">{group.invite_code}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
              <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500 border-2 border-black flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                </div>
                <h3 className="text-sm font-black text-black uppercase tracking-widest">Spending by Category</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(getCategoryTotals()).sort(([,a], [,b]) => b - a).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="#000"
                          strokeWidth={2}
                        >
                          {Object.entries(getCategoryTotals()).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[
                              '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
                              '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
                            ][index % 10]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [formatCurrency(value), 'Total']}
                          contentStyle={{ borderRadius: '0', border: '2px solid black', boxShadow: '4px 4px 0 0 rgba(0,0,0,1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(getCategoryTotals()).sort(([,a], [,b]) => b - a).slice(0, 5).map(([category, total], index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-yellow-50 border border-transparent hover:border-black transition-all">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 border border-black" style={{ backgroundColor: [
                            '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
                            '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
                          ][index % 10] }}></div>
                          <span className="text-xs font-bold text-gray-700">{category}</span>
                        </div>
                        <span className="text-xs font-black text-black">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
              <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3">
                <div className="w-8 h-8 bg-green-400 border-2 border-black flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-black text-black uppercase tracking-widest">Recent Expenses</h3>
              </div>
              <div className="divide-y-2 divide-black">
                {(expenses || []).slice(0, 5).map(expense => (
                  <div 
                    key={expense.id} 
                    className="px-6 py-4 flex items-center justify-between hover:bg-yellow-50 cursor-pointer transition-colors duration-150"
                    onClick={() => openExpenseDetails(expense)}
                    title="Click to view full details"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 border-2 border-black flex items-center justify-center">
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
                        <div className="flex items-center">
                          <p className="text-sm font-black text-black">{expense.description}</p>
                          {expense.is_anomaly && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">
                              ANOMALY
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-tight">{expense.category} · {expense.date}</p>
                        {expense.items && expense.items.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">📦 {expense.items.length} items</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-black">
                        {formatCurrency(expense.amount)}
                      </p>
                      {expense.ai_categorized && (
                        <p className="text-[10px] font-black text-indigo-600 uppercase">AI categorized</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            {insights && insights.length > 0 && (
              <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-300 border-2 border-black flex items-center justify-center">
                    <span className="text-sm">💡</span>
                  </div>
                  <h3 className="text-sm font-black text-black uppercase tracking-widest">AI Insights</h3>
                </div>
                <div className="p-6 space-y-3">
                  {(insights || []).map((insight, index) => (
                    <div key={index} className={`p-4 border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] ${
                      insight.type === 'overspending' ? 'bg-red-50' :
                      insight.type === 'suggestion' ? 'bg-green-50' :
                      'bg-blue-50'
                    }`}>
                      <h4 className="font-black text-black text-sm">{insight.title}</h4>
                      <p className="text-xs font-medium text-gray-600 mt-1">{insight.description}</p>
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
                <div className="bg-black border-2 border-black shadow-[4px_4px_0_0_rgba(99,102,241,1)] p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="w-20 h-20 bg-yellow-300 border-2 border-yellow-300 flex items-center justify-center shadow-[3px_3px_0_0_rgba(99,102,241,1)]">
                        <span className="text-3xl text-black font-black">
                          {userDashboard?.user_info?.full_name ? userDashboard.user_info.full_name.charAt(0).toUpperCase() : '👤'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{userDashboard?.user_info?.full_name || 'User'}</h2>
                        <p className="text-gray-400 font-bold text-sm">{userDashboard?.user_info?.email || 'No email'}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Member since {userDashboard?.account_info?.member_since ? new Date(userDashboard.account_info.member_since).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={logout}
                        className="px-4 py-2 text-sm font-black text-black bg-red-400 border-2 border-red-400 hover:bg-red-300 transition-colors shadow-[2px_2px_0_0_rgba(255,255,255,0.3)] uppercase tracking-widest"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expense Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:-translate-y-0.5 transition-all duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Spent</p>
                        <p className="text-2xl font-black text-black">
                          {formatCurrency(userDashboard?.expense_statistics?.total_spent || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-red-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                        <span className="text-xl">💰</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:-translate-y-0.5 transition-all duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Expenses</p>
                        <p className="text-2xl font-black text-black">
                          {userDashboard?.expense_statistics?.total_transactions || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                        <span className="text-xl">📝</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:-translate-y-0.5 transition-all duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Avg per Expense</p>
                        <p className="text-2xl font-black text-black">
                          {formatCurrency(userDashboard?.expense_statistics?.average_per_transaction || 0)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                        <span className="text-xl">📊</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black border-2 border-black shadow-[4px_4px_0_0_rgba(99,102,241,1)] p-6 hover:-translate-y-0.5 transition-all duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monthly Average</p>
                        <p className="text-2xl font-black text-white">
                          {formatCurrency((userDashboard?.expense_statistics?.total_spent || 0) / Math.max((userDashboard?.monthly_trend || []).length, 1))}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-indigo-500 border-2 border-indigo-300 flex items-center justify-center">
                        <span className="text-xl">📅</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                  <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500 border-2 border-black flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                    </div>
                    <h3 className="text-sm font-black text-black uppercase tracking-widest">Category Breakdown</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {(userDashboard?.category_breakdown || []).map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-2 hover:bg-yellow-50 border border-transparent hover:border-black transition-all">
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
                              <p className="text-sm font-black text-black">{category.category}</p>
                              <div className="w-48 bg-gray-200 h-2 mt-1 border border-gray-300">
                                <div
                                  className="bg-black h-2"
                                  style={{ width: `${category.percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-black">
                              {formatCurrency(category.total)}
                            </p>
                            <p className="text-xs font-bold text-gray-500 uppercase">
                              {category.percentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Expenses */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                  <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-400 border-2 border-black flex items-center justify-center">
                      <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-black text-black uppercase tracking-widest">Recent Expenses</h3>
                  </div>
                  <div className="divide-y-2 divide-black">
                    {(userDashboard?.recent_expenses || []).map(expense => (
                      <div 
                        key={expense.id} 
                        className="px-6 py-4 flex items-center justify-between hover:bg-yellow-50 cursor-pointer transition-colors"
                        onClick={() => openExpenseDetails(expense)}
                        title="Click to view full details"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-100 border-2 border-black flex items-center justify-center">
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
                            <p className="text-sm font-black text-black">{expense.description}</p>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-tight">{expense.category} · {expense.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-black">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                  {/* Monthly Trends */}
                  <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] overflow-hidden">
                    <div className="px-6 py-4 border-b-2 border-black flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-yellow-300 border-2 border-black flex items-center justify-center text-sm">📈</div>
                        <h3 className="text-sm font-black text-black uppercase tracking-widest">Monthly Trends</h3>
                      </div>
                      {userDashboard?.monthly_trend?.length > 0 && (
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest border border-black px-2 py-0.5">
                          {userDashboard.monthly_trend.length} month{userDashboard.monthly_trend.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="p-6">
                      {(!userDashboard?.monthly_trend || userDashboard.monthly_trend.length === 0) ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-2">
                          <span className="text-4xl">📊</span>
                          <p className="text-sm font-bold text-gray-400">No data yet — add expenses to see trends</p>
                        </div>
                      ) : (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={userDashboard.monthly_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="35%">
                              <defs>
                                <linearGradient id="barGradDash" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                                  <stop offset="100%" stopColor="#4338ca" stopOpacity={0.8}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="month"
                                tickFormatter={m => { try { return new Date(m+'-01').toLocaleDateString('en-US',{month:'short',year:'2-digit'}); } catch(e){return m;} }}
                                axisLine={false} tickLine={false}
                                tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                              />
                              <YAxis
                                axisLine={false} tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                tickFormatter={v => getCurrencySymbol(selectedCurrency) + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)}
                                width={45}
                              />
                              <Tooltip
                                cursor={{ fill: '#f8faff', rx: 8 }}
                                formatter={v => [formatCurrency(v), 'Spent']}
                                labelFormatter={m => { try { return new Date(m+'-01').toLocaleDateString('en-US',{month:'long',year:'numeric'}); } catch(e){return m;} }}
                                contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15)', padding: '12px 16px' }}
                                labelStyle={{ fontWeight: 900, fontSize: '11px', color: '#4338ca', marginBottom: '4px' }}
                                itemStyle={{ fontWeight: 700, fontSize: '12px', color: '#1e293b' }}
                              />
                              <Bar dataKey="total" fill="url(#barGradDash)" radius={[6,6,0,0]} maxBarSize={56} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      )}
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
          <div className="max-w-3xl mx-auto py-12 px-4">
            <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] rounded-none">
              <div className="px-8 py-6 border-b-2 border-black">
                <h3 className="text-2xl font-black text-black tracking-tight">Add New Expense</h3>
                <p className="text-sm font-medium text-gray-600 mt-1">Enter expense details manually</p>
              </div>
              
              <form onSubmit={handleSubmitExpense} className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Amount *
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={expenseForm.original_currency}
                        onChange={(e) => setExpenseForm(prev => ({...prev, original_currency: e.target.value}))}
                        className="w-24 px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                      >
                        {supportedCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm(prev => ({...prev, amount: e.target.value}))}
                        className="flex-1 px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                        placeholder="0.00"
                      />
                    </div>
                    {expenseForm.original_currency !== 'INR' && exchangeRates[expenseForm.original_currency] && (
                      <p className="mt-2 text-xs font-bold text-gray-500">
                        ≈ ₹{((expenseForm.amount || 0) / (exchangeRates[expenseForm.original_currency] || 1)).toFixed(2)} at current rate
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm(prev => ({...prev, date: e.target.value}))}
                      className="w-full px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({...prev, description: e.target.value}))}
                    className="w-full px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                    placeholder="What did you spend money on? (e.g., Zomato order, auto fare, grocery shopping)"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Category
                    </label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm(prev => ({...prev, category: e.target.value}))}
                      className="w-full px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                    >
                      <option value="">AI will categorize</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">
                      Merchant
                    </label>
                    <input
                      type="text"
                      value={expenseForm.merchant}
                      onChange={(e) => setExpenseForm(prev => ({...prev, merchant: e.target.value}))}
                      className="w-full px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                      placeholder="Store or company name"
                    />
                  </div>
                </div>

                {groups.length > 0 && (
                  <div className="bg-[#f0f4ff] p-6 border-y-2 border-dashed border-[#c3d4ff] -mx-8 px-8 my-6">
                    <label className="block text-sm font-bold text-[#1e3a8a] mb-2">
                       Post to Shared Wallet?
                    </label>
                    <select
                      value={expenseForm.group_id}
                      onChange={(e) => setExpenseForm(prev => ({...prev, group_id: e.target.value}))}
                      className="w-full px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold bg-white"
                    >
                      <option value="">No, keep this private</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} (Shared)</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs font-semibold text-[#3b82f6]">
                      {expenseForm.group_id ? 'This will be visible to all wallet members and split equally.' : 'This expense will remain private to your account.'}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Notes
                  </label>
                  <textarea
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm(prev => ({...prev, notes: e.target.value}))}
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-0 focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all font-semibold"
                    placeholder="Additional notes (optional)"
                  />
                </div>
                
                <div className="flex justify-end space-x-4 pt-4 border-t-2 border-dashed border-gray-200 mt-6">
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
                    className="px-6 py-2.5 text-sm font-bold text-black bg-white border-2 border-black hover:bg-gray-100 hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:outline-none transition-all focus:-translate-y-px"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 text-sm font-bold text-black bg-[#FFD700] hover:bg-[#F2C900] border-2 border-transparent hover:border-black hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:outline-none transition-all disabled:opacity-50"
                  >
                    {loading ? 'Adding...' : 'Add Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'receipt-scan' && (
          <div className="max-w-3xl mx-auto py-12 px-4">
            <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] rounded-none">
              <div className="px-8 py-6 border-b-2 border-black flex gap-3 items-center">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <div>
                  <h3 className="text-2xl font-black text-black tracking-tight">Scan Bill/Receipt</h3>
                  <p className="text-sm font-medium text-gray-600 mt-1">Upload your Indian bill/receipt and let AI extract expense details automatically</p>
                </div>
              </div>
              
              <form onSubmit={handleReceiptUpload} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-black mb-2">
                    Bill/Receipt Image *
                  </label>
                  <div className={"mt-1 flex justify-center px-6 pt-10 pb-12 border-2 border-black " + (receiptFile ? "border-solid bg-[#f0f9ff]" : "border-dashed bg-[#fafafa]") + " hover:border-blue-500 transition-colors cursor-pointer group"} onClick={() => document.getElementById('receipt-upload')?.click()}>
                    <div className="space-y-2 text-center">
                      <svg className="mx-auto h-12 w-12 text-black group-hover:text-blue-500 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 4v10m0-10l-4 4m4-4l4 4m-8 6h8" />
                        <rect x="3" y="3" width="18" height="18" rx="0" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <div className="text-sm text-black font-semibold mt-4">
                        <span className="text-[#FFD700] underline underline-offset-4 font-bold decoration-black group-hover:text-blue-600">Upload your bill/receipt</span>
                        <span className="text-gray-600 ml-1">or drag and drop</span>
                        <input 
                          id="receipt-upload" 
                          name="receipt-upload" 
                          type="file" 
                          accept="image/*" 
                          className="sr-only"
                          onChange={(e) => setReceiptFile(e.target.files[0])}
                        />
                      </div>
                      <p className="text-xs text-gray-500 font-medium pt-1">PNG, JPG, GIF up to 10MB</p>
                      {receiptFile && (
                        <div className="mt-4 bg-white border border-black py-2 px-4 shadow-[2px_2px_0_0_rgba(0,0,0,1)] inline-block">
                          <p className="text-sm text-black font-bold flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeJoin="miter" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            {receiptFile.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-4 border-t-2 border-dashed border-gray-200 mt-6">
                  <button
                    type="submit"
                    disabled={!receiptFile || processingReceipt}
                    className="px-8 py-3 text-sm font-bold text-black bg-[#FFD700] hover:bg-[#F2C900] border-2 border-transparent hover:border-black hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:outline-none transition-all disabled:opacity-50 disabled:grayscale"
                  >
                    {processingReceipt ? 'Processing...' : 'Process Receipt'}
                  </button>
                </div>
              </form>
              
              {extractedData && (
                <div className="px-8 pb-8">
                  <div className="bg-green-50 border-2 border-black rounded-none shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6">
                    <h4 className="text-lg font-black text-black mb-4 flex items-center gap-2">
                      <span className="text-green-500">✅</span> Extracted Data
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm text-black font-medium">
                      <div className="bg-white border border-gray-200 p-3"><span className="text-gray-500 font-bold block text-xs mb-1">Amount</span> {extractedData.amount ? formatCurrency(extractedData.amount) : 'Not found'}</div>
                      <div className="bg-white border border-gray-200 p-3"><span className="text-gray-500 font-bold block text-xs mb-1">Date</span> {extractedData.date || 'Not found'}</div>
                      <div className="bg-white border border-gray-200 p-3 col-span-2"><span className="text-gray-500 font-bold block text-xs mb-1">Merchant</span> {extractedData.merchant || 'Not found'}</div>
                      <div className="bg-white border border-gray-200 p-3"><span className="text-gray-500 font-bold block text-xs mb-1">Description</span> {extractedData.description || 'Not found'}</div>
                      <div className="bg-white border border-gray-200 p-3"><span className="text-gray-500 font-bold block text-xs mb-1">Category</span> <span className="inline-block bg-[#FFD700] px-2 py-0.5 border border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)] text-xs font-bold">{extractedData.category || 'Not found'}</span></div>
                    </div>

                    {/* Show per-item prices when available */}
                    {extractedData.items && extractedData.items.length > 0 && (
                      <div className="mt-6">
                        <p className="font-bold text-black mb-2 flex items-center gap-2">📦 Receipt Items <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">{extractedData.items.length}</span></p>
                        <div className="border border-black bg-white overflow-hidden">
                          <ul className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
                            {(extractedData.items || []).map((it, idx) => (
                              <li key={idx} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                                <span className="font-medium text-black text-sm">{it.quantity > 1 && <span className="text-gray-500 mr-2">{it.quantity}x</span>}{it.name || 'Item'}</span>
                                <span className="font-bold text-black text-sm">{formatCurrency(Number(it.amount || 0))}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {extractedData.receipt_url && (
                      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                        <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                          Receipt saved securely
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="bg-[#f0f9ff] border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] flex flex-col h-[600px] rounded-none animate-fadeIn max-w-5xl mx-auto">
            <div className="px-6 py-5 border-b-2 border-black flex items-center justify-between bg-white">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-[#FFD700] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center text-black">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-black tracking-tight uppercase">RupeeFlow AI Assistant</h3>
                  <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">Advanced Finance Intelligence</p>
                </div>
              </div>
              <button 
                onClick={() => setChatMessages([{ role: 'bot', text: "Hello! I'm your AI finance assistant. Ask me anything about your spending." }])}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-black border-2 border-black bg-white hover:bg-gray-100 shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:translate-y-px uppercase tracking-widest transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-black space-y-6">
                  <div className="w-24 h-24 bg-gray-50 flex items-center justify-center border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                    <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl tracking-tighter text-black font-black uppercase mb-2">How can I help today?</p>
                    <p className="text-sm font-bold text-gray-600 max-w-sm mx-auto leading-relaxed">Analyze spending, check budgets, or predict future trends with AI.</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((m, index) => (
                  <div key={index} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div className={`flex max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'} items-start space-x-4`}>
                      <div className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 ${
                        m.role === 'user' ? 'bg-[#4f46e5] text-white' : 'bg-[#FFD700] text-black'
                      }`}>
                        {m.role === 'user' ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className={`p-5 text-sm font-bold border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] leading-relaxed ${
                          m.role === 'user' ? 'bg-[#4f46e5] text-white' : 'bg-white text-black'
                        }`}>
                          <div className="whitespace-pre-wrap">{m.text}</div>
                          {m.role === 'bot' && m.isAI && (
                            <div className="mt-4 flex items-center">
                              <span className="inline-flex items-center px-2 py-1 text-[10px] font-black bg-blue-50 text-blue-700 uppercase tracking-widest border border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)]">
                                <span className="mr-2">✨</span> AI Powered
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Render structured data returned by bot */}
                        {m.role === 'bot' && m.data && (
                          <div className="mt-4 text-left bg-white border-2 border-black p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                            {m.data.total !== undefined && (
                              <div className="mb-5">
                                <p className="text-[10px] uppercase font-black text-black tracking-widest mb-2 flex items-center gap-2 border-b-2 border-black pb-1 inline-flex">
                                  <span className="w-2 h-2 bg-[#FFD700] border border-black"></span>
                                  Calculated Total
                                </p>
                                <p className="text-4xl font-black text-black block">{formatCurrency(Number(m.data.total || 0))}</p>
                              </div>
                            )}

                            {m.data.expenses && Array.isArray(m.data.expenses) && m.data.expenses.length > 0 && (
                              <div className="mt-4 text-left">
                                <p className="text-[10px] uppercase font-black text-black tracking-widest mb-3 flex items-center gap-2 border-b-2 border-black pb-1 inline-flex">
                                  <span className="w-2 h-2 bg-blue-500 border border-black"></span>
                                  Recent Matches
                                </p>
                                <div className="space-y-3">
                                  {(m.data.expenses || []).slice(0, 5).map((ex, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white border-2 border-black hover:-translate-y-1 hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all text-sm group">
                                      <div className="flex items-center space-x-3 truncate">
                                        <span className="w-2 h-2 bg-black flex-shrink-0"></span>
                                        <div className="truncate">
                                          <p className="text-black font-black uppercase truncate">{ex.description}</p>
                                          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">{ex.category} • {ex.date}</p>
                                        </div>
                                      </div>
                                      <span className="font-black text-black pl-3">{formatCurrency(Number(ex.amount || 0))}</span>
                                    </div>
                                  ))}
                                </div>
                                {m.data.expenses.length > 5 && (
                                  <button 
                                    onClick={() => setActiveTab('expenses')}
                                    className="w-full text-center mt-4 p-3 text-xs bg-[#FFD700] text-black font-black hover:bg-[#F2C900] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] uppercase tracking-widest transition-all active:translate-y-px"
                                  >
                                    VIEW ALL {m.data.expenses.length} TRANSACTIONS →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center text-black">
                      <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </div>
                    <div className="bg-white p-5 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-sm text-black flex items-center space-x-3 font-bold uppercase tracking-widest">
                      <div className="flex space-x-1.5">
                        <span className="w-2 h-2 bg-black block animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-black block animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-black block animate-bounce"></span>
                      </div>
                      <span className="ml-3">Assistant is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t-2 border-black p-6">
              <form 
                onSubmit={async (e) => { 
                  e.preventDefault(); 
                  if (!chatInput || chatLoading) return; 
                  const input = chatInput;
                  setChatInput(''); 
                  await sendChatQuestion(input); 
                }} 
                className="flex items-center gap-3"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="ASK ABOUT SPENDING, BUDGETS, OR FORECAST..."
                    disabled={chatLoading}
                    className="w-full px-5 py-4 bg-white border-2 border-black font-bold outline-none focus:shadow-[4px_4px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all placeholder:text-gray-400 placeholder:font-black text-sm"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={chatLoading || !chatInput} 
                  className="w-14 h-[54px] flex items-center justify-center bg-[#FFD700] text-black border-2 border-black disabled:bg-gray-100 disabled:opacity-50 transition-all shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] active:translate-y-px active:shadow-[2px_2px_0_0_rgba(0,0,0,1)] shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </form>
              <div className="flex gap-3 mt-4 overflow-x-auto no-scrollbar pb-2">
                {['Total spent today', 'Food expenses', 'Budget status'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setChatInput(suggestion)}
                    className="whitespace-nowrap px-4 py-2 bg-white border-2 border-black text-[10px] font-black uppercase tracking-widest text-black hover:bg-black hover:text-[#FFD700] transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:translate-y-px"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}



        {activeTab === 'analytics' && (() => {
          // Compute monthly trend from raw expenses (works without userDashboard)
          const monthlyMap = {};
          (expenses || []).forEach(exp => {
            const month = (exp.date || '').substring(0, 7);
            if (!month) return;
            if (!monthlyMap[month]) monthlyMap[month] = { month, total: 0, count: 0 };
            monthlyMap[month].total += (exp.amount || 0);
            monthlyMap[month].count += 1;
          });
          const monthlyTrend = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));

          const PALETTE = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1'];
          const categoryData = Object.entries(getCategoryTotals())
            .sort(([,a],[,b]) => b - a)
            .map(([name, value]) => ({ name, value }));

          const totalSpent = (expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
          const avgTx = expenses.length > 0 ? totalSpent / expenses.length : 0;
          const topCat = categoryData[0]?.name || '—';
          const thisMonthKey = new Date().toISOString().substring(0, 7);
          const thisMonth = monthlyMap[thisMonthKey]?.total || 0;

          return (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Spent', value: formatCurrency(totalSpent), icon: '💸', bg: '#FFD700', text: 'text-black' },
                { label: 'This Month', value: formatCurrency(thisMonth), icon: '📅', bg: '#4f46e5', text: 'text-white' },
                { label: 'Avg Transaction', value: formatCurrency(avgTx), icon: '📊', bg: '#10b981', text: 'text-black' },
                { label: 'Top Category', value: topCat, icon: '🏆', bg: '#f472b6', text: 'text-black' },
              ].map(kpi => (
                <div key={kpi.label} className={`rounded-none border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-5 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all flex flex-col justify-between`} style={{backgroundColor: kpi.bg}}>
                  <div className={`flex items-center gap-3 mb-4 ${kpi.text}`}>
                    <span className="text-2xl bg-white/20 p-2 border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)]">{kpi.icon}</span>
                    <p className="text-xs font-black uppercase tracking-widest leading-tight">{kpi.label}</p>
                  </div>
                  <p className={`text-2xl lg:text-3xl font-black truncate ${kpi.text}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trend AreaChart - built from local data */}
              <div className="bg-white rounded-none border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3 bg-[#f0f9ff]">
                  <span className="w-10 h-10 bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center text-lg">📈</span>
                  <h3 className="text-xl font-black text-black tracking-tight">Monthly Spending</h3>
                </div>
                <div className="p-6">
                  {monthlyTrend.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center">
                      <p className="text-gray-400 text-sm italic">Add expenses to see trends</p>
                    </div>
                  ) : (
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="35%">
                          <defs>
                            <linearGradient id="barGradAnalytics" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                              <stop offset="100%" stopColor="#4338ca" stopOpacity={0.8}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month"
                            tickFormatter={m => { try { return new Date(m+'-01').toLocaleDateString('en-US',{month:'short',year:'2-digit'}); } catch(e){return m;} }}
                            axisLine={false} tickLine={false}
                            tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }}
                          />
                          <YAxis axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                            tickFormatter={v => getCurrencySymbol(selectedCurrency) + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)}
                            width={45}
                          />
                          <Tooltip
                            cursor={{ fill: '#f8faff', rx: 8 }}
                            formatter={v => [formatCurrency(v), 'Spent']}
                            labelFormatter={m => { try { return new Date(m+'-01').toLocaleDateString('en-US',{month:'long',year:'numeric'}); } catch(e){return m;} }}
                            contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.15)', padding: '12px 16px' }}
                            labelStyle={{ fontWeight: 900, fontSize: '11px', color: '#4338ca', marginBottom: '4px' }}
                            itemStyle={{ fontWeight: 700, fontSize: '12px', color: '#1e293b' }}
                          />
                          <Bar dataKey="total" fill="url(#barGradAnalytics)" radius={[6,6,0,0]} maxBarSize={56} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Donut */}
              <div className="bg-white rounded-none border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                <div className="px-6 py-4 border-b-2 border-black flex items-center gap-3 bg-[#f0f9ff]">
                  <span className="w-10 h-10 bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center text-lg">📊</span>
                  <h3 className="text-xl font-black text-black tracking-tight">Category Breakdown</h3>
                </div>
                <div className="p-6">
                  {categoryData.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center">
                      <p className="text-gray-400 text-sm italic">No category data yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                              paddingAngle={4} dataKey="value" stroke="#000" strokeWidth={2}>
                              {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                            </Pie>
                            <Tooltip formatter={v => [formatCurrency(v), 'Spent']}
                              contentStyle={{ borderRadius: '0', border: '2px solid black', boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', fontWeight: 'bold' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-3">
                        {categoryData.slice(0, 6).map((cat, i) => (
                          <div key={cat.name} className="flex items-center gap-3 p-2 border-2 border-transparent hover:border-black hover:bg-gray-50 transition-colors">
                            <div className="w-4 h-4 border-2 border-black flex-shrink-0 shadow-[1px_1px_0_0_rgba(0,0,0,1)]" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <p className="text-sm font-bold text-black truncate flex-1">{cat.name}</p>
                            <p className="text-sm font-black text-black flex-shrink-0">{formatCurrency(cat.value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly breakdown table */}
            {(analytics || []).length > 0 && (
              <div className="bg-white rounded-none border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-8">
                <div className="px-6 py-4 border-b-2 border-black bg-[#4f46e5]">
                  <h3 className="text-xl font-black text-white tracking-tight">Month-by-Month Detail</h3>
                </div>
                <div className="divide-y-2 divide-black">
                  {(analytics || []).map(month => (
                    <div key={month.month} className="p-6 bg-white hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-black text-black text-lg">{month.month}</p>
                        <div className="text-right">
                          <p className="font-black text-black text-xl">{formatCurrency(month.total)}</p>
                          <p className="text-xs text-blue-600 uppercase font-black tracking-widest mt-1 bg-blue-50 border border-black inline-block px-2 py-0.5 shadow-[1px_1px_0_0_rgba(0,0,0,1)]">{month.expense_count} transactions</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {(month.categories || []).slice(0, 6).map(cat => (
                          <div key={cat.category}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-gray-600 uppercase truncate">{cat.category}</span>
                              <span className="text-sm font-black text-black ml-1">{formatCurrency(cat.total)}</span>
                            </div>
                            <div className="w-full bg-white border-2 border-black rounded-none h-3 shadow-[1px_1px_0_0_rgba(0,0,0,1)]">
                              <div className="bg-[#FFD700] h-full border-r-2 border-black transition-all" style={{width:`${Math.min(cat.percentage,100)}%`}} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {activeTab === 'predictions' && (
          <div className="space-y-6">
            <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] rounded-none p-8 text-center max-w-5xl mx-auto">
              <div className="w-24 h-24 bg-[#FFD700] border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex items-center justify-center mx-auto mb-8">
                <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h2 className="text-4xl font-black text-black mb-4 tracking-tighter uppercase">AI Spending Forecast</h2>
              <p className="text-black font-bold mb-10 text-xl max-w-2xl mx-auto leading-tight">Predicting your financial future using historical trends and machine learning.</p>
              
              {loadingForecast ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 text-black border-dashed border-black bg-yellow-50">
                   <div className="animate-spin h-12 w-12 border-4 border-t-[#FFD700] border-black rounded-full mb-6"></div>
                   <p className="text-black text-lg font-black tracking-widest uppercase animate-pulse">Analyzing patterns...</p>
                </div>
              ) : forecast ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                  <div className="bg-[#4f46e5] border-2 border-black rounded-none p-8 text-white shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
                    <p className="uppercase tracking-widest text-[#FFD700] text-sm font-black mb-2 border-b-2 border-[#FFD700] inline-block pb-1">Next Month Prediction</p>
                    <h3 className="text-6xl font-black mb-6 mt-4 tracking-tighter">{formatCurrency(forecast.predicted_total)}</h3>
                    <div className="bg-black/20 border-2 border-black p-4">
                      <p className="text-sm font-black text-[#FFD700] uppercase tracking-wider mb-2">💡 Trend Insight</p>
                      <p className="text-sm text-white font-bold leading-snug">Our AI predicts this based on your most recent spending behaviors and seasonal trends.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-[#FFD700] border-2 border-black rounded-none p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
                      <h4 className="font-black text-black text-lg uppercase tracking-wider mb-4 flex items-center gap-3">
                        <span className="w-8 h-8 bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center text-sm">⭐</span>
                        Saving Opportunity
                      </h4>
                      <p className="text-black text-base font-bold italic leading-relaxed">"{forecast.savings_tip}"</p>
                    </div>
                    
                    <div className="bg-white border-2 border-black rounded-none p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                      <h4 className="font-black text-black text-lg uppercase tracking-wider mb-4 border-b-2 border-black pb-2">Top Expected Categories</h4>
                      <div className="space-y-3">
                        {forecast.top_categories.map((cat, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-black font-bold uppercase">{cat}</span>
                            <span className="font-black text-xs text-white bg-[#4f46e5] border border-black px-2 py-1 shadow-[1px_1px_0_0_rgba(0,0,0,1)] tracking-widest uppercase">High Prob.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-12 border-2 border-dashed border-black">
                   <p className="text-black font-bold text-lg">Not enough data to generate a forecast yet. Keep recording expenses!</p>
                </div>
              )}
            </div>
            
            <div className="bg-[#10b981] border-2 border-black rounded-none p-8 text-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] overflow-hidden relative max-w-5xl mx-auto">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-3xl font-black mb-3 tracking-tighter uppercase">Smart Alerts Enabled</h3>
                  <p className="text-black font-bold mb-6 max-w-lg leading-relaxed text-lg">Our AI now monitors every transaction. If we detect an unusual spike or an unexpected recurring bill, you'll see a red <span className="bg-red-500 text-white px-2 py-0.5 border border-black">ANOMALY</span> tag in your history.</p>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider bg-white border-2 border-black px-3 py-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                      <span className="w-3 h-3 bg-red-500 border border-black animate-pulse"></span>
                      Anomaly Detection
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider bg-white border-2 border-black px-3 py-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                      <span className="w-3 h-3 bg-blue-500 border border-black"></span>
                      Pattern Recognition
                    </div>
                  </div>
                </div>
                {/* Decorative Element */}
                <div className="hidden md:flex flex-shrink-0 w-48 h-48 border-4 border-black bg-white shadow-[8px_8px_0_0_rgba(0,0,0,1)] items-center justify-center p-4">
                   <div className="w-full h-full border-4 border-dashed border-black rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                     <div className="w-16 h-16 bg-[#FFD700] border-4 border-black"></div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sidebar: Group List & Create/Join */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none overflow-hidden flex flex-col h-full">
                  <div className="p-6 bg-[#4f46e5] border-b-2 border-black flex items-center justify-between">
                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      My Wallets
                    </h3>
                  </div>
                  <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto bg-white flex-1">
                    {loadingGroups ? (
                      <div className="py-8 text-center text-gray-400 text-sm font-bold animate-pulse">Loading wallets...</div>
                    ) : groups.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 text-sm font-bold border-2 border-dashed border-gray-300">No shared wallets yet.<br/>Create one or join with a code!</div>
                    ) : (
                      groups.map(group => (
                        <button
                          key={group.id}
                          onClick={() => {
                            setSelectedGroup(group);
                            fetchGroupExpenses(group.id);
                          }}
                          className={`w-full flex items-center p-3 transition-all border-2 ${
                            selectedGroup?.id === group.id 
                            ? 'bg-blue-50 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)]' 
                            : 'border-transparent hover:border-black hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] text-black bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-4 w-full">
                            <div className="w-12 h-12 bg-[#4f46e5] border-2 border-black text-white flex items-center justify-center font-black text-sm shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                               {group.name?.substring(0, 2).toUpperCase() || 'SW'}
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-base font-black text-black leading-tight">{group.name}</p>
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">{(group.members || []).length} MEMBER{(group.members || []).length !== 1 ? 'S' : ''}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-4 bg-white border-t-2 border-black space-y-4">
                    {/* Join Wallet */}
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Enter invite code..."
                        value={groupInviteCode}
                        onChange={e => setGroupInviteCode(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && joinGroup(groupInviteCode)}
                        className="flex-1 px-3 py-2 bg-white border-2 border-black text-sm font-bold outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all"
                      />
                      <button
                        onClick={() => joinGroup(groupInviteCode)}
                        disabled={!groupInviteCode.trim()}
                        className="px-4 py-2 bg-[#FFD700] border-2 border-black text-black font-black hover:bg-[#F2C900] disabled:opacity-50 disabled:grayscale transition-all hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:-translate-y-px"
                      >
                        Join
                      </button>
                    </div>
                    {/* Create Wallet */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="New wallet name..."
                        value={newWalletName}
                        onChange={e => setNewWalletName(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter' && newWalletName.trim()){ createGroup(newWalletName.trim(), ''); setNewWalletName(''); } }}
                        className="flex-1 px-3 py-2 bg-white border-2 border-black text-sm font-bold outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all"
                      />
                      <button
                        onClick={() => { if(newWalletName.trim()){ createGroup(newWalletName.trim(), ''); setNewWalletName(''); } }}
                        disabled={!newWalletName.trim()}
                        className="px-4 py-2 bg-[#FFD700] border-2 border-black text-black font-black hover:bg-[#F2C900] disabled:opacity-50 disabled:grayscale transition-all hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:-translate-y-px"
                      >
                        + New
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main: Group View */}
              <div className="lg:col-span-2">
                {!selectedGroup ? (
                  <div className="h-full bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none flex flex-col items-center justify-center p-12 text-center min-h-[500px]">
                    <div className="w-20 h-20 bg-gray-50 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </div>
                    <h4 className="text-3xl font-black text-black mb-3 tracking-tighter">Select a Wallet</h4>
                    <p className="text-base font-bold text-gray-600 max-w-sm leading-snug">Pick a shared wallet from the left to view group spending and settle up with friends.</p>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none overflow-hidden flex flex-col min-h-[500px]">
                    {/* Group Header */}
                    <div className="p-6 border-b-2 border-black flex flex-wrap gap-4 justify-between items-start bg-white">
                      <div>
                        <h3 className="text-3xl font-black text-black tracking-tight">{selectedGroup.name}</h3>
                        <p className="text-xs text-gray-600 font-bold flex items-center gap-2 mt-2">
                          <span className="uppercase text-[10px] tracking-widest text-black">Invite Code: </span>
                          <span className="bg-[#FFD700] border border-black px-2 py-0.5 font-bold text-black select-all cursor-pointer shadow-[1px_1px_0_0_rgba(0,0,0,1)]" title="Click to copy" onClick={() => navigator.clipboard?.writeText(selectedGroup.invite_code)}>
                            {selectedGroup.invite_code}
                          </span>
                          <span className="text-gray-400 font-black">•</span>
                          <span className="text-blue-600 font-black uppercase tracking-widest text-[10px]">{(selectedGroup.members || []).length} MEMBER{(selectedGroup.members || []).length !== 1 ? 'S' : ''}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => { setShowAddBill(v => !v); setGroupBillForm({ description: '', amount: '', category: 'Shared' }); }}
                        className="px-6 py-2.5 bg-[#FFD700] text-black border-2 border-black font-black hover:bg-[#F2C900] shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all active:-translate-y-px text-sm"
                      >
                        {showAddBill ? '✕ Cancel' : '+ Add Bill'}
                      </button>
                    </div>

                    {/* Inline Add Bill Form */}
                    {showAddBill && (
                      <form onSubmit={submitGroupBill} className="p-6 bg-[#f0f9ff] border-b-2 border-black flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-xs font-black text-black uppercase tracking-widest mb-2">Description *</label>
                          <input required type="text" placeholder="e.g. Monthly rent" value={groupBillForm.description}
                            onChange={e => setGroupBillForm(p => ({...p, description: e.target.value}))}
                            className="w-full px-3 py-2 border-2 border-black rounded-none text-sm font-bold outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all bg-white" />
                        </div>
                        <div className="w-36">
                          <label className="block text-xs font-black text-black uppercase tracking-widest mb-2">Amount (₹) *</label>
                          <input required type="number" min="0" step="0.01" placeholder="0.00" value={groupBillForm.amount}
                            onChange={e => setGroupBillForm(p => ({...p, amount: e.target.value}))}
                            className="w-full px-3 py-2 border-2 border-black rounded-none text-sm font-bold outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all bg-white" />
                        </div>
                        <div className="w-44">
                          <label className="block text-xs font-black text-black uppercase tracking-widest mb-2">Category</label>
                          <select value={groupBillForm.category}
                            onChange={e => setGroupBillForm(p => ({...p, category: e.target.value}))}
                            className="w-full px-3 py-2 border-2 border-black rounded-none text-sm font-bold outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] focus:-translate-y-px transition-all bg-white">
                            {['Shared','Food & Dining','Groceries & Household','Bills & Utilities','Entertainment','Travel & Vacation','Other'].map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <button type="submit" className="px-6 py-2 h-[42px] bg-[#FFD700] text-black border-2 border-black rounded-none text-sm font-black hover:bg-[#F2C900] shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all active:-translate-y-px">
                          Split & Save
                        </button>
                      </form>
                    )}

                    {/* Group Sub-Tabs */}
                    <div className="flex border-b-2 border-black bg-white relative z-10 px-6 gap-6 shadow-[0_2px_0_0_rgba(0,0,0,1)]">
                      <button onClick={() => setGroupTab('transactions')}
                        className={`py-4 text-sm font-black uppercase tracking-wider transition-colors border-b-4 ${groupTab==='transactions'?'border-blue-600 text-blue-700':'border-transparent text-gray-400 hover:text-black hover:border-black'}`}>
                        Transactions
                      </button>
                      <button onClick={() => setGroupTab('settlements')}
                        className={`py-4 text-sm font-black uppercase tracking-wider transition-colors border-b-4 ${groupTab==='settlements'?'border-blue-600 text-blue-700':'border-transparent text-gray-400 hover:text-black hover:border-black'}`}>
                        Settle Up
                      </button>
                    </div>

                    {/* View Area */}
                    <div className="flex-1 overflow-y-auto min-h-[400px] bg-white">
                      {groupTab === 'transactions' ? (
                        groupExpenses.length === 0 ? (
                          <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-gray-50 flex items-center justify-center mx-auto mb-6 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 8l2 2 4-4" /></svg>
                            </div>
                            <p className="text-xl font-black text-black mb-2">No transactions yet.</p>
                            <p className="text-sm font-bold text-gray-500">Click "+ Add Bill" above to split your first expense.</p>
                          </div>
                        ) : (
                          <div className="divide-y-2 divide-black bg-white">
                            {groupExpenses.map((exp, i) => (
                              <div key={exp.id || i} className="px-6 py-5 hover:bg-yellow-50 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] text-black rounded-none flex items-center justify-center text-xl">
                                    {exp.category === 'Food & Dining' ? '🍽️' : exp.category === 'Groceries & Household' ? '🛒' : exp.category === 'Bills & Utilities' ? '⚡' : exp.category === 'Entertainment' ? '🎬' : exp.category === 'Travel & Vacation' ? '✈️' : '🏦'}
                                  </div>
                                  <div>
                                    <p className="text-base font-black text-black uppercase">{exp.description}</p>
                                    <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                                      {exp.category} • {exp.date} {exp.creator_name ? <span>• <span className="text-blue-600 font-black px-1 border border-blue-600">by {exp.creator_name}</span></span> : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-black text-black">{formatCurrency(exp.amount)}</p>
                                  <p className="text-[10px] text-black bg-[#FFD700] border border-black px-1.5 py-0.5 mt-1 font-bold inline-block uppercase tracking-tight shadow-[1px_1px_0_0_rgba(0,0,0,1)]">Split equally</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        // Settle Up View
                        groupSettlements.length === 0 ? (
                          <div className="py-24 text-center">
                            <div className="w-20 h-20 bg-green-50 text-green-500 flex items-center justify-center mx-auto mb-6 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-3xl">
                              🎉
                            </div>
                            <p className="text-xl font-black text-black mb-2">You're all settled up!</p>
                            <p className="text-sm font-bold text-gray-500">Nobody owes anything in this group right now.</p>
                          </div>
                        ) : (
                          <div className="p-8">
                            <h4 className="text-sm font-black text-black uppercase tracking-widest mb-6 py-2 border-y-2 border-black bg-[#FFD700] px-4 inline-block">Suggested Settlements</h4>
                            <div className="space-y-4">
                              {groupSettlements.map((settle, i) => (
                                <div key={i} className="bg-white p-5 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none flex items-center justify-between hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
                                  <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-center">
                                      <div className="w-10 h-10 border-2 border-black bg-rose-50 text-rose-700 font-black flex items-center justify-center text-sm shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                                        {settle.from_user_name.charAt(0)}
                                      </div>
                                    </div>
                                    <div className="text-black font-black text-sm uppercase tracking-widest px-2 pb-1 border-b-2 border-black">
                                      Pays
                                      <span className="inline-block ml-2 w-0 h-0 border-y-4 border-y-transparent border-l-[6px] border-l-black relative top-0.5"></span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="w-10 h-10 border-2 border-black bg-emerald-50 text-emerald-700 font-black flex items-center justify-center text-sm shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                                        {settle.to_user_name.charAt(0)}
                                      </div>
                                    </div>
                                    <div className="ml-4">
                                      <p className="text-sm font-black text-black uppercase">
                                        {settle.from_user_name} <span className="text-rose-600 font-bold px-1 bg-rose-50 border border-rose-200">owes</span> {settle.to_user_name}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right pl-6 border-l-2 border-dashed border-gray-300">
                                    <p className="text-2xl font-black text-black">{formatCurrency(settle.amount)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                      src={`${API}/api${selectedExpense.receipt_url}`}
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

      {/* ─── BUDGETS TAB ─── */}
      {activeTab === 'budgets' && (
        <div className="space-y-6 animate-[slideDown_0.3s_ease-out]">
            <div className="bg-white rounded-none shadow-[8px_8px_0_0_rgba(0,0,0,1)] border-2 border-black p-6 md:p-8">
              <div className="flex items-center space-x-4 mb-8">
                <div className="w-14 h-14 bg-[#10b981] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Monthly Budgets</h2>
                  <p className="text-sm font-bold text-gray-700 mt-1 uppercase tracking-widest">Set spending limits and track in real-time</p>
                </div>
              </div>

              <form onSubmit={createBudget} className="flex flex-wrap gap-4 items-end p-5 bg-[#f0f9ff] border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-8">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs font-black text-black uppercase tracking-widest mb-2">Category</label>
                  <select required value={budgetForm.category} onChange={e => setBudgetForm(p => ({ ...p, category: e.target.value }))}
                    className="block w-full border-2 border-black bg-white rounded-none px-4 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-shadow appearance-none">
                    <option value="">SELECT CATEGORY</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-black text-black uppercase tracking-widest mb-2">Monthly Limit (₹)</label>
                  <input type="number" required min="1" step="0.01" placeholder="5000"
                    value={budgetForm.amount} onChange={e => setBudgetForm(p => ({ ...p, amount: e.target.value }))}
                    className="block w-full border-2 border-black bg-white rounded-none px-4 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-shadow" />
                </div>
                <button type="submit" className="px-6 py-3 bg-[#FFD700] text-black border-2 border-black font-black uppercase tracking-widest hover:bg-[#F2C900] hover:-translate-y-1 shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:translate-y-px active:shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all">
                  + Set Budget
                </button>
              </form>

              {budgetLoading ? (
                <div className="text-center py-8 text-gray-500">Loading budgets...</div>
              ) : budgets.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01" /></svg>
                  <p className="text-gray-500">No budgets set yet. Add one above to get started!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {budgets.map(b => (
                    <div key={b.id} className={`p-5 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all bg-white hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)]`}>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-lg font-black text-black uppercase">{b.category}</span>
                          {b.is_exceeded && <span className="ml-3 text-xs font-black text-white bg-red-500 px-2 py-1 border border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)]">EXCEEDED</span>}
                          {!b.is_exceeded && b.percentage >= 80 && <span className="ml-3 text-xs font-black text-black bg-[#FFD700] px-2 py-1 border border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)] tracking-widest">WARNING</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-black text-black">₹{(b.spent || 0).toLocaleString('en-IN', {maximumFractionDigits: 0})} <span className="text-sm font-bold text-gray-500">/ ₹{b.amount.toLocaleString('en-IN', {maximumFractionDigits: 0})}</span></span>
                          <button onClick={() => deleteBudget(b.id)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:bg-red-500 hover:text-white active:translate-y-px active:shadow-none transition-all text-black">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="w-full bg-white border-2 border-black h-5 shadow-inner">
                        <div className={`h-full border-r-2 border-black transition-all duration-500 ${b.is_exceeded ? 'bg-red-500' : b.percentage >= 80 ? 'bg-[#FFD700]' : 'bg-[#10b981]'}`}
                          style={{ width: `${Math.min(100, b.percentage)}%` }} />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{b.percentage}% USED</span>
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">₹{(b.remaining || 0).toLocaleString('en-IN', {maximumFractionDigits: 0})} REMAINING</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      )}

      {/* ─── RECURRING EXPENSES TAB ─── */}
      {activeTab === 'recurring' && (() => {
        const activeRecurring = recurringItems.filter(r => r.is_active);
        const monthlyTotalOutflow = activeRecurring.reduce((sum, r) => {
          const amt = parseFloat(r.amount) || 0;
          if (r.frequency === 'monthly') return sum + amt;
          if (r.frequency === 'yearly') return sum + (amt / 12);
          if (r.frequency === 'weekly') return sum + (amt * 4.33);
          if (r.frequency === 'daily') return sum + (amt * 30);
          return sum;
        }, 0);
        
        const now = new Date();
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        const upcomingCount = activeRecurring.filter(r => {
          const d = new Date(r.next_date);
          return d >= now && d <= next7Days;
        }).length;

        return (
          <div className="space-y-6 animate-[slideDown_0.3s_ease-out]">
              <div className="flex items-center space-x-4 mb-2">
                <div className="w-14 h-14 bg-[#4f46e5] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Smart Subscriptions</h2>
                  <p className="text-sm font-bold text-gray-700 tracking-widest uppercase mt-1">Track and auto-log fixed monthly outflows</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-6">
                <div className="bg-[#FFD700] border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
                  <p className="text-xs font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1 inline-block">Fixed Outflow</p>
                  <p className="text-4xl font-black text-black tracking-tighter mt-2">{formatCurrency(monthlyTotalOutflow)}</p>
                  <p className="text-[10px] font-bold text-gray-800 uppercase mt-2">Estimated avg / month</p>
                </div>
                <div className="bg-[#f472b6] border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
                  <p className="text-xs font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1 inline-block">Due in 7 Days</p>
                  <p className="text-4xl font-black text-black tracking-tighter mt-2">{upcomingCount} <span className="text-lg text-black font-black uppercase tracking-widest">bills</span></p>
                  <p className="text-[10px] font-bold text-gray-900 uppercase mt-2">Action required soon</p>
                </div>
                <div className="bg-[#10b981] border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-6 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] transition-all">
                  <p className="text-xs font-black text-black uppercase tracking-widest mb-2 border-b-2 border-black pb-1 inline-block">Active Subs</p>
                  <p className="text-4xl font-black text-black tracking-tighter mt-2">{activeRecurring.length}</p>
                  <p className="text-[10px] font-bold text-gray-900 uppercase mt-2">Out of {recurringItems.length} total</p>
                </div>
              </div>

              <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-6 md:p-8">
                <div className="flex justify-between items-center mb-8 border-b-2 border-black pb-4">
                  <h3 className="text-xl font-black text-black uppercase tracking-tight flex items-center gap-3">
                    <span className="w-4 h-4 bg-[#FFD700] border-2 border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)]"></span> Your Subscriptions
                  </h3>
                  <button 
                    onClick={() => setShowAddRecurring(!showAddRecurring)}
                    className="px-5 py-2.5 bg-[#4f46e5] text-white border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-[#4338ca] shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:-translate-y-px transition-all active:translate-y-px active:shadow-none"
                  >
                    {showAddRecurring ? 'Cancel' : '+ New Bill'}
                  </button>
                </div>

                {showAddRecurring && (
                  <form onSubmit={createRecurring} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5 bg-[#f0f9ff] p-6 border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] mb-8">
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Title</label>
                      <input type="text" required placeholder="NETFLIX, RENT..." value={recurringForm.title} onChange={e => setRecurringForm(p => ({ ...p, title: e.target.value }))} className="w-full border-2 border-black rounded-none px-3 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)]" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Amount</label>
                      <input type="number" required min="1" step="0.01" placeholder="499" value={recurringForm.amount} onChange={e => setRecurringForm(p => ({ ...p, amount: e.target.value }))} className="w-full border-2 border-black rounded-none px-3 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)]" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Category</label>
                      <select required value={recurringForm.category} onChange={e => setRecurringForm(p => ({ ...p, category: e.target.value }))} className="w-full border-2 border-black rounded-none px-3 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] bg-white">
                        <option value="" disabled>SELECT</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Cycle</label>
                      <select required value={recurringForm.frequency} onChange={e => setRecurringForm(p => ({ ...p, frequency: e.target.value }))} className="w-full border-2 border-black rounded-none px-3 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] bg-white uppercase">
                        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Next Date</label>
                      <input type="date" required value={recurringForm.next_date} onChange={e => setRecurringForm(p => ({ ...p, next_date: e.target.value }))} className="w-full border-2 border-black rounded-none px-2 py-3 text-sm font-bold focus:ring-0 focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] bg-white text-black" />
                    </div>
                    <div className="md:col-span-2 lg:col-span-6 flex justify-end mt-4">
                      <button type="submit" className="w-full md:w-auto px-8 py-3 bg-[#FFD700] text-black border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-[#F2C900] transition-all shadow-[4px_4px_0_0_rgba(0,0,0,1)] active:translate-y-px active:shadow-[2px_2px_0_0_rgba(0,0,0,1)]">Save Subscription</button>
                    </div>
                  </form>
                )}

                {recurringLoading ? (
                  <div className="py-12 flex justify-center"><div className="w-10 h-10 border-4 border-black border-t-[#FFD700] rounded-none animate-spin shadow-[2px_2px_0_0_rgba(0,0,0,1)]"></div></div>
                ) : recurringItems.length === 0 ? (
                  <div className="text-center py-16 opacity-100 border-2 border-dashed border-black bg-gray-50">
                    <div className="text-5xl mb-4">📅</div>
                    <p className="text-lg font-black text-black uppercase tracking-widest">No subscriptions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recurringItems.map(r => (
                      <div key={r.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 border-2 border-black transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${r.is_active ? 'bg-white shadow-[2px_2px_0_0_rgba(0,0,0,1)]' : 'bg-gray-100 opacity-80'}`}>
                        <div className="flex items-center gap-5 mb-4 sm:mb-0">
                          <div className={`w-14 h-14 border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center text-2xl ${r.is_active ? 'bg-[#FFD700] text-black' : 'bg-gray-300 text-gray-500'}`}>
                            {r.category === 'Entertainment' ? '🎬' : r.category === 'Bills & Utilities' ? '⚡' : r.category === 'Food & Dining' ? '🍔' : '💳'}
                          </div>
                          <div>
                            <p className="font-black text-xl text-black uppercase tracking-tight">{r.title}</p>
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2 mt-1">
                              {r.frequency} • NEXT: <span className={new Date(r.next_date) <= next7Days ? 'text-white bg-red-500 px-1 border border-black' : 'text-black bg-blue-100 px-1 border border-black'}>{new Date(r.next_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-6">
                          <span className="font-black text-2xl text-black">{formatCurrency(parseFloat(r.amount))}</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => toggleRecurring(r.id)} className={`text-[10px] px-3 py-2 border-2 border-black font-black uppercase tracking-widest shadow-[1px_1px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-px active:shadow-none ${r.is_active ? 'bg-[#10b981] text-black hover:bg-[#0ea5e9]' : 'bg-white text-black hover:bg-gray-200'}`}>
                              {r.is_active ? 'Active' : 'Paused'}
                            </button>
                            <button onClick={() => deleteRecurring(r.id)} className="w-8 h-8 flex items-center justify-center bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:bg-red-500 hover:text-white active:translate-y-px active:shadow-none transition-all text-black">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        );
      })()}

      {/* ─── SAVINGS GOALS TAB (GAMIFICATION) ─── */}
      {activeTab === 'goals' && (
        <div className="animate-[slideDown_0.3s_ease-out]">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-14 h-14 bg-[#f472b6] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center justify-center">
              <span className="text-3xl text-black">🎯</span>
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Savings Goals</h2>
              <p className="text-sm font-bold text-gray-700 tracking-widest uppercase mt-1">Track progress toward your dreams</p>
            </div>
            <button 
              onClick={() => setShowAddGoal(!showAddGoal)}
              className="px-6 py-3 bg-[#4f46e5] text-white border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-[#4338ca] shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-px transition-all active:translate-y-px active:shadow-[2px_2px_0_0_rgba(0,0,0,1)] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
              {showAddGoal ? 'CANCEL' : 'NEW GOAL'}
            </button>
          </div>

          {showAddGoal && (
            <div className="bg-[#f0f9ff] border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] p-8 mb-10 animate-[slideDown_0.2s_ease-out]">
              <h3 className="text-lg font-black text-black uppercase tracking-widest mb-6 border-b-2 border-black pb-2 inline-block">Create Target</h3>
              <form onSubmit={createGoal} className="grid grid-cols-1 md:grid-cols-6 gap-6 items-end">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Icon</label>
                  <div className="flex gap-2 p-2 bg-white border-2 border-black h-[50px] items-center justify-center overflow-x-auto no-scrollbar shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                    {['💰', '✈️', '🚗', '💻', '🏠', '🎓'].map(emoji => (
                      <button key={emoji} type="button" onClick={() => setGoalForm(p => ({...p, icon: emoji}))} className={`w-8 h-8 flex items-center justify-center text-xl transition-all ${goalForm.icon === emoji ? 'bg-[#FFD700] border-2 border-black shadow-[1px_1px_0_0_rgba(0,0,0,1)] scale-110' : 'hover:scale-110'}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Goal Title</label>
                  <input type="text" required value={goalForm.title} onChange={e => setGoalForm(p => ({...p, title: e.target.value}))} className="w-full bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] rounded-none px-4 py-3 text-sm font-bold focus:outline-none focus:ring-0 placeholder-gray-400 text-black uppercase" placeholder="DREAM VACATION..." />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Amount (₹)</label>
                  <input type="number" required min="1" step="0.01" value={goalForm.target_amount} onChange={e => setGoalForm(p => ({...p, target_amount: e.target.value}))} className="w-full bg-white border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] rounded-none px-4 py-3 text-sm font-bold focus:outline-none focus:ring-0 placeholder-gray-400 text-black" placeholder="50000" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-black uppercase tracking-widest mb-2">Color</label>
                  <div className="flex gap-2 p-2 bg-white border-2 border-black h-[50px] items-center justify-center shadow-[2px_2px_0_0_rgba(0,0,0,1)]">
                    {[
                      { id: 'indigo', bg: 'bg-[#4f46e5]' },
                      { id: 'emerald', bg: 'bg-[#10b981]' },
                      { id: 'rose', bg: 'bg-[#f43f5e]' },
                      { id: 'amber', bg: 'bg-[#FFD700]' },
                      { id: 'cyan', bg: 'bg-[#06b6d4]' },
                      { id: 'purple', bg: 'bg-[#a855f7]' }
                    ].map(({id, bg}) => (
                      <button key={id} type="button" onClick={() => setGoalForm(p => ({...p, color: id}))} className={`w-5 h-5 border-2 border-black ${bg} ${goalForm.color === id ? 'shadow-[2px_2px_0_0_rgba(0,0,0,1)] scale-125' : ''} transition-all`}></button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-1 flex items-end">
                  <button type="submit" className="w-full h-[50px] bg-[#FFD700] text-black border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-[#F2C900] shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-px active:shadow-none">START!</button>
                </div>
              </form>
            </div>
          )}

          {goalsLoading ? (
            <div className="py-20 flex justify-center"><div className="w-10 h-10 border-4 border-black border-t-[#f472b6] rounded-none animate-spin shadow-[2px_2px_0_0_rgba(0,0,0,1)]"></div></div>
          ) : goals.length === 0 ? (
            <div className="text-center py-24 bg-[#fffbfa] border-4 border-black border-dashed shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
              <div className="text-6xl mb-6">🏝️</div>
              <h3 className="text-2xl font-black text-black uppercase tracking-tighter mb-2">No goals set yet!</h3>
              <p className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-8 max-w-sm mx-auto">Visualizing your target helps you save money faster.</p>
              <button onClick={() => setShowAddGoal(true)} className="px-8 py-4 bg-[#FFD700] text-black border-2 border-black text-xs font-black uppercase tracking-widest hover:bg-[#F2C900] shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-px active:shadow-[2px_2px_0_0_rgba(0,0,0,1)]">CREATE FIRST GOAL</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {goals.map(goal => {
                const colorTheme = {
                  indigo: { bgClasses: 'bg-[#c7d2fe]', barColor: 'bg-[#4f46e5]', text: 'text-black' },
                  emerald: { bgClasses: 'bg-[#a7f3d0]', barColor: 'bg-[#10b981]', text: 'text-black' },
                  rose: { bgClasses: 'bg-[#fecdd3]', barColor: 'bg-[#f43f5e]', text: 'text-black' },
                  amber: { bgClasses: 'bg-[#fef08a]', barColor: 'bg-[#FFD700]', text: 'text-black' },
                  cyan: { bgClasses: 'bg-[#a5f3fc]', barColor: 'bg-[#06b6d4]', text: 'text-black' },
                  purple: { bgClasses: 'bg-[#e9d5ff]', barColor: 'bg-[#a855f7]', text: 'text-black' },
                }[goal.color] || { bgClasses: 'bg-white', barColor: 'bg-black', text: 'text-black' };

                const progress = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                const isComplete = progress >= 100;

                return (
                  <div key={goal.id} className={`bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_rgba(0,0,0,1)] hover:-translate-y-2 hover:shadow-[12px_12px_0_0_rgba(0,0,0,1)] transition-all flex flex-col relative group`}>
                    <button onClick={() => deleteGoal(goal.id)} className="absolute top-4 right-4 w-10 h-10 border-2 border-black bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all active:translate-y-px active:shadow-none z-10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    
                    <div className="flex items-center gap-5 mb-8">
                      <div className={`w-16 h-16 border-2 border-black flex items-center justify-center text-3xl shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${colorTheme.bgClasses}`}>
                        {isComplete ? '🎉' : goal.icon || '💸'}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-black uppercase tracking-tight">{goal.title}</h3>
                        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest mt-1 bg-gray-100 border border-black inline-block px-2 py-0.5">{progress}% {isComplete ? 'COMPLETED!' : 'REACHED'}</p>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-3xl font-black text-black tracking-tighter">{formatCurrency(goal.current_amount)}</span>
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest pb-1">OF {formatCurrency(goal.target_amount)}</span>
                      </div>
                      <div className="w-full h-6 bg-white border-2 border-black overflow-hidden mb-6 relative">
                        <div className={`absolute left-0 top-0 bottom-0 border-r-2 border-black ${colorTheme.barColor} transition-all duration-1000 ease-out`} style={{width: `${progress}%`}}></div>
                      </div>
                    </div>

                    {!isComplete ? (
                      <form onSubmit={contributeToGoal} className="mt-auto">
                        <div className="flex gap-3">
                          <input 
                            type="number" 
                            min="1" 
                            step="0.01" 
                            placeholder="AMOUNT..." 
                            value={contributionForm.goalId === goal.id ? contributionForm.amount : ''}
                            onChange={e => setContributionForm({ goalId: goal.id, amount: e.target.value })}
                            className="w-full bg-white border-2 border-black rounded-none px-4 py-3 text-xs font-bold focus:outline-none focus:shadow-[2px_2px_0_0_rgba(0,0,0,1)] uppercase text-black" 
                          />
                          <button 
                            type="submit" 
                            disabled={contributionForm.goalId !== goal.id || !contributionForm.amount}
                            className={`px-6 py-3 border-2 border-black text-xs font-black uppercase tracking-widest transition-all ${contributionForm.goalId === goal.id && contributionForm.amount ? 'bg-[#FFD700] text-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:bg-[#F2C900] hover:-translate-y-px active:translate-y-px active:shadow-none' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-[2px_2px_0_0_rgba(0,0,0,1)]'}`}
                          >
                            ADD
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-auto py-3 bg-[#10b981] border-2 border-black text-center shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                        <span className="text-sm font-black text-black uppercase tracking-widest flex items-center justify-center gap-2">
                          <svg className="w-5 h-5 text-black" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          GOAL REACHED!
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </main>
      </div>
    </div>
  );
}

export default App;
