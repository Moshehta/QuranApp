import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

export default function UsersManagement({ user }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', role: 'parent', linkedStudentIds: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // حالة التعديل
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'parent', linkedStudentIds: [], resetPassword: false });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (user.role !== 'admin' && !user.isMainAdmin) {
      navigate('/');
      return;
    }
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, studentsRes] = await Promise.all([
        API.get('/users'),
        API.get('/students'),
      ]);
      setUsers(usersRes.data);
      setStudents(studentsRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const toggleStudent = (studentId) => {
    setForm(prev => {
      const ids = prev.linkedStudentIds.includes(studentId)
        ? prev.linkedStudentIds.filter(id => id !== studentId)
        : [...prev.linkedStudentIds, studentId];
      return { ...prev, linkedStudentIds: ids };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await API.post('/users', form);
      setSuccess(`تم إنشاء المستخدم "${form.username}" بنجاح. كلمة المرور: 123`);
      setForm({ username: '', name: '', role: 'parent', linkedStudentIds: [] });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    }
  };

  // فتح نافذة تعديل مستخدم
  const openEditModal = async (u) => {
    setEditingUser(u);
    setEditError('');
    let linkedIds = [];
    try {
      const res = await API.get(`/users/${u.id}/students`);
      linkedIds = res.data.map(s => s.id);
    } catch (e) {
      console.error(e);
    }
    setEditForm({
      name: u.name,
      role: u.role,
      linkedStudentIds: linkedIds,
      resetPassword: false
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');
    try {
      await API.put(`/users/${editingUser.id}`, editForm);
      setSuccess(`تم تعديل بيانات المستخدم "${editingUser.username}" بنجاح`);
      setEditingUser(null);
      loadData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'حدث خطأ في تعديل المستخدم');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${userName}"؟`)) return;
    await API.delete(`/users/${userId}`);
    loadData();
  };

  // فحص هل يمكن للمستخدم الحالي تعديل مستخدم معين
  const canEditUser = (targetUser) => {
    if (targetUser.isMainAdmin) return user.isMainAdmin; // الأدمن الرئيسي فقط يعدل نفسه
    if (user.isMainAdmin) return true; // الأدمن الرئيسي يعدل أي حد
    if (user.role === 'admin') return !targetUser.isMainAdmin; // الأدمن يعدل الكل ما عدا الأدمن الرئيسي
    if (user.role === 'superadmin') {
      // المحفظ لا يمكنه تعديل الأدمن أو الأدمن الرئيسي
      return targetUser.role !== 'admin' && !targetUser.isMainAdmin;
    }
    return false;
  };

  const getRoleName = (role) => ({
    admin: 'أدمن',
    student_teacher: 'طالب محفظ',
    superadmin: 'طالب محفظ',
    parent: 'ولي أمر',
    student: 'طالب'
  }[role] || role);

  if (loading) return <div className="d-flex justify-content-center mt-5"><div className="spinner-border text-success" /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h5 className="fw-bold mb-0">👥 إدارة المستخدمين</h5>
          <button className="btn btn-outline-secondary btn-sm py-0 px-2" onClick={loadData} title="تحديث قائمة المستخدمين">
            🔄 تحديث
          </button>
        </div>
        <button className="btn btn-success" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ إغلاق' : '➕ مستخدم جديد'}
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* نموذج إنشاء مستخدم جديد */}
      {showForm && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-header bg-success-subtle fw-bold">إنشاء مستخدم جديد</div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">اسم المستخدم *</label>
                  <input type="text" className="form-control" value={form.username}
                    onChange={e => set('username', e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">الاسم الكامل *</label>
                  <input type="text" className="form-control" value={form.name}
                    onChange={e => set('name', e.target.value)} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">الدور *</label>
                  <select className="form-select" value={form.role} onChange={e => {
                    const newRole = e.target.value;
                    set('role', newRole);
                    set('linkedStudentIds', []);
                  }}>
                    {(user.isMainAdmin || user.role === 'admin') && <option value="admin">أدمن</option>}
                    <option value="student_teacher">طالب محفظ</option>
                    <option value="parent">ولي أمر</option>
                  </select>
                </div>
                {(form.role === 'parent' || form.role === 'student_teacher') && (
                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      {form.role === 'student_teacher'
                        ? 'اختر الطالب المراد تعيينه كطالب محفظ:'
                        : 'ربط بالطلاب (يمكن اختيار أكثر من طالب):'}
                    </label>
                    <div className="d-flex flex-wrap gap-2">
                      {students.map(s => {
                        const isSelected = form.linkedStudentIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`btn btn-sm ${isSelected ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                            onClick={() => {
                              if (form.role === 'student_teacher') {
                                setForm(prev => ({
                                  ...prev,
                                  linkedStudentIds: isSelected ? [] : [s.id],
                                  username: isSelected ? '' : s.studentCode,
                                  name: isSelected ? '' : s.name
                                }));
                              } else {
                                const newIds = isSelected
                                  ? form.linkedStudentIds.filter(id => id !== s.id)
                                  : [...form.linkedStudentIds, s.id];
                                const last4 = (s.parentPhone || '').replace(/\D/g, '').slice(-4);
                                setForm(prev => ({
                                  ...prev,
                                  linkedStudentIds: newIds,
                                  username: (!prev.username && last4) ? last4 : prev.username,
                                  name: (!prev.name && s.parentName) ? s.parentName : prev.name
                                }));
                              }
                            }}
                          >
                            {s.name} ({s.studentCode})
                          </button>
                        );
                      })}
                    </div>
                    {(form.role === 'student' || form.role === 'student_teacher') && form.linkedStudentIds.length === 0 && (
                      <small className="text-danger d-block mt-1">⚠️ يجب اختيار طالب واحد</small>
                    )}
                  </div>
                )}
                <div className="col-12">
                  <button type="submit" className="btn btn-success px-4">💾 إنشاء (كلمة المرور: 123)</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل مستخدم */}
      {editingUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">✏️ تعديل المستخدم ({editingUser.username})</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setEditingUser(null)}></button>
              </div>
              <form onSubmit={handleUpdate}>
                <div className="modal-body">
                  {editError && <div className="alert alert-danger">{editError}</div>}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">الاسم الكامل *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.name}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  {!editingUser.isMainAdmin && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">الدور *</label>
                      <select
                        className="form-select"
                        value={editForm.role}
                        onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value, linkedStudentIds: [] }))}
                      >
                        {(user.isMainAdmin || user.role === 'admin' || editingUser.role === 'admin') && (
                          <option value="admin">أدمن</option>
                        )}
                        <option value="student_teacher">طالب محفظ</option>
                        <option value="parent">ولي أمر</option>
                        {editingUser.role === 'student' && <option value="student">طالب</option>}
                      </select>
                    </div>
                  )}

                  {(editForm.role === 'parent' || editForm.role === 'student' || editForm.role === 'student_teacher') && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">
                        {editForm.role === 'student_teacher'
                          ? 'ملف الطالب التابع له هذا المحفظ:'
                          : editForm.role === 'student'
                          ? 'الطالب المرتبط:'
                          : 'الطلاب المرتبطين:'}
                      </label>
                      <div className="d-flex flex-wrap gap-2">
                        {students.map(s => {
                          const isSelected = editForm.linkedStudentIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className={`btn btn-sm ${isSelected ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                              onClick={() => {
                                if (editForm.role === 'student' || editForm.role === 'student_teacher') {
                                  setEditForm(prev => ({ ...prev, linkedStudentIds: isSelected ? [] : [s.id] }));
                                } else {
                                  setEditForm(prev => {
                                    const ids = prev.linkedStudentIds.includes(s.id)
                                      ? prev.linkedStudentIds.filter(id => id !== s.id)
                                      : [...prev.linkedStudentIds, s.id];
                                    return { ...prev, linkedStudentIds: ids };
                                  });
                                }
                              }}
                            >
                              {s.name} ({s.studentCode})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="form-check mt-3 p-3 bg-light rounded">
                    <input
                      className="form-check-input ms-2"
                      type="checkbox"
                      id="resetPwdCheck"
                      checked={editForm.resetPassword}
                      onChange={e => setEditForm(prev => ({ ...prev, resetPassword: e.target.checked }))}
                    />
                    <label className="form-check-label fw-semibold" htmlFor="resetPwdCheck">
                      إعادة تعيين كلمة المرور إلى <code>123</code>
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>إلغاء</button>
                  <button type="submit" className="btn btn-primary" disabled={editLoading}>
                    {editLoading ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* جدول المستخدمين */}
      <div className="card shadow-sm border-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0 text-center align-middle">
            <thead className="table-light">
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الدور</th>
                <th>تاريخ الإنشاء</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.name} {u.isMainAdmin ? '⭐' : ''}</td>
                  <td><code>{u.username}</code></td>
                  <td><span className="badge bg-success">{getRoleName(u.role)}</span></td>
                  <td className="text-muted small">{new Date(u.createdAt).toLocaleDateString('ar-EG')}</td>
                  <td>
                    <div className="d-flex justify-content-center gap-1">
                      {canEditUser(u) && (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          title="تعديل"
                          onClick={() => openEditModal(u)}
                        >
                          ✏️
                        </button>
                      )}
                      {user.isMainAdmin && !u.isMainAdmin && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          title="حذف"
                          onClick={() => handleDelete(u.id, u.name)}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
