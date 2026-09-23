import { useState } from 'react';
import API from '../api';
import { useNavigate } from 'react-router-dom';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { username, password });
      onLogin(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow p-4" style={{ width: '100%', maxWidth: '420px' }}>
        <div className="text-center mb-4">
          <div style={{ fontSize: '3rem' }}>🕌</div>
          <h3 className="fw-bold text-success">مقرأة تحفيظ قرآن</h3>
          <p className="text-muted">تسجيل الدخول</p>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold">اسم المستخدم</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              required
            />
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold">كلمة المرور</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              required
            />
          </div>
          <button type="submit" className="btn btn-success w-100 py-2 fw-bold" disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
