import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../api';
import SURAHS, { GRADES, GRADE_COLORS } from '../constants';

const MONTHS_OPTIONS = [
  { label: 'آخر مرتين', value: 'last2' },
  { label: 'آخر شهر', value: '1' },
  { label: 'شهرين', value: '2' },
  { label: '3 شهور', value: '3' },
  { label: '4 شهور', value: '4' },
  { label: '5 شهور', value: '5' },
  { label: 'كل السجل', value: 'all' },
];

const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

export default function StudentProfile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [monthsFilter, setMonthsFilter] = useState('last2'); // الافتراضي آخر مرتين فقط
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [loading, setLoading] = useState(true);
  const isAdmin = user.role === 'admin' || user.isMainAdmin;
  const isStudentTeacher = user.role === 'student_teacher' || user.role === 'superadmin';
  const isExaminer = isAdmin || isStudentTeacher;

  // قائمة المُسمّعين المتاحين
  const [examiners, setExaminers] = useState([]);

  // حالة تسميع الماضي (للأدمن أو الطالب المحفظ)
  const [madiListeningSession, setMadiListeningSession] = useState(null);
  const [madiListeningForm, setMadiListeningForm] = useState({
    madiMistakes: 0,
    madiFormations: 0,
    madiHeardBy: user.id,
    madiHeardByName: user.name,
    madiGrade: ''
  });
  const [madiListeningLoading, setMadiListeningLoading] = useState(false);
  const [madiListeningError, setMadiListeningError] = useState('');

  // حالة تعديل الطالب
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', age: '', phone: '', parentName: '', parentPhone: '', parentName2: '', parentPhone2: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // حالة تعديل الجلسة
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: '',
    lawhText: '', lawhGrade: '',
    sihhaSurah: '', sihhaFrom: '', sihhaTo: '',
    madiText: '', madiGrade: '',
    notes: ''
  });
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // حالة تقييم سريع للماضي
  const [quickMadiSession, setQuickMadiSession] = useState(null);
  const [quickGrade, setQuickGrade] = useState('');

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [id, monthsFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentRes, sessionsRes, paymentsRes] = await Promise.all([
        API.get(`/students/${id}`),
        API.get(`/sessions/student/${id}?months=${monthsFilter}`),
        API.get(`/payments/student/${id}`),
      ]);
      setStudent(studentRes.data);
      setSessions(sessionsRes.data);
      setPayments(paymentsRes.data);

      if (isExaminer) {
        API.get('/users/examiners').then(r => setExaminers(r.data)).catch(() => {});
      }
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const openMadiListeningModal = (s) => {
    setMadiListeningSession(s);
    setMadiListeningForm({
      madiMistakes: s.madiMistakes !== null && s.madiMistakes !== undefined ? s.madiMistakes : 0,
      madiFormations: s.madiFormations !== null && s.madiFormations !== undefined ? s.madiFormations : 0,
      madiHeardBy: s.madiHeardBy || user.id,
      madiHeardByName: s.madiHeardByName || user.name,
      madiGrade: s.madiGrade || ''
    });
    setMadiListeningError('');
  };

  const handleSaveMadiListening = async (e) => {
    e.preventDefault();
    setMadiListeningLoading(true);
    setMadiListeningError('');
    try {
      await API.post(`/sessions/${madiListeningSession.id}/madi`, madiListeningForm);
      setMadiListeningSession(null);
      loadData();
    } catch (err) {
      setMadiListeningError(err.response?.data?.message || 'حدث خطأ في حفظ تسميع الماضي');
    } finally {
      setMadiListeningLoading(false);
    }
  };

  const togglePayment = async (year, month, isPaid) => {
    await API.post('/payments/toggle', { studentId: id, paymentYear: year, paymentMonth: month, isPaid: !isPaid });
    loadData();
  };

  const deleteSession = async (sessionId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;
    await API.delete(`/sessions/${sessionId}`);
    loadData();
  };

  const openEditModal = () => {
    setEditForm({
      name: student.name || '',
      age: student.age || '',
      phone: student.phone || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      parentName2: student.parentName2 || '',
      parentPhone2: student.parentPhone2 || ''
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      await API.put(`/students/${id}`, editForm);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'حدث خطأ في حفظ التعديلات');
    } finally {
      setEditLoading(false);
    }
  };

  // فتح نافذة تعديل الجلسة
  const openEditSessionModal = (s) => {
    setEditingSession(s);
    setSessionForm({
      sessionDate: s.sessionDate ? s.sessionDate.split('T')[0] : '',
      lawhText: s.lawhText || (s.lawhSurah ? `${s.lawhSurah} (${s.lawhFrom || 1} ➔ ${s.lawhTo || 'آخرها'})` : ''),
      lawhGrade: s.lawhGrade || '',
      sihhaText: s.sihhaText || (s.sihhaSurah ? `${s.sihhaSurah} (${s.sihhaFrom || 1} ➔ ${s.sihhaTo || 'آخرها'})` : ''),
      madiText: s.madiText || '',
      madiGrade: s.madiGrade || '',
      notes: s.notes || ''
    });
    setSessionError('');
  };

  const handleUpdateSession = async (e) => {
    e.preventDefault();
    setSessionLoading(true);
    setSessionError('');
    try {
      await API.put(`/sessions/${editingSession.id}`, sessionForm);
      setEditingSession(null);
      loadData();
    } catch (err) {
      setSessionError(err.response?.data?.message || 'حدث خطأ في تعديل الجلسة');
    } finally {
      setSessionLoading(false);
    }
  };

  // حفظ تقييم الماضي السريع
  const handleSaveQuickMadiGrade = async () => {
    if (!quickMadiSession || !quickGrade) return;
    try {
      await API.put(`/sessions/${quickMadiSession.id}`, {
        ...quickMadiSession,
        sessionDate: quickMadiSession.sessionDate.split('T')[0],
        madiGrade: quickGrade
      });
      setQuickMadiSession(null);
      setQuickGrade('');
      loadData();
    } catch (err) {
      alert('حدث خطأ في حفظ التقدير');
    }
  };

  const getLast6Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return months;
  };

  const getPaymentStatus = (year, month) => {
    const p = payments.find(p => p.paymentYear === year && p.paymentMonth === month);
    return p ? p.isPaid : false;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-success" /></div>;
  if (!student) return null;

  return (
    <div className="container py-3 py-md-4" style={{ maxWidth: 900 }}>
      {/* بيانات الطالب */}
      <div className="card shadow-sm border-0 mb-3 mb-md-4 rounded-3">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-3">
            <div className="d-flex gap-3 align-items-center">
              <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold shadow-sm"
                style={{ width: 55, height: 55, fontSize: '1.4rem', flexShrink: 0 }}>
                {student.name.charAt(0)}
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h4 className="fw-bold mb-0 text-dark">{student.name}</h4>
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                    {student.studentCode}
                  </span>
                </div>
                <div className="text-muted small mt-1">
                  {student.age && <span className="me-2">🎂 {student.age} سنة</span>}
                  {student.phone && <span className="me-2">📞 {student.phone}</span>}
                </div>
                <div className="mt-1 small">
                  {student.parentName && (
                    <div className="text-muted">
                      👨‍👦 ولي الأمر 1: <strong>{student.parentName}</strong> <span className="text-dark">({student.parentPhone})</span>
                    </div>
                  )}
                  {student.parentPhone2 && (
                    <div className="text-muted">
                      👩‍👦 ولي الأمر 2: <strong>{student.parentName2 || 'إضافي'}</strong> <span className="text-dark">({student.parentPhone2})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 w-100 w-sm-auto justify-content-end align-items-center flex-wrap">
              <button className="btn btn-outline-secondary btn-sm px-2" onClick={loadData} title="تحديث البيانات">
                🔄 تحديث
              </button>
              {isAdmin && (
                <>
                  <button className="btn btn-outline-primary btn-sm px-3" onClick={openEditModal}>
                    ✏️ تعديل
                  </button>
                  <Link to={`/student/${id}/add-session`} className="btn btn-success btn-sm px-3 fw-bold">
                    ➕ جلسة جديدة
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة تعديل بيانات الطالب */}
      {showEditModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
          <div className="modal-dialog modal-dialog-centered my-4">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">✏️ تعديل بيانات الطالب</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
              </div>
              <form onSubmit={handleUpdateStudent}>
                <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  {editError && <div className="alert alert-danger">{editError}</div>}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">اسم الطالب *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.name}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">السن *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={editForm.age}
                        onChange={e => setEditForm(prev => ({ ...prev, age: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">رقم تليفون الطالب</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editForm.phone}
                        onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* ولي الأمر 1 */}
                  <div className="p-2 mb-3 bg-light rounded border">
                    <h6 className="fw-bold small text-success mb-2">👨‍👦 ولي الأمر 1 (إلزامي)</h6>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small fw-semibold">اسم ولي الأمر 1 *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-white"
                          value={editForm.parentName}
                          onChange={e => setEditForm(prev => ({ ...prev, parentName: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold">رقم تليفون 1 *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-white"
                          value={editForm.parentPhone}
                          onChange={e => setEditForm(prev => ({ ...prev, parentPhone: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* ولي الأمر 2 */}
                  <div className="p-2 mb-3 bg-light rounded border">
                    <h6 className="fw-bold small text-primary mb-2">👩‍👦 ولي الأمر 2 (اختياري)</h6>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small fw-semibold">اسم ولي الأمر 2</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-white"
                          placeholder="الطرف الآخر"
                          value={editForm.parentName2}
                          onChange={e => setEditForm(prev => ({ ...prev, parentName2: e.target.value }))}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold">رقم تليفون 2</label>
                        <input
                          type="text"
                          className="form-control form-control-sm bg-white"
                          placeholder="اختياري"
                          value={editForm.parentPhone2}
                          onChange={e => setEditForm(prev => ({ ...prev, parentPhone2: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>إلغاء</button>
                  <button type="submit" className="btn btn-primary px-4 fw-bold" disabled={editLoading}>
                    {editLoading ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تعديل الجلسة بالكامل */}
      {editingSession && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060, overflowY: 'auto' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg my-4">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">✏️ تعديل بيانات الجلسة</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingSession(null)}></button>
              </div>
              <form onSubmit={handleUpdateSession}>
                <div className="modal-body p-3 p-md-4" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                  {sessionError && <div className="alert alert-danger">{sessionError}</div>}

                  <div className="mb-3">
                    <label className="form-label fw-semibold">📅 تاريخ الجلسة</label>
                    <input
                      type="date"
                      className="form-control"
                      value={sessionForm.sessionDate}
                      onChange={e => setSessionForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                      required
                    />
                  </div>

                  {/* تعديل اللوح */}
                  <div className="card mb-3 border-success-subtle bg-success-subtle bg-opacity-10">
                    <div className="card-header bg-success bg-opacity-25 fw-bold">📖 اللوح (ما سمعه في الجلسة)</div>
                    <div className="card-body">
                      <div className="row g-2">
                        <div className="col-12">
                          <label className="form-label small">نص ما سمعه في اللوح (يمكن كتابة أكثر من سورة)</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            placeholder="مثال: من سورة الفجر لسورة الناس، أو سورة الفجر والبلد والشمس"
                            value={sessionForm.lawhText}
                            onChange={e => {
                              const val = e.target.value;
                              setSessionForm(prev => {
                                const upd = { ...prev, lawhText: val };
                                if (['ضعيف', 'متوسط', 'جيد'].includes(prev.lawhGrade)) upd.sihhaText = val;
                                return upd;
                              });
                            }}
                          />
                        </div>
                        <div className="col-12">
                          <label className="form-label small">التقدير</label>
                          <select
                            className="form-select form-select-sm"
                            value={sessionForm.lawhGrade}
                            onChange={e => {
                              const val = e.target.value;
                              setSessionForm(prev => {
                                const upd = { ...prev, lawhGrade: val };
                                if (['ضعيف', 'متوسط', 'جيد'].includes(val) && prev.lawhText) {
                                  upd.sihhaText = prev.lawhText;
                                }
                                return upd;
                              });
                            }}
                          >
                            <option value="">-- اختر التقدير --</option>
                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* تعديل الصحة */}
                  <div className="card mb-3 border-primary-subtle bg-primary-subtle bg-opacity-10">
                    <div className="card-header bg-primary bg-opacity-25 fw-bold">
                      📌 الصحة (المطلوب للمرة القادمة)
                    </div>
                    <div className="card-body">
                      <div className="row g-2">
                        <div className="col-12">
                          <label className="form-label small">نص ما سيسمعه المرة القادمة</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            placeholder="مثال: من سورة الفجر لسورة الناس"
                            value={sessionForm.sihhaText}
                            onChange={e => setSessionForm(prev => ({ ...prev, sihhaText: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* تعديل الماضي */}
                  <div className="card mb-3 border-warning-subtle bg-warning-subtle bg-opacity-10">
                    <div className="card-header bg-warning bg-opacity-25 fw-bold">🔄 الماضي (المراجعة)</div>
                    <div className="card-body">
                      <div className="mb-2">
                        <label className="form-label small">نص الماضي المطلوب</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={sessionForm.madiText}
                          onChange={e => setSessionForm(prev => ({ ...prev, madiText: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="form-label small">تقدير تسميع الماضي</label>
                        <select
                          className="form-select form-select-sm"
                          value={sessionForm.madiGrade}
                          onChange={e => setSessionForm(prev => ({ ...prev, madiGrade: e.target.value }))}
                        >
                          <option value="">-- لم يُقيّم بعد / اختر التقدير --</option>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ملاحظات */}
                  <div>
                    <label className="form-label small fw-semibold">📝 ملاحظات</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={sessionForm.notes}
                      onChange={e => setSessionForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingSession(null)}>إلغاء</button>
                  <button type="submit" className="btn btn-success" disabled={sessionLoading}>
                    {sessionLoading ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تسجيل تسميع الماضي (الأخطاء والتشكيلات وإمضاء المُسمّع) */}
      {madiListeningSession && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1065 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">🎧 تسجيل تسميع الماضي ({student.name})</h5>
                <button type="button" className="btn-close" onClick={() => setMadiListeningSession(null)}></button>
              </div>
              <form onSubmit={handleSaveMadiListening}>
                <div className="modal-body p-3">
                  {madiListeningError && <div className="alert alert-danger">{madiListeningError}</div>}

                  <div className="alert alert-light border mb-3">
                    <div className="small text-muted mb-1">
                      📅 جلسة: <strong>{new Date(madiListeningSession.sessionDate).toLocaleDateString('ar-EG')}</strong>
                    </div>
                    <div className="fw-bold text-dark">
                      🔄 الماضي المطلوب: {madiListeningSession.madiText || <span className="text-muted">لم يُحدد نص</span>}
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    {/* عدد الأخطاء من 0 إلى 10 */}
                    <div className="col-6">
                      <label className="form-label fw-bold small text-danger">❌ عدد الأخطاء (0 - 10):</label>
                      <select
                        className="form-select form-select-lg text-center fw-bold border-danger-subtle"
                        value={madiListeningForm.madiMistakes}
                        onChange={e => setMadiListeningForm(prev => ({ ...prev, madiMistakes: parseInt(e.target.value, 10) }))}
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>
                            {n} {n === 0 ? '(بدون أخطاء)' : n === 1 ? 'خطأ واحد' : n === 2 ? 'خطآن' : 'أخطاء'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* عدد التشكيلات من 0 إلى 10 */}
                    <div className="col-6">
                      <label className="form-label fw-bold small text-warning-emphasis">🔤 عدد التشكيلات (0 - 10):</label>
                      <select
                        className="form-select form-select-lg text-center fw-bold border-warning-subtle"
                        value={madiListeningForm.madiFormations}
                        onChange={e => setMadiListeningForm(prev => ({ ...prev, madiFormations: parseInt(e.target.value, 10) }))}
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <option key={n} value={n}>
                            {n} {n === 0 ? '(صحيح تماماً)' : n === 1 ? 'تشكيل واحد' : n === 2 ? 'تشكيلان' : 'تشكيلات'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* إمضاء المُسمّع */}
                  {!isAdmin ? (
                    <div className="mb-3 p-2 rounded bg-light border">
                      <label className="form-label fw-bold small text-muted mb-1 d-block">✍️ إمضاء المُسمّع:</label>
                      <div className="fw-bold text-dark fs-6">
                        {user.name}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <label className="form-label fw-bold small">✍️ إمضاء المُسمّع:</label>
                      <select
                        className="form-select"
                        value={madiListeningForm.madiHeardBy}
                        onChange={e => {
                          const selectedId = parseInt(e.target.value, 10);
                          const ex = examiners.find(x => x.id === selectedId);
                          setMadiListeningForm(prev => ({
                            ...prev,
                            madiHeardBy: selectedId,
                            madiHeardByName: ex ? ex.name : prev.madiHeardByName
                          }));
                        }}
                      >
                        {examiners.map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* إذا كان المستخدم أدمن، يمكنه وضع التقدير النهائي من هنا أيضاً إن أراد */}
                  {isAdmin && (
                    <div className="p-2 rounded bg-light border mb-2">
                      <label className="form-label fw-bold small text-success">⭐ التقدير النهائي (صلاحية الأدمن):</label>
                      <select
                        className="form-select form-select-sm"
                        value={madiListeningForm.madiGrade}
                        onChange={e => setMadiListeningForm(prev => ({ ...prev, madiGrade: e.target.value }))}
                      >
                        <option value="">-- تركه بانتظار الاعتماد / اختر التقدير --</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="modal-footer bg-light p-2 justify-content-between">
                  <button type="button" className="btn btn-secondary" onClick={() => setMadiListeningSession(null)}>إلغاء</button>
                  <button type="submit" className="btn btn-success px-4 fw-bold" disabled={madiListeningLoading}>
                    {madiListeningLoading ? 'جاري الحفظ...' : '💾 حفظ التسميع'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* نافذة التقييم السريع للماضي (للأدمن) */}
      {quickMadiSession && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-warning text-dark">
                <h6 className="modal-title fw-bold">⭐ اعتماد تقدير تسميع الماضي</h6>
                <button type="button" className="btn-close" onClick={() => setQuickMadiSession(null)}></button>
              </div>
              <div className="modal-body text-center p-3">
                <p className="small text-muted mb-2">
                  جلسة: <strong>{new Date(quickMadiSession.sessionDate).toLocaleDateString('ar-EG')}</strong>
                </p>
                <div className="alert alert-light border small text-dark mb-2 p-2">
                  🔄 <strong>الماضي:</strong> {quickMadiSession.madiText || 'بدون نص محدد'}
                </div>

                {/* إحصائيات التسميع المسجلة للطالب */}
                <div className="p-2 mb-3 bg-light rounded border text-start small">
                  <div className="d-flex justify-content-between mb-1">
                    <span>❌ عدد الأخطاء:</span>
                    <strong className="text-danger">{quickMadiSession.madiMistakes !== null && quickMadiSession.madiMistakes !== undefined ? quickMadiSession.madiMistakes : 'لم يُسجل'}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span>🔤 عدد التشكيلات:</span>
                    <strong className="text-warning-emphasis">{quickMadiSession.madiFormations !== null && quickMadiSession.madiFormations !== undefined ? quickMadiSession.madiFormations : 'لم يُسجل'}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>✍️ إمضاء المُسمّع:</span>
                    <strong className="text-dark">{quickMadiSession.madiHeardByName || 'غير محدد'}</strong>
                  </div>
                </div>

                <label className="form-label fw-bold small">اختر التقدير المستحق:</label>
                <div className="d-grid gap-2">
                  {GRADES.map(g => (
                    <button
                      key={g}
                      type="button"
                      className={`btn btn-sm ${quickGrade === g ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                      onClick={() => setQuickGrade(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-footer p-2 justify-content-between">
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setQuickMadiSession(null)}>إلغاء</button>
                <button type="button" className="btn btn-sm btn-success px-3" onClick={handleSaveQuickMadiGrade} disabled={!quickGrade}>
                  حفظ التقدير
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* المدفوعات — للأدمن فقط */}
      {isAdmin && (
        <div className="card shadow-sm border-0 mb-3 mb-md-4 rounded-3">
          <div className="card-header bg-white py-2 fw-bold d-flex align-items-center gap-2">
            <span>💰 المدفوعات الشهرية</span>
            <small className="text-muted fw-normal">(اضغط لتغيير الحالة)</small>
          </div>
          <div className="card-body p-3">
            <div className="d-flex flex-wrap gap-2">
              {getLast6Months().map(({ year, month }) => {
                const paid = getPaymentStatus(year, month);
                return (
                  <button
                    key={`${year}-${month}`}
                    className={`btn btn-sm rounded-pill px-3 ${paid ? 'btn-success' : 'btn-outline-danger'}`}
                    onClick={() => togglePayment(year, month, paid)}
                  >
                    {paid ? '✅ تم الدفع' : '❌ لم يدفع'} - {MONTH_NAMES[month - 1]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* سجل الجلسات */}
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white py-3">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold fs-5">📖 سجل التسميع</span>
              <span className="badge bg-secondary rounded-pill">{sessions.length} جلسة</span>
            </div>

            <div className="d-flex gap-2 flex-wrap align-items-center w-100 w-sm-auto justify-content-between justify-content-sm-end">
              {/* التبديل بين العرضين */}
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${viewMode === 'cards' ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('cards')}
                  title="عرض البطاقات الحديث (المناسب للموبايل)"
                >
                  📱 بطاقات
                </button>
                <button
                  className={`btn ${viewMode === 'table' ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('table')}
                  title="عرض الجدول"
                >
                  💻 جدول
                </button>
              </div>

              {/* الفلتر الزمني */}
              <select
                className="form-select form-select-sm w-auto"
                value={monthsFilter}
                onChange={e => setMonthsFilter(e.target.value)}
              >
                {MONTHS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-2 p-md-3">
          {sessions.length === 0 ? (
            <div className="text-center text-muted py-5">
              <div style={{ fontSize: '2.5rem' }}>📭</div>
              <p className="mt-2 mb-0">لا توجد جلسات مسجلة في هذه الفترة</p>
            </div>
          ) : viewMode === 'cards' ? (
            /* =================== عرض البطاقات الذكي للموبايل =================== */
            <div className="d-flex flex-column gap-3">
              {sessions.map((s) => (
                <div key={s.id} className="card border-0 shadow-sm rounded-3 overflow-hidden bg-light bg-opacity-50">
                  {/* رأس الكارت */}
                  <div className="card-header bg-white py-2 px-3 d-flex justify-content-between align-items-center border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-dark-subtle text-dark border px-2 py-1">
                        📅 {formatDate(s.sessionDate)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-primary py-0 px-2"
                          onClick={() => openEditSessionModal(s)}
                          title="تعديل الجلسة"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger py-0 px-2"
                          onClick={() => deleteSession(s.id)}
                          title="حذف الجلسة"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* جسم الكارت: اللوح والصحة والماضي */}
                  <div className="card-body p-3">
                    <div className="row g-2">
                      {/* اللوح */}
                      <div className="col-12 col-md-4">
                        <div className="p-2 rounded-2 bg-white border h-100 shadow-2xs">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold small text-success">📖 اللوح (اليوم)</span>
                            {s.lawhGrade ? (
                              <span className={`badge bg-${GRADE_COLORS[s.lawhGrade]}`}>
                                {s.lawhGrade}
                              </span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-muted">بدون تقدير</span>
                            )}
                          </div>
                          <div className="fw-semibold text-dark">
                            {s.lawhText || s.lawhSurah ? (
                              <span>{s.lawhText || `${s.lawhSurah} (${s.lawhFrom || 1} ➔ ${s.lawhTo || 'آخرها'})`}</span>
                            ) : (
                              <span className="text-muted small">لم يُسجل</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* الصحة */}
                      <div className="col-12 col-md-4">
                        <div className="p-2 rounded-2 bg-white border h-100 shadow-2xs">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold small text-primary">📌 الصحة (القادمة)</span>
                          </div>
                          <div className="fw-semibold text-dark">
                            {s.sihhaText || s.sihhaSurah ? (
                              <span>{s.sihhaText || `${s.sihhaSurah} (${s.sihhaFrom || 1} ➔ ${s.sihhaTo || 'آخرها'})`}</span>
                            ) : (
                              <span className="text-muted small">لم يُحدد</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* الماضي */}
                      <div className="col-12 col-md-4">
                        <div className="p-2 rounded-2 bg-white border h-100 shadow-2xs">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold small text-warning-emphasis">🔄 الماضي</span>
                            {s.madiGrade ? (
                              <span className={`badge bg-${GRADE_COLORS[s.madiGrade]}`}>
                                ⭐ {s.madiGrade}
                              </span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-muted">لم يُعتمد بعد</span>
                            )}
                          </div>
                          <div className="small text-dark fw-semibold mb-1" style={{ wordBreak: 'break-word' }}>
                            {s.madiText || <span className="text-muted fw-normal">لا يوجد ماضي مسجل</span>}
                          </div>

                          {/* إحصائيات التسميع إن وُجدت */}
                          {(s.madiMistakes !== null || s.madiFormations !== null || s.madiHeardByName) && (
                            <div className="p-1 px-2 rounded bg-light border small text-muted mb-2" style={{ fontSize: '0.78rem' }}>
                              <div>
                                <span>❌ أخطاء: <strong className="text-danger">{s.madiMistakes ?? 0}</strong></span>
                                <span className="mx-1">|</span>
                                <span>🔤 تشكيلات: <strong className="text-warning-emphasis">{s.madiFormations ?? 0}</strong></span>
                              </div>
                              {s.madiHeardByName && (
                                <div className="mt-1 text-truncate">
                                  ✍️ المُسمّع: <strong className="text-dark">{s.madiHeardByName}</strong>
                                </div>
                              )}
                            </div>
                          )}

                          {/* أزرار الإجراءات على الماضي */}
                          <div className="d-flex gap-1 flex-wrap mt-2">
                            {isExaminer && (
                              <button
                                type="button"
                                className="btn btn-outline-warning btn-sm py-0 px-2 small fw-bold"
                                style={{ fontSize: '0.75rem' }}
                                disabled={isStudentTeacher && student.isSelfOrSibling}
                                title={isStudentTeacher && student.isSelfOrSibling ? 'ممنوع التسميع للنفس أو الإخوة' : 'تسجيل التسميع'}
                                onClick={() => openMadiListeningModal(s)}
                              >
                                🎧 {s.madiMistakes !== null ? 'تعديل التسميع' : 'تسميع الماضي'}
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                className={`btn btn-sm py-0 px-2 small fw-bold ${s.madiGrade ? 'btn-outline-success' : 'btn-warning text-dark'}`}
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => {
                                  setQuickMadiSession(s);
                                  setQuickGrade(s.madiGrade || '');
                                }}
                              >
                                {s.madiGrade ? 'تعديل التقدير' : '⭐ اعتماد التقدير'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {s.notes && (
                      <div className="mt-2 text-muted small bg-white p-2 rounded border">
                        💬 <strong>ملاحظة:</strong> {s.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* =================== عرض الجدول التقليدي =================== */
            <div className="table-responsive">
              <table className="table table-hover mb-0 text-center align-middle">
                <thead className="table-light">
                  <tr>
                    <th>التاريخ</th>
                    <th>اللوح</th>
                    <th>تقدير اللوح</th>
                    <th>الصحة</th>
                    <th>الماضي</th>
                    <th>تقدير الماضي</th>
                    {isAdmin && <th>إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="fw-semibold small">{new Date(s.sessionDate).toLocaleDateString('ar-EG')}</td>
                      <td>
                        {s.lawhText || (s.lawhSurah ? `${s.lawhSurah} (${s.lawhFrom || 1}→${s.lawhTo || '?'})` : '-')}
                      </td>
                      <td>
                        {s.lawhGrade ? (
                          <span className={`badge bg-${GRADE_COLORS[s.lawhGrade]}`}>{s.lawhGrade}</span>
                        ) : '-'}
                      </td>
                      <td>
                        {s.sihhaText || (s.sihhaSurah ? `${s.sihhaSurah} (${s.sihhaFrom || 1}→${s.sihhaTo || '?'})` : '-')}
                      </td>
                      <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>
                        <div>{s.madiText || '-'}</div>
                        {(s.madiMistakes !== null || s.madiFormations !== null) && (
                          <div className="badge bg-light text-dark border mt-1" style={{ fontSize: '0.72rem' }}>
                            أخطاء: {s.madiMistakes ?? 0} | تشكيلات: {s.madiFormations ?? 0}
                            {s.madiHeardByName && ` (${s.madiHeardByName})`}
                          </div>
                        )}
                      </td>
                      <td>
                        {s.madiGrade ? (
                          <span className={`badge bg-${GRADE_COLORS[s.madiGrade]}`}>{s.madiGrade}</span>
                        ) : (
                          <span className="text-muted small">قيد التسميع</span>
                        )}
                        <div className="d-flex justify-content-center gap-1 mt-1">
                          {isExaminer && (
                            <button
                              className="btn btn-sm btn-outline-warning py-0 px-1"
                              style={{ fontSize: '0.72rem' }}
                              disabled={isStudentTeacher && student.isSelfOrSibling}
                              onClick={() => openMadiListeningModal(s)}
                            >
                              🎧 تسميع
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className="btn btn-sm btn-warning py-0 px-1 text-dark fw-bold"
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => {
                                setQuickMadiSession(s);
                                setQuickGrade(s.madiGrade || '');
                              }}
                            >
                              ⭐ تقدير
                            </button>
                          )}
                        </div>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="d-flex justify-content-center gap-1">
                            <button
                              className="btn btn-sm btn-outline-primary py-0 px-2"
                              title="تعديل"
                              onClick={() => openEditSessionModal(s)}
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger py-0 px-2"
                              title="حذف"
                              onClick={() => deleteSession(s.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
