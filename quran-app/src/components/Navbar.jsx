import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin' || user.isMainAdmin;
  const [refreshing, setRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('app:refresh'));
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
    navigate('/login');
  };

  const getRoleLabel = () => {
    if (user.role === 'admin') return 'أدمن';
    if (user.role === 'student_teacher' || user.role === 'superadmin') return 'طالب محفظ';
    if (user.role === 'parent') return 'ولي أمر';
    return 'طالب';
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-success shadow-sm">
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/" onClick={() => setIsOpen(false)}>
          🕌 مقرأة تحفيظ قرآن
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="تبديل القائمة"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse ${isOpen ? 'show' : ''}`} id="navMenu">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className="nav-link" to="/" onClick={() => setIsOpen(false)}>الرئيسية</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/quran-audio" onClick={() => setIsOpen(false)}>🎧 المصحف المسموع</Link>
            </li>
            {isAdmin && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/add-student" onClick={() => setIsOpen(false)}>إضافة طالب</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/users" onClick={() => setIsOpen(false)}>إدارة المستخدمين</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/student-assignments" onClick={() => setIsOpen(false)}>📋 توزيع الطلاب</Link>
                </li>
              </>
            )}
          </ul>
          <div className="d-flex align-items-center gap-2 flex-wrap pt-2 pt-lg-0 border-top border-white border-opacity-25 border-top-lg-0">
            <button
              className="btn btn-outline-light btn-sm d-flex align-items-center gap-1"
              onClick={handleRefresh}
              title="تحديث البيانات"
              disabled={refreshing}
            >
              <span className={refreshing ? 'spinner-border spinner-border-sm' : ''}>
                {!refreshing && '🔄'}
              </span>
              <span>تحديث</span>
            </button>
            <span className="text-white-50 small ms-1">
              {user.name} ({getRoleLabel()})
            </span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
