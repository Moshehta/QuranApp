import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api';
import { GRADES } from '../constants';

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AddSession({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = getTodayDate();

  const [student, setStudent] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [lastSessionMadiGrade, setLastSessionMadiGrade] = useState('');

  const [form, setForm] = useState({
    sessionDate: today,
    lawhText: '',
    lawhGrade: '',
    sihhaText: '',
    madiText: '',
    madiGrade: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStudentAndLastSession();
  }, [id]);

  const loadStudentAndLastSession = async () => {
    try {
      const [studentRes, sessionsRes] = await Promise.all([
        API.get(`/students/${id}`),
        API.get(`/sessions/student/${id}`)
      ]);
      setStudent(studentRes.data);
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const last = sessionsRes.data[sessionsRes.data.length - 1]; // أحدث جلسة
        setLastSession(last);
        setLastSessionMadiGrade(last.madiGrade || '');

        // 1. تعبئة اللوح تلقائياً بنص الصحة من الجلسة السابقة
        const prevSihha = last.sihhaText || (last.sihhaSurah ? `${last.sihhaSurah} (من ${last.sihhaFrom || 1} إلى ${last.sihhaTo || 'آخرها'})` : '');
        
        // 2. إذا كان تقدير ماضي الجلسة السابقة مسجلاً بالفعل كمتوسط أو ضعيف، نكرر نفس الماضي
        const shouldRepeatMadi = ['متوسط', 'ضعيف'].includes(last.madiGrade) && last.madiText;

        setForm(prev => ({
          ...prev,
          ...(prevSihha ? { lawhText: prevSihha } : {}),
          ...(shouldRepeatMadi ? { madiText: last.madiText } : {})
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  // عند تغيير تقدير اللوح: إذا كان ضعيف أو متوسط أو جيد، توضع نفس سورة/نص اللوح في الصحة تلقائياً للمرة القادمة
  const handleLawhGradeChange = (newGrade) => {
    setForm(prev => {
      const updated = { ...prev, lawhGrade: newGrade };
      if (['ضعيف', 'متوسط', 'جيد'].includes(newGrade) && prev.lawhText) {
        updated.sihhaText = prev.lawhText;
      }
      return updated;
    });
  };

  const handleLawhTextChange = (newText) => {
    setForm(prev => {
      const updated = { ...prev, lawhText: newText };
      if (['ضعيف', 'متوسط', 'جيد'].includes(prev.lawhGrade)) {
        updated.sihhaText = newText;
      }
      return updated;
    });
  };

  // اعتماد تقدير الماضي السابق: إذا كان متوسط أو ضعيف، يوضع نفس الماضي تلقائياً في خانة الماضي القادم مع إمكانية التعديل
  const handleLastSessionMadiGradeChange = (grade) => {
    setLastSessionMadiGrade(grade);
    if (['متوسط', 'ضعيف'].includes(grade) && lastSession?.madiText) {
      setForm(prev => ({
        ...prev,
        madiText: lastSession.madiText
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. إذا قام المحفظ بوضع تقدير لماضي الجلسة السابقة، نقوم بتحديثها فوراً
      if (lastSession && lastSessionMadiGrade && lastSessionMadiGrade !== lastSession.madiGrade) {
        await API.put(`/sessions/${lastSession.id}`, {
          ...lastSession,
          sessionDate: lastSession.sessionDate.split('T')[0],
          madiGrade: lastSessionMadiGrade
        });
      }

      // 2. تسجيل الجلسة الجديدة
      await API.post('/sessions', { studentId: id, ...form });
      navigate(`/student/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-3 py-md-4" style={{ maxWidth: 700 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button className="btn btn-outline-secondary btn-sm px-3" onClick={() => navigate(-1)}>← رجوع</button>
        <h5 className="fw-bold mb-0">
          ➕ تسجيل جلسة {student ? `(${student.name})` : ''}
        </h5>
        <div></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* كارت الجلسة السابقة */}
      {lastSession && (
        <div className="card shadow-sm border-primary-subtle bg-light mb-3 rounded-3">
          <div className="card-header bg-primary bg-opacity-10 py-2">
            <span className="small fw-bold text-primary">
              📋 بيانات الجلسة السابقة ({new Date(lastSession.sessionDate).toLocaleDateString('ar-EG')})
            </span>
          </div>
          <div className="card-body p-3 small">
            <div className="row g-2">
              <div className="col-12 col-sm-6">
                <strong>📌 الصحة السابقة:</strong>{' '}
                {lastSession.sihhaText || lastSession.sihhaSurah ? (
                  <span>{lastSession.sihhaText || `${lastSession.sihhaSurah} (${lastSession.sihhaFrom || 1} ➔ ${lastSession.sihhaTo || 'آخرها'})`}</span>
                ) : <span className="text-muted">لم تُحدد</span>}
              </div>
              <div className="col-12 col-sm-6">
                <strong>🔄 الماضي المطلوب:</strong>{' '}
                {lastSession.madiText || <span className="text-muted">لم يُحدد</span>}
              </div>
            </div>

            {/* تفاصيل التسميع التي سجلها الطالب المحفظ إن وُجدت */}
            {(lastSession.madiMistakes !== null || lastSession.madiFormations !== null || lastSession.madiHeardByName) && (
              <div className="mt-2 p-2 rounded bg-white border small">
                <span className="fw-bold text-dark me-2">🎧 نتائج التسميع:</span>
                <span className="badge bg-danger-subtle text-danger border border-danger-subtle me-2">
                  ❌ الأخطاء: {lastSession.madiMistakes ?? 0}
                </span>
                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle me-2">
                  🔤 التشكيلات: {lastSession.madiFormations ?? 0}
                </span>
                {lastSession.madiHeardByName && (
                  <span className="text-muted">
                    ✍️ إمضاء المُسمّع: <strong className="text-dark">{lastSession.madiHeardByName}</strong>
                  </span>
                )}
              </div>
            )}

            {/* تقييم ماضي الجلسة السابقة بواسطة الأدمن */}
            {lastSession.madiText && (
              <div className="mt-2 pt-2 border-top d-flex align-items-center gap-2 flex-wrap">
                <span className="fw-bold text-success">⭐ اعتماد تقدير هذا الماضي اليوم:</span>
                <select
                  className="form-select form-select-sm w-auto fw-bold"
                  value={lastSessionMadiGrade}
                  onChange={e => handleLastSessionMadiGradeChange(e.target.value)}
                >
                  <option value="">-- اختر التقدير النهائي --</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card shadow-sm border-0 mb-3 rounded-3">
          <div className="card-body p-3">
            <label className="form-label fw-semibold">📅 تاريخ جلسة اليوم</label>
            <input
              type="date"
              className="form-control"
              value={form.sessionDate}
              min={!user?.isMainAdmin ? new Date().toISOString().split('T')[0] : undefined}
              onChange={e => set('sessionDate', e.target.value)}
              required
            />
          </div>
        </div>

        {/* اللوح */}
        <div className="card shadow-sm border-0 mb-3 rounded-3">
          <div className="card-header bg-success-subtle fw-bold py-2">📖 اللوح (ما سمعه اليوم)</div>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small">نص ما سمعه في اللوح</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="مثال: من سورة الفجر لسورة الناس، أو سورة الفجر والبلد والشمس"
                  value={form.lawhText}
                  onChange={e => handleLawhTextChange(e.target.value)}
                />
              </div>
              <div className="col-12">
                <label className="form-label small">التقدير</label>
                <select
                  className="form-select"
                  value={form.lawhGrade}
                  onChange={e => handleLawhGradeChange(e.target.value)}
                >
                  <option value="">-- اختر التقدير --</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* الصحة */}
        <div className="card shadow-sm border-0 mb-3 rounded-3">
          <div className="card-header bg-primary-subtle fw-bold py-2">📌 الصحة (المطلوب للمرة القادمة)</div>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small">نص ما سيسمعه المرة القادمة</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="مثال: من سورة البلد لسورة الناس، أو سورة الفجر كاملة"
                  value={form.sihhaText}
                  onChange={e => set('sihhaText', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* الماضي للمرة القادمة */}
        <div className="card shadow-sm border-0 mb-3 rounded-3">
          <div className="card-header bg-warning-subtle fw-bold py-2">🔄 الماضي (المطلوب للمرة القادمة)</div>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label small">نص ما سيراجعه المرة القادمة</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="مثال: من سورة الضحى لسورة الناس"
                  value={form.madiText}
                  onChange={e => set('madiText', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ملاحظات */}
        <div className="card shadow-sm border-0 mb-4 rounded-3">
          <div className="card-body p-3">
            <label className="form-label fw-semibold small">📝 ملاحظات (اختياري)</label>
            <textarea className="form-control" rows={2} placeholder="أي ملاحظات إضافية..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn btn-success w-100 py-2 fw-bold rounded-pill shadow-sm" disabled={loading}>
          {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
          💾 حفظ الجلسة
        </button>
      </form>
    </div>
  );
}
