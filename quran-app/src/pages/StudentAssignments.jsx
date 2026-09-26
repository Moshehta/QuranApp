import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

export default function StudentAssignments({ user }) {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // المستخدم المختار
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('student_teacher');
  const [userSearch, setUserSearch] = useState('');

  // الطلاب المحددين للمستخدم المختار
  const [assignedStudentIds, setAssignedStudentIds] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // بحث وفلترة الطلاب
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    if (!user || (user.role !== 'admin' && !user.isMainAdmin)) {
      navigate('/');
      return;
    }
    loadInitialData();

    const handleRefresh = () => loadInitialData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [usersRes, studentsRes] = await Promise.all([
        API.get('/users'),
        API.get('/students'),
      ]);
      setUsers(usersRes.data || []);
      setStudents(studentsRes.data || []);

      if (!selectedUserId) {
        const firstStudentTeacher = usersRes.data.find(
          u => u.role === 'student_teacher' || u.role === 'superadmin'
        );
        if (firstStudentTeacher) {
          setSelectedUserId(String(firstStudentTeacher.id));
        } else if (usersRes.data.length > 0) {
          setSelectedUserId(String(usersRes.data[0].id));
        }
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'فشل في تحميل البيانات من الخادم' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedUserId) {
      setAssignedStudentIds([]);
      return;
    }
    loadUserAssignments(selectedUserId);
  }, [selectedUserId]);

  const loadUserAssignments = async (userId) => {
    setLoadingAssignments(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await API.get(`/users/${userId}/students`);
      const ids = (res.data || []).map(s => s.id);
      setAssignedStudentIds(ids);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'تعذر جلب طلاب هذا المستخدم' });
    } finally {
      setLoadingAssignments(false);
    }
  };

  const selectedUser = users.find(u => String(u.id) === String(selectedUserId));

  const filteredUsers = users.filter(u => {
    const matchesRole =
      userRoleFilter === 'all'
        ? true
        : userRoleFilter === 'student_teacher'
        ? u.role === 'student_teacher' || u.role === 'superadmin'
        : u.role === userRoleFilter;

    const matchesSearch =
      !userSearch.trim() ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase());

    return matchesRole && matchesSearch;
  });

  const filteredStudents = students.filter(s => {
    if (!studentSearch.trim()) return true;
    const query = studentSearch.trim().toLowerCase();
    const nameMatch = s.name.toLowerCase().includes(query);
    const codeMatch = s.studentCode && s.studentCode.toLowerCase().includes(query);
    return nameMatch || codeMatch;
  });

  const toggleStudent = (id) => {
    setAssignedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const idsToAdd = filteredStudents.map(s => s.id);
    setAssignedStudentIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAll = () => {
    const idsToRemove = new Set(filteredStudents.map(s => s.id));
    setAssignedStudentIds(prev => prev.filter(id => !idsToRemove.has(id)));
  };

  const handleClearAll = () => {
    setAssignedStudentIds([]);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setFeedback({ type: '', text: '' });
    try {
      await API.put(`/users/${selectedUserId}/assignments`, {
        studentIds: assignedStudentIds,
      });
      setFeedback({
        type: 'success',
        text: `تم حفظ توزيع الطلاب للمستخدم "${selectedUser?.name || ''}" بنجاح`,
      });
      setTimeout(() => {
        setFeedback(prev => (prev.type === 'success' ? { type: '', text: '' } : prev));
      }, 3500);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'حدث خطأ أثناء حفظ التوزيع',
      });
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role) => {
    if (role === 'admin') return 'أدمن';
    if (role === 'student_teacher' || role === 'superadmin') return 'طالب محفظ';
    if (role === 'parent') return 'ولي أمر';
    if (role === 'student') return 'طالب';
    return role;
  };

  const getRoleBadgeClass = (role) => {
    if (role === 'admin') return 'bg-danger';
    if (role === 'student_teacher' || role === 'superadmin') return 'bg-primary';
    if (role === 'parent') return 'bg-info text-dark';
    return 'bg-secondary';
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-success" />
      </div>
    );
  }

  const isTeacher =
    selectedUser?.role === 'student_teacher' || selectedUser?.role === 'superadmin';
  const isAdminUser = selectedUser?.role === 'admin';

  return (
    <div className="container py-3 py-md-4" style={{ maxWidth: 1100, paddingBottom: 85 }}>
      {/* عنوان الصفحة */}
      <div className="card shadow-sm border-0 mb-3 rounded-3 bg-success text-white">
        <div className="card-body p-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="fs-4">📋</span>
            <h5 className="fw-bold mb-0">توزيع وصلاحيات الطلاب</h5>
          </div>
          <button
            className="btn btn-sm btn-light text-success fw-bold px-3 py-1 rounded-pill shadow-sm"
            onClick={loadInitialData}
            title="تحديث البيانات"
          >
            🔄 تحديث
          </button>
        </div>
      </div>

      {/* تنبيه بالرسائل */}
      {feedback.text && (
        <div
          className={`alert alert-${feedback.type} alert-dismissible fade show shadow-sm rounded-3 d-flex align-items-center justify-content-between py-2 px-3 mb-3`}
          role="alert"
        >
          <div className="small fw-semibold">
            {feedback.type === 'success' ? '✅ ' : '⚠️ '}
            {feedback.text}
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setFeedback({ type: '', text: '' })}
          />
        </div>
      )}

      {/* قسم اختيار المستخدم على الموبايل (مضغوط وسلس جداً) */}
      <div className="d-block d-lg-none card shadow-sm border-0 rounded-3 mb-3 p-3">
        <label className="form-label fw-bold small text-dark mb-2">1️⃣ اختر المستخدم:</label>
        
        {/* أزرار الفلترة السريعة */}
        <div className="btn-group w-100 mb-2" role="group">
          <button
            type="button"
            className={`btn btn-sm ${userRoleFilter === 'student_teacher' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setUserRoleFilter('student_teacher')}
          >
            محفظين
          </button>
          <button
            type="button"
            className={`btn btn-sm ${userRoleFilter === 'parent' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setUserRoleFilter('parent')}
          >
            أولياء أمور
          </button>
          <button
            type="button"
            className={`btn btn-sm ${userRoleFilter === 'student' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setUserRoleFilter('student')}
          >
            طلاب
          </button>
          <button
            type="button"
            className={`btn btn-sm ${userRoleFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setUserRoleFilter('all')}
          >
            الكل
          </button>
        </div>

        {/* قائمة منسدلة لاختيار المستخدم مباشرة بضغطة واحدة */}
        <select
          className="form-select form-select-md fw-bold border-success rounded-3 shadow-2xs"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} (@{u.username}) — [{getRoleLabel(u.role)}]
            </option>
          ))}
        </select>
      </div>

      <div className="row g-3">
        {/* العمود الأيمن على الشاشات الكبيرة (Desktop Sidebar) */}
        <div className="d-none d-lg-block col-lg-4">
          <div className="card shadow-sm border-0 rounded-3 sticky-top" style={{ top: 20 }}>
            <div className="card-header bg-white border-0 pt-3 pb-2">
              <h6 className="fw-bold text-dark mb-0">1️⃣ اختر المستخدم</h6>
            </div>
            <div className="card-body p-3">
              {/* تبويبات فلترة الرتب */}
              <div className="btn-group w-100 mb-2" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${userRoleFilter === 'student_teacher' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setUserRoleFilter('student_teacher')}
                >
                  محفظين
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${userRoleFilter === 'parent' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setUserRoleFilter('parent')}
                >
                  أولياء أمور
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${userRoleFilter === 'student' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setUserRoleFilter('student')}
                >
                  طلاب
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${userRoleFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setUserRoleFilter('all')}
                >
                  الكل
                </button>
              </div>

              {/* بحث المستخدمين */}
              <div className="mb-2">
                <input
                  type="text"
                  className="form-control form-control-sm rounded-pill"
                  placeholder="🔍 بحث بالاسم أو المستخدم..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              {/* قائمة المستخدمين */}
              <div className="list-group rounded-3 overflow-auto" style={{ maxHeight: 380 }}>
                {filteredUsers.length === 0 ? (
                  <div className="text-center text-muted p-3 small">لا يوجد مستخدمين مطابقين</div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = String(u.id) === String(selectedUserId);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`list-group-item list-group-item-action text-end d-flex align-items-center justify-content-between p-2 ${
                          isSelected ? 'active bg-success border-success text-white' : ''
                        }`}
                        onClick={() => setSelectedUserId(String(u.id))}
                      >
                        <div className="text-truncate">
                          <div className="fw-bold small text-truncate">{u.name}</div>
                          <div
                            className={`small ${isSelected ? 'text-white-50' : 'text-muted'}`}
                            style={{ fontSize: '0.75rem' }}
                          >
                            @{u.username}
                          </div>
                        </div>
                        <span
                          className={`badge ${isSelected ? 'bg-light text-success' : getRoleBadgeClass(u.role)}`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {getRoleLabel(u.role)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* العمود الأيسر: إدارة وتحديد الطلاب للمستخدم المختار */}
        <div className="col-12 col-lg-8">
          {selectedUser ? (
            <div className="card shadow-sm border-0 rounded-3">
              {/* شريط حالة المستخدم المختار وأزرار الحفظ */}
              <div className="card-header bg-white border-0 pt-3 pb-2">
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <h5 className="fw-bold mb-0 text-dark">
                        2️⃣ توزيع الطلاب على: <span className="text-success">{selectedUser.name}</span>
                      </h5>
                      <span className={`badge ${getRoleBadgeClass(selectedUser.role)}`}>
                        {getRoleLabel(selectedUser.role)}
                      </span>
                    </div>
                    <div className="small text-muted mt-1">
                      اسم المستخدم: <code>@{selectedUser.username}</code>
                    </div>
                  </div>

                  <button
                    className="btn btn-success fw-bold px-4 py-2 rounded-pill shadow-sm d-none d-sm-flex align-items-center gap-2 justify-content-center"
                    onClick={handleSave}
                    disabled={saving || loadingAssignments}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>حفظ التوزيع</span>
                      </>
                    )}
                  </button>
                </div>

                {/* مؤشر حالة التقييد الحالية */}
                <div className="mt-3 p-2 rounded-3 bg-light border d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="small">
                    {isAdminUser ? (
                      <span className="badge bg-danger fs-6">
                        👑 أدمن: يرى ويتحكم بجميع الطلاب دائماً
                      </span>
                    ) : isTeacher ? (
                      assignedStudentIds.length === 0 ? (
                        <span className="badge bg-success-subtle text-success border border-success fs-6">
                          🌟 غير مقيد (يرى ويسمّع لجميع {students.length} طالب)
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning fs-6">
                          🔒 مقيد بـ {assignedStudentIds.length} من {students.length} طالب
                        </span>
                      )
                    ) : (
                      <span className="badge bg-info-subtle text-info-emphasis border border-info fs-6">
                        👥 مسند إليه {assignedStudentIds.length} من {students.length} طالب
                      </span>
                    )}
                  </div>

                  <div className="fw-bold small text-muted">
                    تم تحديد: <span className="text-success fs-6">{assignedStudentIds.length}</span> من {students.length}
                  </div>
                </div>
              </div>

              <div className="card-body p-3">
                {/* أدوات التحكم السريع والبحث */}
                <div className="d-flex flex-column flex-sm-row gap-2 justify-content-between align-items-sm-center mb-3">
                  <div className="d-flex align-items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm rounded-pill fw-bold"
                      onClick={handleSelectAll}
                      title="تحديد جميع الطلاب المعروضين"
                    >
                      ✅ تحديد الكل ({filteredStudents.length})
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm rounded-pill"
                      onClick={handleDeselectAll}
                      title="إلغاء التحديد للطلاب المعروضين"
                    >
                      ❌ إلغاء
                    </button>
                    {isTeacher && assignedStudentIds.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm rounded-pill fw-bold"
                        onClick={handleClearAll}
                        title="إلغاء التقييد ليتمكن من رؤية جميع الطلاب افتراضياً"
                      >
                        🌐 يرى الجميع
                      </button>
                    )}
                  </div>

                  {/* شريط البحث في الطلاب */}
                  <div className="w-100 w-sm-auto" style={{ minWidth: 200 }}>
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-pill"
                      placeholder="🔍 بحث بالاسم أو الكود..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* شبكة كروت الطلاب */}
                {loadingAssignments ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-success" />
                    <div className="text-muted small mt-2">جاري جلب طلاب المستخدم...</div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <div className="fs-1">📭</div>
                    <p className="mb-0">لا يوجد طلاب مطابقين للبحث</p>
                  </div>
                ) : (
                  <div className="row g-2">
                    {filteredStudents.map((student) => {
                      const isChecked = assignedStudentIds.includes(student.id);
                      return (
                        <div className="col-12 col-sm-6" key={student.id}>
                          <div
                            className={`card h-100 p-2 rounded-3 border-2 transition-card ${
                              isChecked
                                ? 'border-success bg-success-subtle bg-opacity-25 shadow-sm'
                                : 'border-light bg-light'
                            }`}
                            style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                            onClick={() => toggleStudent(student.id)}
                          >
                            <div className="d-flex align-items-center justify-content-between">
                              <div className="d-flex align-items-center gap-2 text-truncate">
                                <input
                                  type="checkbox"
                                  className="form-check-input mt-0"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{
                                    cursor: 'pointer',
                                    width: 20,
                                    height: 20,
                                    accentColor: '#198754',
                                    flexShrink: 0
                                  }}
                                />
                                <div className="text-truncate">
                                  <div className="fw-bold small text-truncate text-dark">
                                    {student.name}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                    {student.currentSurah || 'المستوى المبتدئ'} • كود:{' '}
                                    <span className="badge bg-white text-secondary border">
                                      {student.studentCode || `#${student.id}`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <span
                                className={`badge rounded-pill ${
                                  isChecked ? 'bg-success text-white' : 'bg-secondary-subtle text-secondary'
                                }`}
                                style={{ fontSize: '0.68rem', flexShrink: 0 }}
                              >
                                {isChecked ? 'مُسند إليه' : 'غير مُسند'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* شريط الحفظ السفلي على Desktop */}
              <div className="card-footer bg-white border-0 p-3 d-none d-sm-flex justify-content-between align-items-center">
                <span className="small text-muted">
                  تم تحديد <strong>{assignedStudentIds.length}</strong> طالب
                </span>
                <button
                  className="btn btn-success fw-bold px-4 py-2 rounded-pill shadow-sm"
                  onClick={handleSave}
                  disabled={saving || loadingAssignments}
                >
                  {saving ? 'جاري الحفظ...' : '💾 حفظ التوزيع'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card shadow-sm border-0 rounded-3 p-5 text-center text-muted">
              <div className="fs-1">👈</div>
              <h5>برجاء اختيار مستخدم من القائمة</h5>
            </div>
          )}
        </div>
      </div>

      {/* شريط الحفظ العائم الثابت في الأسفل على الموبايل */}
      {selectedUser && (
        <div
          className="fixed-bottom bg-white border-top shadow-lg p-2 px-3 d-flex d-sm-none justify-content-between align-items-center"
          style={{ zIndex: 1040 }}
        >
          <div>
            <div className="fw-bold small text-dark">{selectedUser.name}</div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
              محدد: <strong className="text-success">{assignedStudentIds.length}</strong> طالب
            </div>
          </div>
          <button
            className="btn btn-success fw-bold px-4 py-2 rounded-pill shadow-sm d-flex align-items-center gap-1"
            onClick={handleSave}
            disabled={saving || loadingAssignments}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>حفظ التوزيع</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
