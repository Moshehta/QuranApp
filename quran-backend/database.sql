-- ===================================
-- قاعدة بيانات مقرأة تحفيظ قرآن
-- ===================================

-- إنشاء قاعدة البيانات
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'QuranDB')
BEGIN
    CREATE DATABASE QuranDB;
END
GO

USE QuranDB;
GO

-- ===================================
-- جدول المستخدمين (Users)
-- ===================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        name NVARCHAR(200) NOT NULL,
        role NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'superadmin', 'parent', 'student')),
        isMainAdmin BIT DEFAULT 0,
        mustChangePassword BIT DEFAULT 1,
        createdAt DATETIME DEFAULT GETDATE(),
        createdBy INT NULL
    );
END
GO

-- ===================================
-- جدول الطلاب (Students)
-- ===================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Students' AND xtype='U')
BEGIN
    CREATE TABLE Students (
        id INT IDENTITY(1,1) PRIMARY KEY,
        studentCode NVARCHAR(20) NOT NULL UNIQUE,
        name NVARCHAR(200) NOT NULL,
        age INT NULL,
        phone NVARCHAR(20) NULL,
        parentName NVARCHAR(200) NULL,
        parentPhone NVARCHAR(20) NULL,
        parentName2 NVARCHAR(200) NULL,
        parentPhone2 NVARCHAR(20) NULL,
        joinDate DATE DEFAULT GETDATE(),
        isActive BIT DEFAULT 1,
        createdAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- ===================================
-- جدول ربط ولي الأمر بالطلاب
-- ===================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ParentStudents' AND xtype='U')
BEGIN
    CREATE TABLE ParentStudents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL FOREIGN KEY REFERENCES Users(id) ON DELETE CASCADE,
        studentId INT NOT NULL FOREIGN KEY REFERENCES Students(id) ON DELETE CASCADE
    );
END
GO

-- ===================================
-- جدول الجلسات (Sessions)
-- ===================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sessions' AND xtype='U')
BEGIN
    CREATE TABLE Sessions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        studentId INT NOT NULL FOREIGN KEY REFERENCES Students(id) ON DELETE CASCADE,
        sessionDate DATE NOT NULL,

        -- اللوح (ما سمعه اليوم)
        lawhText NVARCHAR(MAX) NULL,
        lawhGrade NVARCHAR(20) NULL CHECK (lawhGrade IN ('ممتاز','جيد جداً','جيد مرتفع','جيد','متوسط','ضعيف') OR lawhGrade IS NULL),

        -- الصحة (ما سيسمعه المرة القادمة)
        sihhaText NVARCHAR(MAX) NULL,

        -- الماضي (المراجعة والتسميع)
        madiText NVARCHAR(MAX) NULL,
        madiGrade NVARCHAR(20) NULL CHECK (madiGrade IN ('ممتاز','جيد جداً','جيد مرتفع','جيد','متوسط','ضعيف') OR madiGrade IS NULL),
        madiMistakes INT NULL,
        madiFormations INT NULL,
        madiHeardBy INT NULL,
        madiHeardByName NVARCHAR(100) NULL,

        notes NVARCHAR(500) NULL,
        createdBy INT NULL,
        createdAt DATETIME DEFAULT GETDATE()
    );
END
GO

-- ===================================
-- جدول المدفوعات (Payments)
-- ===================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Payments' AND xtype='U')
BEGIN
    CREATE TABLE Payments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        studentId INT NOT NULL FOREIGN KEY REFERENCES Students(id) ON DELETE CASCADE,
        paymentYear INT NOT NULL,
        paymentMonth INT NOT NULL CHECK (paymentMonth BETWEEN 1 AND 12),
        isPaid BIT DEFAULT 0,
        paidDate DATETIME NULL,
        notes NVARCHAR(200) NULL,
        updatedBy INT NULL,
        updatedAt DATETIME DEFAULT GETDATE(),
        UNIQUE(studentId, paymentYear, paymentMonth)
    );
END
GO

-- ===================================
-- إنشاء الأدمن الرئيسي (باسورد: 123)
-- ===================================
-- باسورد 123 مشفر بـ bcrypt
IF NOT EXISTS (SELECT * FROM Users WHERE isMainAdmin = 1)
BEGIN
    INSERT INTO Users (username, password, name, role, isMainAdmin, mustChangePassword)
    VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', N'الأدمن الرئيسي', 'admin', 1, 1);
END
GO

PRINT 'تم إنشاء قاعدة البيانات بنجاح ✓';
GO
