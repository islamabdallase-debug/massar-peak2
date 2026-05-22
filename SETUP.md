# مسار — دليل الإعداد والنشر
## PEAK Assessment Platform v5.0.0 — React Edition

---

## المتطلبات

- Node.js ≥ 18
- npm ≥ 9
- Git

---

## التطوير المحلي

```bash
# 1. تثبيت الاعتمادات
npm install

# 2. تشغيل خادم التطوير
npm run dev
# ← يفتح على http://localhost:5173
```

---

## بناء الإنتاج

```bash
# فحص TypeScript + بناء Vite
npm run build

# معاينة الحزمة المبنية
npm run preview
```

الملفات الناتجة تُحفظ في `dist/`.

---

## النشر على Vercel (موصى به)

```bash
# تثبيت Vercel CLI
npm install -g vercel

# نشر أول مرة (تسجيل دخول + ربط المشروع)
vercel

# نشر للإنتاج
vercel --prod
```

ملف `vercel.json` موجود مسبقاً بإعدادات:
- إعادة توجيه SPA (كل المسارات → index.html)
- ترويسات أمان: X-Frame-Options، X-Content-Type-Options
- تخزين مؤقت طويل للأصول (`/assets/`) — إلى سنة
- حماية Service Worker: `no-cache` + `Service-Worker-Allowed: /`

---

## النشر عبر Docker

```bash
# بناء الصورة
docker build -t massar-react .

# تشغيل الحاوية
docker run -p 80:80 massar-react

# ← تصفح http://localhost
```

### Docker Compose (اختياري)

```yaml
version: '3.8'
services:
  massar:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

```bash
docker compose up -d
```

---

## تثبيت PWA

عند فتح التطبيق في المتصفح:

**Chrome / Edge (سطح المكتب):**
- أيقونة التثبيت في شريط العنوان ← انقر "تثبيت"

**iOS (Safari):**
- مشاركة ← إضافة إلى الشاشة الرئيسية

**Android (Chrome):**
- القائمة ← تثبيت التطبيق

بعد التثبيت، التطبيق يعمل بدون إنترنت (offline-first).

### اختصارات PWA
- **تقييم جديد** → يفتح مباشرة على شاشة التقييم
- **التقارير** → يفتح مباشرة على شاشة التقارير

---

## المتغيرات البيئية

أنشئ ملف `.env.local` للتطوير:

```env
# رقم الإصدار (يُعرض في الواجهة)
VITE_APP_VERSION=5.0.0

# Supabase (اختياري — للمزامنة السحابية)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

على Vercel، أضف هذه المتغيرات من لوحة التحكم:
`Settings → Environment Variables`

---

## هيكل المشروع

```
massar-react/
├── src/
│   ├── App.tsx                  ← Router رئيسي
│   ├── main.tsx                 ← Entry point
│   ├── index.css                ← CSS variables + global styles
│   ├── types/
│   │   ├── index.ts             ← ScreenName, Lang, PeakModule
│   │   └── saas.ts              ← UserRole, SubscriptionPlan
│   ├── store/
│   │   ├── appStore.ts          ← Zustand: navigation, lang
│   │   └── authStore.ts         ← Zustand: user, profile, subscription
│   ├── i18n/
│   │   └── translations.ts      ← AR / EN / both strings
│   ├── hooks/
│   │   └── useTranslation.ts    ← t() hook
│   ├── data/
│   │   └── peakItems.ts         ← 291 PEAK items (DT+G+CE+TE)
│   ├── services/
│   │   ├── AssessService.ts     ← IndexedDB sessions
│   │   ├── AuthService.ts       ← Auth + Supabase
│   │   └── CenterService.ts     ← Multi-tenant centers
│   ├── components/
│   │   └── layout/
│   │       ├── Sidebar.tsx      ← RTL nav, role-aware, plan-gated
│   │       └── Header.tsx       ← Hamburger, student picker
│   └── screens/
│       ├── Dashboard.tsx        ← لوحة التحكم الرئيسية
│       ├── Students.tsx         ← إدارة المتعلمين
│       ├── Assess.tsx           ← التقييم (291 بند حقيقي)
│       ├── Reports.tsx          ← تقارير SVG + تصدير CSV/JSON
│       ├── Plan.tsx             ← خطط التدريب
│       ├── AI.tsx               ← مساعد الذكاء الاصطناعي
│       ├── Export.tsx           ← تصدير البيانات
│       ├── Tools.tsx            ← الأدوات المساعدة
│       ├── Analytics.tsx        ← تحليلات المركز (Pro)
│       ├── AdminPanel.tsx       ← إدارة المركز (Admin)
│       ├── Pricing.tsx          ← خطط الاشتراك
│       └── auth/                ← Login, Register, RoleSelect
├── public/
│   ├── manifest.json            ← PWA manifest (RTL Arabic)
│   └── sw.js                    ← Service Worker (cache-first)
├── index.html                   ← Splash screen + PWA meta
├── vite.config.ts               ← Vite + @/ alias
├── tsconfig.json                ← TypeScript strict config
├── vercel.json                  ← Vercel deployment config
└── Dockerfile                   ← Multi-stage Docker build
```

---

## الإصدارات

| الإصدار | التاريخ | التغييرات |
|---------|---------|-----------|
| v5.0.0 | مايو 2026 | React + TypeScript + Vite + PWA + SaaS |
| v3.2.0 | مارس 2026 | Vanilla JS — نسخة HTML كاملة |

---

## الدعم الفني

للمشاكل التقنية، يُرجى مراجعة:
- `src/` لأي خطأ في الكود
- `vercel.json` / `Dockerfile` لمشاكل النشر
- `public/sw.js` لمشاكل الـ PWA أو الـ Cache

