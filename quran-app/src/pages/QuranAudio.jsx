import { useState, useRef, useEffect } from 'react';
import { QURAN_SURAHS, getSurahAudioUrl } from '../quranData';

export default function QuranAudio() {
  const [search, setSearch] = useState('');
  const [currentSurah, setCurrentSurah] = useState(null);
  const [recitationType, setRecitationType] = useState('murattal'); // 'murattal' | 'muallim'
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const audioRef = useRef(null);

  // تصفية السور حسب البحث
  const filteredSurahs = QURAN_SURAHS.filter(s =>
    s.name.includes(search.trim()) ||
    String(s.id) === search.trim() ||
    s.name.replace(/أ|إ|آ/g, 'ا').includes(search.trim().replace(/أ|إ|آ/g, 'ا'))
  );

  // تبديل نوع التلاوة (مرتل / معلم)
  const handleRecitationTypeChange = (type) => {
    if (type === recitationType) return;
    setRecitationType(type);
    if (currentSurah && audioRef.current) {
      setIsLoadingAudio(true);
      const wasPlaying = isPlaying;
      audioRef.current.src = getSurahAudioUrl(currentSurah.id, type);
      audioRef.current.currentTime = 0;
      if (wasPlaying) {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setIsLoadingAudio(false);
          })
          .catch(() => {
            setIsPlaying(false);
            setIsLoadingAudio(false);
          });
      } else {
        setIsLoadingAudio(false);
      }
    }
  };

  // تشغيل سورة معينة
  const playSurah = (surah) => {
    if (currentSurah?.id === surah.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    setCurrentSurah(surah);
    setIsLoadingAudio(true);
    setCurrentTime(0);

    if (audioRef.current) {
      audioRef.current.src = getSurahAudioUrl(surah.id, recitationType);
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setIsLoadingAudio(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setIsLoadingAudio(false);
        });
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentSurah) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (!currentSurah) return;
    const nextId = currentSurah.id === 114 ? 1 : currentSurah.id + 1;
    const nextSurah = QURAN_SURAHS.find(s => s.id === nextId);
    if (nextSurah) playSurah(nextSurah);
  };

  const handlePrev = () => {
    if (!currentSurah) return;
    const prevId = currentSurah.id === 1 ? 114 : currentSurah.id - 1;
    const prevSurah = QURAN_SURAHS.find(s => s.id === prevId);
    if (prevSurah) playSurah(prevSurah);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatSeconds = (sec) => {
    if (isNaN(sec) || sec === 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="container py-4" style={{ paddingBottom: currentSurah ? 130 : 50 }}>
      {/* مشغل الصوت الخفي */}
      <audio
        ref={audioRef}
        loop={isLooping}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration || 0);
          setIsLoadingAudio(false);
        }}
        onEnded={() => {
          if (!isLooping) handleNext();
        }}
        onError={() => {
          setIsLoadingAudio(false);
          setIsPlaying(false);
        }}
      />

      {/* عنوان الصفحة */}
      <div className="card shadow-sm border-0 mb-3 rounded-3 bg-success text-white">
        <div className="card-body p-3 p-md-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="fs-3">📻</span>
              <h4 className="fw-bold mb-0">المصحف المسموع كاملاً</h4>
            </div>
            <p className="mb-0 opacity-75 small">
              القرآن الكريم كاملاً بصوت فضيلة الشيخ <strong>محمود خليل الحصري</strong> رحمه الله — {recitationType === 'murattal' ? 'المصحف المرتل' : 'المصحف المعلم (مع ترديد الأطفال)'}
            </p>
          </div>
          <span className="badge bg-white text-success px-3 py-2 fs-6 rounded-pill fw-bold shadow-sm">
            114 سورة كاملة
          </span>
        </div>
      </div>

      {/* تبديل نوع المصحف: المرتل / المعلم */}
      <div className="card shadow-sm border-0 mb-4 rounded-3">
        <div className="card-body p-2 p-md-3">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <button
                type="button"
                className={`btn w-100 py-2 py-md-3 rounded-3 d-flex align-items-center justify-content-center gap-2 fw-bold text-end ${
                  recitationType === 'murattal'
                    ? 'btn-success text-white shadow'
                    : 'btn-outline-secondary'
                }`}
                onClick={() => handleRecitationTypeChange('murattal')}
              >
                <span className="fs-4">📖</span>
                <div>
                  <div className="fs-6 fw-bold">المصحف المرتل</div>
                  <div className="small fw-normal opacity-75" style={{ fontSize: '0.78rem' }}>
                    تلاوة متواصلة هادئة ومتقنة
                  </div>
                </div>
              </button>
            </div>

            <div className="col-12 col-md-6">
              <button
                type="button"
                className={`btn w-100 py-2 py-md-3 rounded-3 d-flex align-items-center justify-content-center gap-2 fw-bold text-end ${
                  recitationType === 'muallim'
                    ? 'btn-success text-white shadow'
                    : 'btn-outline-secondary'
                }`}
                onClick={() => handleRecitationTypeChange('muallim')}
              >
                <span className="fs-4">👨‍👧‍👦</span>
                <div>
                  <div className="fs-6 fw-bold">المصحف المعلم (مع ترديد الأطفال)</div>
                  <div className="small fw-normal opacity-75" style={{ fontSize: '0.78rem' }}>
                    تلاوة الآية ثم ترديد الأطفال بعدها لتسهيل الحفظ
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* مربع البحث */}
      <div className="mb-4">
        <input
          type="text"
          className="form-control form-control-lg rounded-pill shadow-sm px-4"
          placeholder="🔍 ابحث برقم السورة أو اسمها (مثال: الكهف، البقرة، 18)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* قائمة السور */}
      {filteredSurahs.length === 0 ? (
        <div className="text-center text-muted py-5">
          <div style={{ fontSize: '3rem' }}>📭</div>
          <p>لم يتم العثور على سور مطابقة للبحث</p>
        </div>
      ) : (
        <div className="row g-3">
          {filteredSurahs.map((surah) => {
            const isCurrent = currentSurah?.id === surah.id;
            return (
              <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={surah.id}>
                <div
                  className={`card h-100 shadow-sm border-2 rounded-3 transition-card ${
                    isCurrent ? 'border-success bg-success-subtle bg-opacity-25' : 'border-0 bg-white'
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => playSurah(surah)}
                >
                  <div className="card-body p-3 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      {/* رقم السورة في دائرة */}
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${
                          isCurrent ? 'bg-success text-white shadow' : 'bg-light text-success border'
                        }`}
                        style={{ width: 44, height: 44, fontSize: '0.95rem', flexShrink: 0 }}
                      >
                        {surah.id}
                      </div>
                      <div>
                        <h6 className="fw-bold mb-1 text-dark">سورة {surah.name}</h6>
                        <div className="text-muted small">
                          <span className="badge bg-light text-secondary border me-1" style={{ fontSize: '0.72rem' }}>
                            {surah.type}
                          </span>
                          <span style={{ fontSize: '0.75rem' }}>{surah.ayahs} آية</span>
                        </div>
                      </div>
                    </div>

                    {/* زر التشغيل */}
                    <button
                      type="button"
                      className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center ${
                        isCurrent && isPlaying ? 'btn-success text-white' : 'btn-outline-success'
                      }`}
                      style={{ width: 38, height: 38, flexShrink: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        playSurah(surah);
                      }}
                      title={isCurrent && isPlaying ? 'إيقاف مؤقت' : 'استماع'}
                    >
                      {isCurrent && isPlaying ? '⏸️' : '▶️'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* شريط المشغل الصوتي العائم في الأسفل */}
      {currentSurah && (
        <div
          className="fixed-bottom bg-dark text-white shadow-lg border-top border-success p-2 p-md-3"
          style={{ zIndex: 1050 }}
        >
          <div className="container" style={{ maxWidth: 850 }}>
            {/* معلومات السورة الحالية والتحكم */}
            <div className="d-flex flex-column gap-2">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success px-2 py-1 fs-6">
                    {currentSurah.id}
                  </span>
                  <div>
                    <h6 className="fw-bold mb-0 text-white">سورة {currentSurah.name}</h6>
                    <small className="text-white-50" style={{ fontSize: '0.75rem' }}>
                      الشيخ الحصري • {recitationType === 'murattal' ? 'المصحف المرتل' : 'المصحف المعلم'} ({currentSurah.type} - {currentSurah.ayahs} آية)
                    </small>
                  </div>
                </div>

                {/* أزرار التحكم الرئيسية */}
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-light btn-sm rounded-circle"
                    onClick={handlePrev}
                    title="السورة السابقة"
                  >
                    ⏮️
                  </button>
                  <button
                    className="btn btn-success btn-lg rounded-circle px-3 py-2 fw-bold shadow"
                    onClick={togglePlay}
                    disabled={isLoadingAudio}
                    title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                  >
                    {isLoadingAudio ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : isPlaying ? (
                      '⏸️'
                    ) : (
                      '▶️'
                    )}
                  </button>
                  <button
                    className="btn btn-outline-light btn-sm rounded-circle"
                    onClick={handleNext}
                    title="السورة التالية"
                  >
                    ⏭️
                  </button>

                  <button
                    className={`btn btn-sm rounded-pill ms-2 ${isLooping ? 'btn-warning text-dark' : 'btn-outline-light'}`}
                    onClick={() => setIsLooping(!isLooping)}
                    title={isLooping ? 'إلغاء التكرار' : 'تكرار السورة'}
                    style={{ fontSize: '0.75rem' }}
                  >
                    🔁 {isLooping ? 'تكرار مفعل' : 'تكرار'}
                  </button>

                  {/* سرعة الصوت */}
                  <select
                    className="form-select form-select-sm w-auto bg-dark text-white border-secondary"
                    style={{ fontSize: '0.75rem' }}
                    value={playbackRate}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    title="سرعة التلاوة"
                  >
                    <option value="0.75">0.75x</option>
                    <option value="1">1.0x عادي</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                  </select>
                </div>
              </div>

              {/* شريط التقدم الزمني */}
              <div className="d-flex align-items-center gap-2">
                <small className="text-white-50" style={{ minWidth: 42, fontSize: '0.75rem' }}>
                  {formatSeconds(currentTime)}
                </small>
                <input
                  type="range"
                  className="form-range flex-grow-1"
                  min="0"
                  max={duration || 0}
                  step="0.5"
                  value={currentTime}
                  onChange={handleSeek}
                  style={{ accentColor: '#198754' }}
                />
                <small className="text-white-50" style={{ minWidth: 42, fontSize: '0.75rem' }}>
                  {formatSeconds(duration)}
                </small>

                {/* مستوى الصوت */}
                <div className="d-none d-md-flex align-items-center gap-1 ms-2" style={{ width: 100 }}>
                  <span style={{ fontSize: '0.8rem' }}>🔊</span>
                  <input
                    type="range"
                    className="form-range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={handleVolumeChange}
                    style={{ accentColor: '#198754' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
