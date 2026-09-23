import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin' || user.isMainAdmin;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('app:refresh'));
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  };

  const handleLogout = () => {
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
    <nav className="navbar navbar-expand-lg navbar-dark bg-success">
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/">
          🕌 مقرأة تحفيظ قرآن
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navMenu">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/">الرئيسية</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/quran-audio">🎧 المصحف المسموع</Link>
            </li>
            {isAdmin && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/add-student">إضافة طالب</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/users">إدارة المستخدمين</Link>
                </li>
              </>
            )}
          </ul>
          <div className="d-flex align-items-center gap-2">
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
