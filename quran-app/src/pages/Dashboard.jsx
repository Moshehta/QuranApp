import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';

export default function Dashboard({ user }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin' || user.isMainAdmin;

  useEffect(() => {
    loadStudents();
    const handleRefresh = () => loadStudents();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, []);

  const loadStudents = async () => {
    try {
      const res = await API.get('/students');
      // الطالب يتوجه مباشرة لصفحته الشخصية
      if (user.role === 'student' && res.data.length === 1) {
        navigate(`/student/${res.data[0].id}`, { replace: true });
        return;
      }
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (val) => {
    setSearch(val);
    if (val.trim().length >= 1) {
      const res = await API.get(`/students/search?q=${val}`);
      setStudents(res.data);
    } else {
      loadStudents();
    }
  };

  if (loading) return (
    <div className="d-flex justify-content-center mt-5">
      <div className="spinner-border text-success" />
    </div>
  );

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h4 className="fw-bold mb-0">📋 قائمة الطلاب</h4>
          <button
            className="btn btn-outline-secondary btn-sm py-0 px-2"
            onClick={loadStudents}
            title="تحديث قائمة الطلاب"
          >
            🔄 تحديث
          </button>
        </div>
        {isAdmin && (
          <Link to="/add-student" className="btn btn-success">
            ➕ إضافة طالب
          </Link>
        )}
      </div>

      <div className="mb-4">
        <input
          type="text"
          className="form-control form-control-lg"
          placeholder="🔍 ابحث باسم الطالب أو الكود..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {students.length === 0 ? (
        <div className="text-center text-muted py-5">
          <div style={{ fontSize: '3rem' }}>📭</div>
          <p>لا يوجد طلاب بعد</p>
        </div>
      ) : (
        <div className="row g-3">
          {students.map((student) => (
            <div className="col-md-6 col-lg-4" key={student.id}>
              <Link to={`/student/${student.id}`} className="text-decoration-none">
                <div className="card h-100 shadow-sm hover-card border-0">
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: 50, height: 50, fontSize: '1.2rem', flexShrink: 0 }}
                      >
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h6 className="mb-1 fw-bold text-dark">{student.name}</h6>
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          {student.studentCode}
                        </span>
                      </div>
                    </div>
                    {student.parentName && (
                      <p className="text-muted small mt-2 mb-0">
                        👨‍👦 {student.parentName}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
