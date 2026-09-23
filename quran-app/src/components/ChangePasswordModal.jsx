import { useState } from 'react';
import API from '../api';

export default function ChangePasswordModal({ user, onClose, onChanged }) {
  const [choice, setChoice] = useState(null); // null | 'yes' | 'no'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeep = async () => {
    // المستخدم اختار إبقاء 123
    await API.post('/auth/change-password', { userId: user.id, newPassword: '123' });
    onChanged();
  };

  const handleChange = async () => {
    if (newPassword !== confirmPassword)
      return setError('كلمتا المرور غير متطابقتين');
    if (newPassword.length < 3)
      return setError('كلمة المرور قصيرة جداً');
    setLoading(true);
    try {
      await API.post('/auth/change-password', { userId: user.id, newPassword });
      onChanged();
    } catch {
      setError('حدث خطأ، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">🔐 تغيير كلمة المرور</h5>
          </div>
          <div className="modal-body text-center">
            {choice === null && (
              <>
                <p className="mb-4">أهلاً بك <strong>{user.name}</strong>! كلمة المرور الحالية هي <code>123</code></p>
                <p>هل تريد تغيير كلمة المرور؟</p>
                <div className="d-flex gap-3 justify-content-center mt-3">
                  <button className="btn btn-success px-4" onClick={() => setChoice('yes')}>نعم، أريد التغيير</button>
                  <button className="btn btn-outline-secondary px-4" onClick={handleKeep}>لا، إبقاء 123</button>
                </div>
              </>
            )}
            {choice === 'yes' && (
              <>
                <p className="mb-3">أدخل كلمة المرور الجديدة:</p>
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <input
                  type="password"
                  className="form-control mb-2"
                  placeholder="كلمة المرور الجديدة"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="form-control mb-3"
                  placeholder="تأكيد كلمة المرور"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button className="btn btn-success px-4" onClick={handleChange} disabled={loading}>
                  {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
