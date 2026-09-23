-- ==========================================
-- قاعدة بيانات مقرأة تحفيظ القرآن الكريم (Supabase PostgreSQL)
-- ==========================================

-- 1. جدول المستخدمين (Users)
CREATE TABLE IF NOT EXISTS "Users" (
    "id" SERIAL PRIMARY KEY,
    "username" VARCHAR(100) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "role" VARCHAR(30) NOT NULL CHECK ("role" IN ('admin', 'superadmin', 'parent', 'student', 'student_teacher')),
    "isMainAdmin" BOOLEAN DEFAULT FALSE,
    "mustChangePassword" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INT NULL
);

-- 2. جدول الطلاب (Students)
CREATE TABLE IF NOT EXISTS "Students" (
    "id" SERIAL PRIMARY KEY,
    "studentCode" VARCHAR(20) NOT NULL UNIQUE,
    "name" VARCHAR(200) NOT NULL,
    "age" INT NULL,
    "phone" VARCHAR(20) NULL,
    "parentName" VARCHAR(200) NULL,
    "parentPhone" VARCHAR(20) NULL,
    "parentName2" VARCHAR(200) NULL,
    "parentPhone2" VARCHAR(20) NULL,
    "joinDate" DATE DEFAULT CURRENT_DATE,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول ربط ولي الأمر بالطلاب (ParentStudents)
CREATE TABLE IF NOT EXISTS "ParentStudents" (
    "id" SERIAL PRIMARY KEY,
    "userId" INT NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
    "studentId" INT NOT NULL REFERENCES "Students"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_parent_student" UNIQUE ("userId", "studentId")
);

-- 4. جدول الجلسات والتسميع (Sessions)
CREATE TABLE IF NOT EXISTS "Sessions" (
    "id" SERIAL PRIMARY KEY,
    "studentId" INT NOT NULL REFERENCES "Students"("id") ON DELETE CASCADE,
    "sessionDate" DATE NOT NULL,

    -- اللوح
    "lawhText" TEXT NULL,
    "lawhGrade" VARCHAR(30) NULL,

    -- الصحة
    "sihhaText" TEXT NULL,

    -- الماضي (المراجعة)
    "madiText" TEXT NULL,
    "madiGrade" VARCHAR(30) NULL,
    "madiMistakes" INT NULL,
    "madiFormations" INT NULL,
    "madiHeardBy" INT NULL,
    "madiHeardByName" VARCHAR(100) NULL,

    "notes" TEXT NULL,
    "createdBy" INT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول الاشتراكات والمدفوعات (Payments)
CREATE TABLE IF NOT EXISTS "Payments" (
    "id" SERIAL PRIMARY KEY,
    "studentId" INT NOT NULL REFERENCES "Students"("id") ON DELETE CASCADE,
    "paymentYear" INT NOT NULL,
    "paymentMonth" INT NOT NULL CHECK ("paymentMonth" BETWEEN 1 AND 12),
    "isPaid" BOOLEAN DEFAULT FALSE,
    "paidDate" TIMESTAMPTZ NULL,
    "notes" VARCHAR(200) NULL,
    "updatedBy" INT NULL,
    "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unique_student_year_month" UNIQUE ("studentId", "paymentYear", "paymentMonth")
);

-- إنشاء حساب الأدمن الرئيسي الافتراضي (اسم المستخدم: admin ، كلمة المرور: 123)
INSERT INTO "Users" ("username", "password", "name", "role", "isMainAdmin", "mustChangePassword")
VALUES ('admin', '$2b$10$vhbhWqLBfKfnQbYnUdE5m.y7n1PP3ifivhnSC99Gp6PQ69r2QZ0eq', 'الأدمن الرئيسي', 'admin', TRUE, TRUE)
ON CONFLICT ("username") DO UPDATE SET "password" = EXCLUDED."password";
