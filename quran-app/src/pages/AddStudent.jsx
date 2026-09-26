import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddStudent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    age: '',
    phone: '',
    parentName: '',
    parentPhone: '',
    parentName2: '',
    parentPhone2: '',
    joinDate: getTodayDate()
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // التحقق من الحقول الإلزامية
    if (!form.name.trim()) {
      setError('يرجى إدخال اسم الطالب');
      return;
    }
    if (!form.age) {
      setError('يرجى إدخال سن الطالب');
      return;
    }
    if (!form.parentName.trim()) {
      setError('يرجى إدخال اسم ولي الأمر 1');
      return;
    }
    if (!form.parentPhone.trim()) {
      setError('يرجى إدخال رقم تليفون ولي الأمر 1');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/students', form);
      navigate(`/student/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في الإضافة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 650 }}>
      <div className="d-flex align-items-center gap-2 mb-4">
        <button className="btn btn-outline-secondary btn-sm px-3" onClick={() => navigate(-1)}>← رجوع</button>
        <h5 className="fw-bold mb-0">➕ إضافة طالب جديد</h5>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-body p-3 p-md-4">
          <form onSubmit={handleSubmit}>
            {/* 1. بيانات الطالب */}
            <div className="mb-3">
              <label className="form-label fw-bold">
                اسم الطالب <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="الاسم ثلاثي أو رباعي"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-sm-6">
                <label className="form-label fw-bold">
                  السن (بالسنوات) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="مثال: 12"
                  value={form.age}
                  onChange={e => set('age', e.target.value)}
                  min="3"
                  max="100"
                  required
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label fw-semibold text-muted">
                  رقم تليفون الطالب الشخصي (اختياري)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="01xxxxxxxxx"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>
            </div>

            {/* 2. قسم ولي الأمر 1 - إلزامي */}
            <div className="card border-success-subtle bg-success bg-opacity-10 p-3 mb-3 rounded-3">
              <h6 className="fw-bold text-success mb-3">👨‍👦 بيانات ولي الأمر 1 (إلزامي)</h6>
              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label fw-bold">
                    اسم ولي الأمر 1 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control bg-white"
                    placeholder="مثال: أحمد محمد (الوالد)"
                    value={form.parentName}
                    onChange={e => set('parentName', e.target.value)}
                    required
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label fw-bold">
                    رقم تليفون ولي الأمر 1 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control bg-white"
                    placeholder="01xxxxxxxxx"
                    value={form.parentPhone}
                    onChange={e => set('parentPhone', e.target.value)}
                    required
                  />
                </div>
              </div>
              <small className="text-muted mt-2 d-block">
                🔑 سيتم إنشاء حساب له تلقائياً باسم مستخدم = آخر 4 أرقام من هذا الهاتف، وباسورد: <code>123</code>.
              </small>
            </div>

            {/* 3. قسم ولي الأمر 2 - اختياري */}
            <div className="card border-primary-subtle bg-primary bg-opacity-10 p-3 mb-3 rounded-3">
              <h6 className="fw-bold text-primary mb-3">👩‍👦 بيانات ولي الأمر 2 (اختياري - الطرف الآخر للوالدين)</h6>
              <div className="row g-3">
                <div className="col-12 col-sm-6">
                  <label className="form-label fw-semibold">
                    اسم ولي الأمر 2
                  </label>
                  <input
                    type="text"
                    className="form-control bg-white"
                    placeholder="مثال: منى محمود (الوالدة)"
                    value={form.parentName2}
                    onChange={e => set('parentName2', e.target.value)}
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label fw-semibold">
                    رقم تليفون ولي الأمر 2
                  </label>
                  <input
                    type="text"
                    className="form-control bg-white"
                    placeholder="01xxxxxxxxx"
                    value={form.parentPhone2}
                    onChange={e => set('parentPhone2', e.target.value)}
                  />
                </div>
              </div>
              <small className="text-muted mt-2 d-block">
                إذا كُتب الهاتف، سيُنشأ له حساب مستقل بآخر 4 أرقام ليتابع الطالب هو الآخر.
              </small>
            </div>

            {/* 4. تاريخ الانضمام */}
            <div className="mb-4">
              <label className="form-label fw-semibold">📅 تاريخ الانضمام</label>
              <input
                type="date"
                className="form-control"
                value={form.joinDate}
                min={!user?.isMainAdmin ? new Date().toISOString().split('T')[0] : undefined}
                onChange={e => set('joinDate', e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-success w-100 py-2 fw-bold rounded-pill shadow-sm"
              disabled={loading}
            >
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              💾 إضافة الطالب وتوليد الحسابات
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
