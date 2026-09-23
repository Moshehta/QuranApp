import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import StudentProfile from './pages/StudentProfile';
import AddSession from './pages/AddSession';
import UsersManagement from './pages/UsersManagement';
import AddStudent from './pages/AddStudent';
import Navbar from './components/Navbar';
import ChangePasswordModal from './components/ChangePasswordModal';
import QuranAudio from './pages/QuranAudio';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePwd, setShowChangePwd] = useState(false);

  useEffect(() => {
    // استعادة الجلسة الخاصة بالتبويب الحالي من sessionStorage
    const savedUser = sessionStorage.getItem('quran_user');
    const token = sessionStorage.getItem('quran_token');
    if (savedUser && token) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      if (parsed.mustChangePassword) setShowChangePwd(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    sessionStorage.setItem('quran_user', JSON.stringify(userData));
    sessionStorage.setItem('quran_token', token);
    setUser(userData);
    if (userData.mustChangePassword) setShowChangePwd(true);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
    setUser(null);
  };

  if (loading) return <div className="d-flex justify-content-center align-items-center vh-100"><div className="spinner-border text-success" /></div>;

  return (
    <Router>
      <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>
        {user && <Navbar user={user} onLogout={handleLogout} />}
        {user && showChangePwd && (
          <ChangePasswordModal
            user={user}
            onClose={() => setShowChangePwd(false)}
            onChanged={() => {
              setShowChangePwd(false);
              const updated = { ...user, mustChangePassword: false };
              setUser(updated);
              localStorage.setItem('quran_user', JSON.stringify(updated));
            }}
          />
        )}
        <Routes>
          <Route path="/login" element={!user ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} />
          <Route path="/" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
          <Route path="/student/:id" element={user ? <StudentProfile user={user} /> : <Navigate to="/login" />} />
          <Route path="/student/:id/add-session" element={user ? <AddSession user={user} /> : <Navigate to="/login" />} />
          <Route path="/add-student" element={user ? <AddStudent user={user} /> : <Navigate to="/login" />} />
          <Route path="/users" element={user ? <UsersManagement user={user} /> : <Navigate to="/login" />} />
          <Route path="/quran-audio" element={user ? <QuranAudio /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
