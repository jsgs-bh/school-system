# دليل المشروع — نظام إدارة مدرسة جدحفص الثانوية للبنات

هذا الملف مرجع تقني كامل لأي مطوّر أو نموذج ذكاء اصطناعي يستلم هذا المشروع
لمواصلة العمل عليه. الهدف: تفهم الفكرة والبنية والقواعد المتبعة قبل أي
تعديل، وتحافظ على نفس الأسلوب والنسق دون كسر أي جزء موجود.

**اقرأ قسم "Rules for Future Changes" في آخر الملف أولاً — هو الأهم.**

---

## 1) فكرة المشروع والهدف

منصة ويب واحدة تدير العمليات اليومية لمدرسة جدحفص الثانوية للبنات (البحرين)
وتربطها بالخطة الاستراتيجية للمدرسة: غياب، درجات، فعاليات، دعم أكاديمي،
مخالفات، شكاوى، لجان، احتياط، إجازات... كل شيء يُدخَل مرة واحدة ويُستثمر في
كل التقارير والمقارنات عبر السنوات. المستخدمون: معلمات، معلمة أولى، قيادة
عليا (مديرة + مساعدتان)، مكاتب (إرشاد أكاديمي/اجتماعي، تسجيل، إدارية،
تمكين رقمي)، وأدمن/دعم فني. لا يوجد أي وصول للطالبات أنفسهن — بياناتهن
(إيميل + أرقام تواصل) تُستخدم فقط للتواصل وإرسال الشهادات.

مبدأ الملكية: كل مفاتيح النظام (GitHub، Supabase) على حساب قوقل خاص
بالمدرسة (jidhafsatbh@gmail.com)، فتسليم الإدارة مستقبلاً يكون بتسليم
إيميل واحد فقط.

## 2) التقنيات المستخدمة

- **بلا إطار عمل (framework) وبلا أدوات بناء (build step)**: HTML + CSS +
  JavaScript خام (ES Modules)، تعمل مباشرة من الملفات كما هي. لا `package.json`
  ولا `npm install` ولا bundler (لا Webpack/Vite/إلخ).
- **الاستضافة**: GitHub Pages، مستودع عام `jsgs-bh/school-system`، الفرع
  `main`. الرابط: `https://jsgs-bh.github.io/school-system/`.
- **قاعدة البيانات/الخلفية**: Supabase (Postgres + Auth + Storage)،
  عبر مكتبة `@supabase/supabase-js@2` مستوردة مباشرة من CDN
  (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`) في `core.js`
  — لا يوجد أي خادم خلفي (backend) خاص بالمشروع؛ كل الاستدعاءات تصير من
  المتصفح مباشرة إلى Supabase.
- **مكتبات إضافية عبر CDN** (محمَّلة في `index.html` كـ `<script>` عادية،
  ليست ES modules): `xlsx@0.18.5` (SheetJS، لقراءة/كتابة إكسل)،
  `exceljs@4.4.0` (لتصدير إكسل بتنسيق/ألوان)، `docx@8.5.0` (لتوليد ملفات Word).
- **الخطوط**: Google Fonts — `IBM Plex Sans Arabic` (النص العام) و`Amiri`
  (العناوين، خط عربي كلاسيكي).
- **الطباعة/PDF**: لا توجد مكتبة توليد PDF — يُستخدَم `window.print()` مع
  CSS مخصص لكل تقرير (`@media print`) والمتصفح نفسه يحوّل لملف PDF.

## 3) هيكل المشروع

مجلد واحد مسطّح، بلا مجلدات فرعية. كل شاشة/وحدة = ملف `.js` واحد **مكتفٍ
بذاته**: يبني الـHTML الخاص به (`insertAdjacentHTML` على `#appView`)،
يضيف تنسيقاته الخاصة (`<style>` داخل نفس الـHTML)، يربط أحداثه، ويسجّل
نفسه في نظام التبويبات عبر `registerTab()`. هذا يعني أي ملف جديد أو معدَّل
يمكن تسليمه/رفعه وحده دون المساس بالباقي.

ملفات أساسية:
- `index.html` — الهيكل الثابت (شاشة الدخول، شريط التبويبات، `#appView`)
  + قائمة استيراد كل ملفات `.js` بالترتيب (الترتيب مهم: `settings-nav.js`
  لازم يُحمَّل بعد كل الشاشات التي يجمّعها، و`core.js` يُستورَد أخيراً
  لتشغيل `start()`).
- `app.css` — التنسيقات **المشتركة فعلاً** فقط (تسجيل الدخول، الأزرار،
  البطاقات، الجداول، الطباعة...). التعليق بأعلاه يقول "نادراً ما يتغير
  هذا الملف" — أي تنسيق خاص بشاشة واحدة يوضع داخل ملف تلك الشاشة، لا هنا.
- `core.js` — الاتصال بـ Supabase، الجلسة، الحالة المشتركة `S`، نظام
  التبويبات، وأدوات عامة. أهم ملف بالمشروع (تفاصيله في القسم 5).
- `quick-attendance.html` — صفحة مستقلة عامة **بلا تسجيل دخول**: رابط رصد
  غياب سريع (تختار المعلمة اسمها وترصد). تستخدم نفس `app.css` وتتصل بـ
  Supabase مباشرة (سياسات RLS تسمح لها تحديداً — انظر القسم 9).
- `index old.html` — نسخة قديمة/احتياطية غير مستخدمة. **لا تُحذف ولا
  تُعدَّل بدون طلب صريح** — إرث من مرحلة سابقة، اتركيه كما هو.
- `README.md` — شبه فارغ حالياً (اسم المستودع فقط)؛ هذا الملف
  (`PROJECT_GUIDE.md`) هو المرجع الفعلي.

## 4) الصفحات (التبويبات) ووظيفة كل واحدة

نظام التبويبات (في `core.js`) نوعان: **تبويب مستقل** (`TOP`) أو **تبويب
داخل مجموعة** (`GROUPS`، يظهر تحته شريط تبويبات فرعي). كل تبويب/ملف له
شرط ظهور `show(flags)` يقرر من يراه.

### تبويبات مستقلة
| المعرّف | التسمية | الملف | من يراها | الوظيفة |
|---|---|---|---|---|
| `annMain` | الإعلانات | `announcements.js` | الجميع | إعلانات/تنبيهات النظام + نافذة منبثقة |
| `compHours` | الساعات التعويضية | `comp-hours.js` | الجميع (بحسب دور) | طلب/اعتماد/استخدام الساعات التعويضية |
| `socStudents` | طالبات | `student-lookup.js` | الإرشاد الاجتماعي/الأكاديمي | بحث بيانات تواصل طالبة |
| `subsMain` | الاحتياط | `substitutes.js` | الأدمن / مسؤولة الاحتياط | تأمين حصص المعلمات الغائبات (تفصيل كامل بالقسم 15) |

### مجموعة "حصصي" (`teacherArea`) — للمعلمات
| المعرّف | التسمية | الملف |
|---|---|---|
| `teacherMain` | رصد الغياب | `teacher.js` |
| `mySchedule` | جدولي | `my-schedule.js` |
| `gradesEntry` | رصد الدرجات | `grades-entry.js` |
| `myStudents` | طالباتي | `student-lookup.js` |
| `teacherFiles` | ملفات | `teacher-files.js` |

### مجموعة "متابعة الغياب" (`attendance`)
`teacherMain`(نفسه)، `boardMain` متابعة الرصد (`board.js`)،
`attAlerts` تنبيهات الغياب والتأخير (`attendance-alerts.js`)،
`socialMain` التأخير والاستئذان (`social.js`)،
`ministryMain` قائمة الغياب/الوزارة (`ministry.js`)،
`studentAttReport` غياب الطالبات، `sectionAttReport` غياب الصفوف،
`earlyAttReport` متابعة الحضور المبكر، `builderMain` إنشاء تقارير الغياب
(منشئ تقارير حر، `builder.js`).

### مجموعة "الدرجات" (`grades`)
`gaMain` تحليل الاختبارات (`grades-analysis.js`)، `rpMain` استمارة
التغذية الراجعة (`remedial-plan.js`)، `spMain` تتبع الدرجات
(`student-performance.js`)، `upMain` متابعة أداء الطالبات
(`underperformers.js`)، `yearCompare` مقارنة السنوات (`year-comparison.js`).

### مجموعة "الخطة الاستراتيجية" (`plan`)
`strategicTree` الشجرة الاستراتيجية، `planFileUpload` رفع ملف الخطة،
`planManage` متابعة مشروعي، `planDept` الخطة التشغيلية،
`planOversight` متابعة الخطة الشاملة، `planView` الخطة التدفقية (عرض فقط)،
`adminProjects` متابعة المشاريع (إنشاء مشاريع/تعيين رئيسات)،
`committeesMain` اللجان والمبادرات، `evidenceRepo` مستودع الأدلة،
`leaveMark` اترك بصمة (مسجَّل مرتين — هنا وتحت "فعاليات"، انظر ملاحظة
`groupOf` في `core.js`).

### مجموعة "فعاليات" (`events`)
`leaveMark` (نفسه، للمعلمات العاديات)، `deptFinalReports` التقارير
الختامية.

### مجموعات أخرى
`complaints` (الشكاوى والمقترحات: تقديم/إحصائيات/متابعة)،
`violations` (المخالفات: شاشة المعلمة/الأدمن/الإرشاد الاجتماعي)،
`talents` (الموهوبات: المعلمة/الإدارة).

### مجموعة "الإعدادات" (`settings`) — للأدمن غالباً
`settingsData` البيانات الأساسية، `settingsYears` (يجمّع: السنوات
الدراسية + الترحيل)، `settingsStudentsHub` (يجمّع: طالبات المدرسة +
فئات التصنيف + الحالات الخاصة + سجل المتخرجات)، `settingsStaffHub`
(يجمّع: منح الصلاحيات + إدارة المنتسبات)، `settingsSupervision` إشراف
المعلمة الأولى، `settingsSubjects` المقررات والدرجات، `teachingGroups`
مجموعات التدريس، `fileTemplates` القوالب والملفات، `deptMeetings` حصص
الاجتماع والدعم، `dataReset` إعادة تعيين البيانات، `auditLog` سجل
العمليات، `changePassword` تغيير كلمة السر.

**نمط "التجميع" (hub)**: بعض التبويبات (`settingsYears`،
`settingsStudentsHub`، `settingsStaffHub`) لا تبني HTML جديداً — تُعاد
تركيب عناصر HTML الموجودة أصلاً من ملفاتها المصدر تحت شريط تبويبات فرعي
واحد (`settings-nav.js`، دالة `buildHub`). أي شاشة فرعية تبقى بملفها
الأصلي تماماً؛ هذا الملف يُحمَّل **أخيراً** في `index.html` لأنه يعتمد
على وجود عناصر تلك الشاشات بالـDOM مسبقاً.

## 5) الـ"Components" المشتركة (من `core.js`)

لا يوجد إطار مكوّنات (لا React/Vue)، لكن `core.js` يوفّر أدوات ونمطاً
مشتركاً يُعاد استخدامه في كل الملفات:

- `db` — عميل Supabase الجاهز (`createClient`).
- `$(id)` — اختصار `document.getElementById`.
- `S` — الحالة المشتركة الحية: `S.ME` (صف المنتسبة الحالية)، `S.YEAR`
  (السنة الدراسية النشطة)، `S.PERIODS` (توقيت الحصص)، `S.FLAGS` (كل
  صلاحيات/أدوار المستخدمة الحالية)، `S.SETTINGS` (إعدادات `app_settings`).
- `registerTab(t)` / `openTab(id)` — نظام التبويبات (تفصيله بالقسم 4).
- `roleNames`, `titleNames`, `AR_DAYS`, `PERIOD_NAMES` — قواميس تسميات
  ثابتة تُستخدم في كل مكان بدل تكرار النصوص.
- أدوات عامة: `clean()` (تنظيف نص)، `normName()` (توحيد الهمزات/التاء
  المربوطة للمقارنة)، `normDigits()` (أرقام عربية→إنجليزية)، `chunk()`،
  `dstr()` (تاريخ ISO)، `toast()` (إشعار عائم بدل `alert`)،
  `bindDrop()` (منطقة سحب/إفلات ملف موحّدة)، `readSheet()` (قراءة إكسل
  عبر XLSX)، `mkProg()` / `showWarns()` (شريط تقدّم وتنبيهات استيراد).
- `printWithTitle()`, `printHeaderHtml()`, `printFooterHtml()` — طباعة
  موحّدة لكل التقارير (شعار + عنوان + تذييل موقَّع)، وحل تعارض عدة
  حاويات طباعة (`[id^="printArea"]`) بتمرير `targetId` صراحة.
- `logAction(action, entity, details)` — يكتب في `audit_log`؛ يُستدعى
  بعد أي عملية حفظ/حذف مهمة.
- `getCurrentSemester()`, `getSemesterSubjectIds()`, `getLogoUrl()`,
  `loadSettings()` — منطق مشترك حول الفصل الدراسي الحالي والمقررات
  والشعار.

من ناحية CSS، الكلاسات المشتركة في `app.css` تُعامَل كـ"مكوّنات": `.panel`
(بطاقة محتوى)، `.board`/`.board-wrap` (جدول)، `.btn`/`.btn.gold`/`.btn.ghost`
(أزرار)، `.stat`/`.stats` (بطاقات إحصاء)، `.card` (بطاقة تسجيل الدخول)،
`.lesson` (بطاقة حصة)، `.stu` (بطاقة طالبة)، `.sugg`/`.picked` (بحث
واختيار)، `.hint`/`.warnbox`/`.chkline` (صناديق تنبيه)، `.toast`.

## 6) نظام التصميم

- **الألوان** (متغيرات CSS في `app.css :root`):
  `--navy:#1d3d5c` (أساسي)، `--navy-deep:#132a40`، `--gold:#b98a2f`
  (لوني ثانوي/تمييز)، `--gold-soft:#f3e8cf` (خلفية تمييز فاتحة)،
  `--sand:#f5f2ec` (خلفية الصفحة)، `--white:#fff`، `--ink:#22303c`
  (لون النص)، `--line:#dcd5c8` (حدود)، `--err:#b3372f` / `--err-soft`
  (خطأ)، `--ok:#2f7d4f` / `--ok-soft` (نجاح)، `--warn:#9a6b1f` (تحذير).
- **الخطوط**: `IBM Plex Sans Arabic` للنص العام، `Amiri` (serif) للعناوين
  الكبيرة (`.panel h3`, `.card-head h1`, `.roster-head .ttl b`,
  `.datebar .today-lbl`) — يعطي طابعاً رسمياً/تقليدياً للعناوين تحديداً.
- **أحجام النصوص**: النص العادي 12.5–15.5px، العناوين (Amiri) 19–22px،
  الأرقام الإحصائية الكبيرة (`.stat b`) 24px.
- **المسافات**: بطاقات `.panel` بحشو 22px وتباعد سفلي 18px بينها؛ صفوف
  الأزرار/الحقول `display:flex;gap:10-14px;flex-wrap:wrap`.
- **الأزرار**: `.btn` افتراضياً بعرض كامل (`width:100%`) للنماذج
  المستقلة (تسجيل الدخول)؛ الاستخدام المتكرر أكثر هو
  `width:auto;padding:...` مع أحد المتغيرين `.gold` (إجراء رئيسي/إيجابي)
  أو `.ghost` (إجراء ثانوي/محايد، حدّ فقط بلا خلفية). لا يوجد متغيّر
  "خطر" مستقل — الأزرار الحمراء تُلوَّن يدوياً (`border-color:var(--err)`)
  فوق `.ghost` كما في زر "تعطيل" و"وضع إجازة" (بلون `--warn`).
- **البطاقات**: `.panel` هو الحاوية شبه الوحيدة لكل محتوى (ظل خفيف، حدّ،
  زوايا 14px). لا يوجد نمط "كارت" مختلف لكل غرض.
- **الجداول**: `.board` داخل `.board-wrap` (تمرير أفقي)، رأس الجدول
  ثابت (`sticky top:0`) بخلفية `--navy`، العمود الأول أحياناً ثابت جانبياً
  (`sticky right:0`، مثال: عمود الشعبة). خلايا الحالة: `.cell-ok` /
  `.cell-no` / `.cell-dash`.
- **النوافذ (modals)**: **لا يوجد مكوّن نافذة منبثقة حقيقي** — النمط
  المتبع هو صناديق `display:none` تتحول لـ`block` (مثال: `.picked`،
  `.other-box`)، أو `confirm()`/`prompt()` الأصليتين للتأكيد. الإشعارات
  العابرة عبر `.toast` (أسفل الشاشة، تختفي تلقائياً) بدل `alert()`.
  الإعلانات (`announcements.js`) نافذتها المنبثقة الوحيدة الحقيقية
  بالمشروع (overlay مخصص).
- **Responsive**: لا breakpoints بـ`@media` للشاشة (فقط `@media print`
  موجود) — الاستجابة قائمة على Flexbox/Grid المرنين
  (`flex-wrap:wrap`، `grid-template-columns:repeat(auto-fit/auto-fill,minmax(...))`)
  بدل نقاط توقف ثابتة؛ يعمل جيداً على الموبايل والديسكتوب بلا تفريع كود.
- **RTL**: المشروع عربي بالكامل، `<html lang="ar" dir="rtl">` في كل صفحة.
  الأهم: الكود يستخدم **خصائص CSS المنطقية** بثبات
  (`inset-inline`, `margin-inline-start`, `padding-inline`) بدل
  `left`/`right` المباشرة — حافظي على هذا النمط في أي إضافة جديدة حتى
  يبقى الاتجاه صحيحاً تلقائياً.

## 7) طريقة كتابة الكود (Conventions)

- ملف واحد = وحدة واحدة كاملة: HTML (template literal + `insertAdjacentHTML`)
  + `<style>` + منطق JS + `registerTab()` في نهاية الملف.
  انظري أي ملف حديث (`substitutes.js`, `comp-hours.js`) كمرجع للنمط.
- أسماء الملفات: `kebab-case.js`. أسماء الدوال/المتغيرات: `camelCase`.
  أعمدة/جداول قاعدة البيانات: `snake_case`.
  المعرّفات (id) بالـDOM: بادئة قصيرة تدل على الملف (مثال: `sub*` لـ
  `substitutes.js`) لتفادي تصادم الأسماء بين الملفات.
  الأدوار في قاعدة البيانات ومفاتيح `S.FLAGS`: `isXxx` بصيغة camelCase
  للأعلام، ونص `snake_case` للدور الفعلي في `staff_roles.role`.
- التعليقات دائماً بالعربية، وتشرح **لماذا** لا فقط ماذا (كثير من التعليقات
  تسرد قراراً تم اتخاذه وسببه — هذا مقصود ومفيد جداً لأي مطوّر لاحق،
  استمري عليه).
- الحفظ الفوري (`upsert` عند كل اختيار) نمط متكرر في الشاشات التفاعلية
  الحديثة (`substitutes.js`) بدل زر "حفظ" واحد في النهاية.
- الاستيراد **لا يحذف أبداً**: كل عمليات الاستيراد "تحديث أو إضافة"
  بمعرّف ثابت (`upsert` مع `onConflict`)، إعادة الرفع لا تُكرِّر ولا
  تُفقِد بيانات — التزمي بهذا في أي شاشة استيراد جديدة.
- أي عملية حفظ/حذف مهمة تُسجَّل عبر `logAction()` في `audit_log`.
- لا اختبارات آلية (no test suite) ولا CI — التحقق يدوي بعد كل تسليم.
- **لا تُعدَّل `app.css` إلا لتنسيق مشترك فعلاً بين عدة شاشات** — أي
  تنسيق خاص بشاشة واحدة يبقى داخل ملفها.

## 8) كيفية الاتصال بـ Supabase

في `core.js` (أول سطرين تقريباً):
```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const db = createClient(<SUPABASE_URL>, <SUPABASE_PUBLISHABLE_KEY>);
```
هذا هو الاتصال الوحيد بقاعدة البيانات في كامل المشروع — كل ملف آخر
يستورد `db` من `core.js` ويستخدمه مباشرة (`db.from(...)`, `db.auth...`,
`db.storage...`). لا طبقة API وسيطة. تسجيل الدخول:
`db.auth.signInWithPassword({email, password})` فقط (بلا OAuth)،
والجلسة تُدار تلقائياً من `supabase-js` (تُخزَّن بـ`localStorage`).
عند وجود جلسة، `boot(session)` في `core.js` تجلب صف `staff` المطابق
(بـ`auth_user_id` أولاً، ثم بالإيميل احتياطياً) وتبني `S.FLAGS` منه.

## 9) وصف Supabase Database Schema

قاعدة بيانات واحدة (مشروع Supabase واحد)، عشرات الجداول. أهمها مجمَّعة
حسب الوحدة:

**الأساس**: `academic_years` (السنة النشطة، تواريخ الفصلين)،
`departments` (`kind`: `academic`/`office` — يُستخدم لاستبعاد المكاتب
غير التدريسية من حساب الاحتياط)، `staff` (المنتسبات — `title`: teacher/
senior_teacher/leadership/staff، `auth_user_id`، `is_active`, `on_leave`)،
`staff_roles` (دور إضافي لمنتسبة، `role` بقيد CHECK يحصر القيم
المسموحة — أي دور جديد لازم يُضاف لهذا القيد أولاً)، `students`،
`sections` (شعبة لكل فصل/سنة، ترميز `1وحد3` إلخ)، `enrollments`
(تسجيل طالبة بشعبة، بتاريخ من/إلى — النقل لا يفقد التاريخ)، `subjects`
(`category`: normal/إثرائي)، `timetable_patterns`/`pattern_periods`
(توقيت الحصص)، `timetable_entries` (سطر جدول: شعبة×يوم×حصة×مقرر،
`is_meeting`/`meeting_label` لحصص الاجتماع/الدعم، `is_current` لإصدار
الجدول الفعّال)، `entry_teachers` (ربط حصة بمعلمة/معلمتين للمنقسم).

**الغياب**: `attendance_sessions` (جلسة رصد لحصة بتاريخ، `via_link` للرابط
العام، `covers_next`)، `attendance_records` (حالة كل طالبة بالجلسة)،
`late_log`, `excuse_log`, `absence_followup`, `attendance_alerts`.

**الدرجات**: `exams`, `grade_records`, `grade_notes`, `grade_categories`,
`grade_settings`, `underperformer_alerts`, `remedial_plans`/
`remedial_plan_actions`, `exam_competencies`/`competency_items`،
`competency_templates`/`competency_template_items`.

**الاحتياط** (`substitute_assignments`، أُضيف حديثاً): `assignment_date`،
`entry_id`→`timetable_entries`، `absent_staff_id`/`substitute_staff_id`→
`staff`، مفتاح فريد `(assignment_date, entry_id, absent_staff_id)`
يمنع ازدواج الترشيح ويسمح بـ`upsert` لتغيير الاختيار.

**الساعات التعويضية**: `comp_hours` + `comp_hours_usage` (النظام الفعلي
المستخدَم حالياً — بدقة الدقيقة). كان يوجد سابقاً نسخة قديمة مهجورة
بأسماء مشابهة جداً (`compensatory_hours_requests`/`_usage`/`_balance`)
غير مستخدَمة بأي ملف `.js`؛ تم حذفها من قاعدة البيانات (وأُزيل ذكرها من
قائمة النسخ الاحتياطي في `data-reset.js`) — لم تعد موجودة، فلا داعي
للتحقق منها مستقبلاً.

**الخطة الاستراتيجية**: `strategic_domains → strategic_programs →
strategic_goals → strategic_standards → strategic_indicators →
strategic_subgoals` (سلسلة هرمية كاملة)، `plan_projects` (`chain_id`
لسلسلة المشروع عبر السنوات)، `plan_initiatives`, `plan_actions`,
`plan_project_subgoals`/`plan_project_indicators` (ربط م-لـ-م)،
`indicator_historical_values`.

**اللجان والمشاريع**: `committees` (`home_project_id` إلزامي + ربط
اختياري بـ`committee_beneficiary_projects`)، `committee_members`,
`committee_tasks`, `committee_minutes`, `staff_project_leads`.

**فعاليات وموهوبات**: `event_records`, `event_participants`,
`competition_announcements`, `talent_categories`, `talent_events`,
`talent_event_participants`, `student_talents`.

**مخالفات وشكاوى**: `violations` (+ `violation_categories`/
`violation_types`)، `complaints`.

**إدارية/نظام**: `app_settings` (صف وحيد id=1: اسم المدرسة، عتبات
التنبيه، أسماء القيادة، الشعار...)، `settings` (key/value عام)،
`audit_log` (`actor_id, action, entity, entity_id, details jsonb`)،
`announcements`/`announcement_recipients`/`announcement_dismissals`،
`file_templates`, `shared_files`, `evidence_files`, `teaching_groups`/
`teaching_group_teachers`/`teaching_group_members`/`group_students`،
`supervision_links`, `special_cases` (عمود `students.special_case`
فعلياً، لا جدول منفصل).

**Foreign Keys**: كل الجداول تقريباً تربط إلى `staff.id` (من فعل الإجراء)
و/أو `students.id`/`sections.id`/`academic_years.id` — النمط ثابت
(`created_by`, `recorded_by`, `approved_by`, `handled_by`... كلها
`uuid references staff(id)`). راجعي الجدول الفعلي بقاعدة البيانات قبل
أي تعديل بنيوي (schema يتغيّر بشكل متكرر).

**RLS Policies** — نمط مختلط مقصود وليس خطأ:
- نصف الجداول تقريباً RLS **معطّل تماماً** (مفتوح لأي مفتاح anon/authenticated).
- النصف الآخر RLS **مفعَّل**، لكن غالباً بسياسة `qual: true` (أي مستخدم
  مسجَّل دخول يقرأ ويكتب) — الأمثلة الحقيقية القليلة الأكثر تقييداً:
  `is_admin()` (يتحقق من دور admin/leadership) على الجداول الأساسية
  (`staff`, `departments`, `sections`, `subjects`, `students`,
  `timetable_entries`, `academic_years`...)، و`is_social_office()` على
  `late_log`/`excuse_log`.
- بعض الجداول (`attendance_records`, `attendance_sessions`) لها سياسات
  `anon_*` إضافية خاصة بـ`quick-attendance.html` (الرابط العام بلا دخول).
- **هذا الوضع معروف ومقبول حالياً** (كُتب سابقاً كملاحظة صريحة لصاحبة
  المشروع) — **لا تُفعِّلي/تُشدِّدي RLS على أي جدول من تلقاء نفسك** مهما
  بدا غير آمن؛ أي جدول جديد تُنشئينه اتبعي نفس نمط الجداول المشابهة له
  (اقرأي سياسات جدول مشابه أولاً، كما فعلنا مع `comp_hours`/`violations`
  عند إنشاء `substitute_assignments`).

**Functions**: `current_staff_id()` (يربط `auth.uid()` بصف `staff`)،
`is_admin()` (دور admin أو leadership)، `has_role(text)`،
`is_social_office()`، `link_auth_to_staff()`، `log_comp_hours_event(...)`.

**Triggers**: تريغر واحد فقط — `on_auth_user_created` (AFTER INSERT على
`auth.users`) يستدعي `link_auth_to_staff()`: يربط أي مستخدم Supabase Auth
جديد تلقائياً بصف `staff` المطابق بالإيميل. لا triggers أخرى مخصصة.

**Authentication**: إيميل/كلمة مرور فقط (Supabase Auth). صيغة الإيميل
الرسمية: `الرقم_الشخصي@moe.bh`. لا توجد أدوار Supabase Auth مخصصة (كل
الأدوار من جدول `staff_roles`، لا من نظام صلاحيات Supabase نفسه).

**Storage**: bucket واحد عام (`school-files`, `public:true`) — يخزّن
الشعار وقوالب الملفات وملفات الأدلة ومرفقات الشكاوى/محاضر اللجان. الروابط
العامة تُبنى بـ`db.storage.from('school-files').getPublicUrl(path)`.

## 10) تدفق البيانات بين الواجهة و Supabase

لا طبقة وسيطة: كل ملف `.js` يستدعي `db.from('table').select/insert/
update/delete/upsert(...)` مباشرة من داخل معالِج الحدث (event handler)،
وبعد الرد ينسّق الجزء المتأثر من HTML يدوياً (`$('someId').innerHTML=...`)
— لا Virtual DOM ولا حالة تفاعلية تلقائية (reactive state). لا استخدام
لـ Supabase Realtime (`.channel()` غير موجود بالكود) — أي تحديث من
مستخدمة أخرى لا يظهر إلا بإعادة تحميل/دخول الشاشة.

## 11) الصلاحيات وأنواع المستخدمين

مصدران للصلاحية يجتمعان في `S.FLAGS` (تُحسب مرة عند الدخول في
`boot()` بـ `core.js`):
1. **`staff.title`**: `teacher` / `senior_teacher` / `leadership` / `staff`.
2. **`staff_roles`**: أدوار إضافية اختيارية (تُمنح من "منتسبات المدرسة ←
   منح الصلاحيات"): `admin` (الدعم الفني)، `leadership`، `project_lead`،
   `committee_head`، `plans_supervisor`، `analysis_supervisor`،
   `attendance_lead`، `complaints_lead`، `strategic_plan_lead`،
   `violations_lead`، `talents_lead`، `comp_hours_lead`،
   `sub_coordinator` (الأحدث).
3. أعلام مشتقة من اسم القسم بمطابقة نصية (regex) وليس عمود مخصص:
   `isSocial`, `isServices`, `isAcademicGuidance`, `isReg` — **هذا النمط
   هش** (لاحظنا تكرار/فروقاً بأسماء بعض الأقسام بقاعدة البيانات تسبب
   مطابقة زائدة أو ناقصة) — عند إضافة منطق جديد يعتمد على نوع المكتب،
   فضّلي عمود `departments.kind` (`office`/`academic`) كما فعلنا في
   `substitutes.js` بدل تكرار نمط regex جديد.

كل `registerTab()` وكل شاشة فرعية بالـ hub لها `show(flags)` يحدد
الظهور — لكن **هذا تحكّم بالواجهة فقط، وليس أمناً حقيقياً** بما أن كثيراً
من RLS مفتوح (انظر القسم 9) — لا تفترضي أن إخفاء تبويب يعني منع الوصول
للبيانات عبر الـ API مباشرة.

## 12) Environment Variables

**لا توجد متغيرات بيئة بالمعنى المعتاد** — لا `.env`، لا خطوة بناء تقرأ
متغيرات وقت الترجمة. القيمتان الوحيدتان المطلوبتان للاتصال (رابط مشروع
Supabase + المفتاح العام Publishable/Anon) مكتوبتان مباشرة كنص صريح
داخل `core.js` (السطر الرابع تقريباً)، لأن الموقع ثابت (static) على
GitHub Pages بلا أي خادم يخفي أسراراً. هذا المفتاح مصمَّم من Supabase
ليكون عاماً وآمناً للكشف من جهة المتصفح — **ليس سراً**، ولا داعي
لإخفائه أكثر. **الاستثناء المطلق**: مفتاح `service_role` الخاص بـ
Supabase (صلاحيات كاملة تتجاوز RLS) **لا يظهر ولا يجب أن يظهر أبداً في
أي ملف بهذا المستودع** — أي عملية تحتاجه (migrations، إلخ) تتم فقط من
لوحة Supabase مباشرة أو عبر أداة MCP خارج الكود المرفوع.

## 13) الميزات المكتملة حالياً

غياب (رصد يومي، جدول إشراف حي، تأخير/استئذان، متابعة مرتفع، تقارير
تراكمية، رابط عام بلا دخول)، درجات (رصد، تحليل اختبارات بأربع طبقات،
تغذية راجعة، مقارنة سنوات)، مجموعات تدريس للمقررات المنقسمة، خطة
استراتيجية كاملة (شجرة، مشاريع، مبادرات، إجراءات، خطة تدفقية، رفع ملف
خطة)، لجان (بيت واحد + ربط متعدد)، مستودع أدلة، فعاليات ومسابقات ("اترك
بصمة" + تقارير ختامية)، موهوبات، مخالفات (بدورة تصعيد كاملة)، شكاوى،
ساعات تعويضية، احتياط (أحدث وحدة — تفصيلها بالقسم 15)، إجازة المنتسبة،
إعلانات/تنبيهات تلقائية (غياب لم يُرصد، مسابقة بلا نتيجة، تذكير بمواعيد
الخطة)، إدارة كاملة للمنتسبات والطالبات والأقسام والسنوات والترحيل،
قوالب ملفات وتصدير Excel/PDF منسّق في كل شاشة تقريباً، سجل عمليات
(audit log)، نسخ احتياطي كامل للبيانات، حذف بيانات وحدة معيّنة (أداة
إدارية).

## 14) غير مكتمل / TODOs / مشاكل معروفة

- **شهادات التحفيز** (شهادة PDF لكل طالبة + إرسال تلقائي بالإيميل) —
  لم تُبنَ بعد. لا توجد بنية تحتية لإرسال إيميلات بالمشروع حالياً (تحتاج
  Supabase Edge Function + مفتاح خدمة بريد مثل Resend).
- **محرك النماذج الحر** (بناء استمارة مخصصة بأي حقول وتوجيهها وحصر
  الردود) — لم يُبنَ بعد.
- **الاحتياط طويل الأمد** (إجازة تستدعي تغطية جدول كامل لفترة، لا يوماً
  بيوم) — الموجود حالياً (`substitutes.js`) يومي فقط؛ ربط تلقائي بين
  "وضع إجازة" وتغطية شاملة لجدولها لم يُبنَ.
- قوالب لم تُرفع بعد (تُبنى بقوالب مؤقتة حتى تصل الملفات الأصلية):
  قالب التكليف، استمارة المقصرات، بعض حقول الخطة الدراسية.
- بند مفتوح قديم لم يُحسَم: من يحدّث عمود "متابعة التنفيذ" في استمارة
  التغذية الراجعة — المعلمة الأولى أم مسؤولة تحليل الاختبارات؟
- `index old.html` ملف قديم غير مستخدم — إرث، اتركيه.
- نمط أعلام القسم بـ regex (`isSocial`, `isAcademicGuidance`...) هش أمام
  فروق كتابة أسماء الأقسام — يستحق توحيداً مستقبلياً (الأفضل: عمود
  `departments.kind` بدل النص الحر، كما فعلنا بالاحتياط).
- **مُنجَز**: أسماء أقسام مكرَّرة بقاعدة البيانات كانت تُفرِّق منتسبات
  نفس المكتب على صفَّين مختلفين ("مكتب الارشاد الأكاديمي" بهمزة/بدونها،
  و"الإرشاد الاجتماعي" مقابل "مكتب الارشاد الاجتماعي"، و"التسجيل" مقابل
  "مكتب التسجيل"، وقسم "ادارية" فاضٍ بلا أحد) — تم توحيدها: نُقلت
  المنتسبة الوحيدة من النسخة المكرَّرة لقسمها الصحيح، وحُذفت الأقسام
  الفاضية (تأكَّدنا أولاً أن لا شيء آخر بقاعدة البيانات يشير إليها).
  الأقسام الحالية أسماؤها موحَّدة الآن — أي مطابقة مستقبلية بالاسم
  أوثق، لكن يبقى `departments.kind` الخيار الأسلم دائماً.
- **مُلاحَظ (لم يُصلَح)**: قائمة `BACKUP_TABLES` في `data-reset.js`
  (النسخة الاحتياطية الكاملة) لا تشمل بعض الجداول الحيّة الفعلية:
  `comp_hours`, `comp_hours_usage`, `substitute_assignments`,
  `announcements`, `announcement_recipients` — يعني النسخة الاحتياطية
  الحالية تفوّت بيانات هذه الوحدات. لم أُصلحه لأنه لم يُطلَب صراحة؛
  يستحق تأكيداً من صاحبة المشروع قبل التعديل.

## 15) قرارات برمجية/تصميمية مهمة ولماذا

- **ملف واحد مكتفٍ بذاته لكل شاشة**: يسمح بتسليم/مراجعة ميزة واحدة
  بملف واحد صغير بدل التأثير على كل شيء — مقصود لتسهيل التطوير التزايدي
  بلا مخاطرة على الباقي.
- **لا إطار عمل ولا build step**: الاستضافة GitHub Pages والصيانة
  مستقبلاً قد تكون بيد شخص غير تقني بالكامل — البساطة (نسخ ملف ورفعه)
  أهم من قوة الأدوات.
- **الطباعة بدل مكتبة PDF**: `window.print()` + CSS مُعد مسبقاً أرخص
  وأسرع من دمج مكتبة توليد PDF لتقارير بتنسيقات متعددة ومتغيّرة كثيراً.
- **الاستيراد upsert دائماً**: قرار معتمد صراحة في الوثيقة الأصلية —
  "الاستيراد لا يحذف" — لتفادي فقد بيانات الغياب/الدرجات المرتبطة عند
  إعادة رفع ملف بالخطأ أو للتحديث.
- **RLS مختلط (مفتوح غالباً)**: قرار سرعة/بساطة واعٍ منذ بداية المشروع
  لمدرسة صغيرة الحجم؛ ليس سهواً. لا تُصلحيه من تلقاء نفسك.
- **`departments.kind` بدل مطابقة اسم القسم بـregex**: أُضيف هذا النمط
  الأحدث (`substitutes.js`) بعد ملاحظة تكرار/فروق بأسماء بعض المكاتب في
  قاعدة البيانات الفعلية جعلت مطابقة `regex` القديمة (بـ`core.js`) عرضة
  للخطأ — فضّلي هذا النمط الأحدث عند إضافة أي منطق مشابه مستقبلاً.
- **`substitute_assignments` يشير إلى `timetable_entries.id` لا يكرر
  شعبة/يوم/حصة**: مصدر واحد للحقيقة (single source of truth) لتفاصيل
  الحصة، بدل تكرارها بجدول الترشيحات.
- **`on_leave` عمود مستقل عن `is_active`**: التعطيل (`is_active=false`)
  يخفي المنتسبة من كل شيء؛ الإجازة يجب أن تبقيها ظاهرة وتُستبعد فقط من
  ترشيحات الاحتياط — قصد التمييز بين الحالتين.

---

## Rules for Future Changes

* Preserve the existing UI/UX and coding style.
* Make the smallest possible change required to fulfill each request.
* Do not redesign existing pages unless explicitly requested.
* Do not refactor unrelated code.
* Do not rename, move, or delete existing files/components unless explicitly required.
* Do not modify Supabase tables, columns, relationships, RLS policies, authentication, functions, or triggers unless explicitly requested.
* Do not change existing functionality while implementing a new feature.
* Reuse existing components and design patterns whenever possible.
* Before making a change, identify which files/components/database objects will be affected.
* After making a change, verify that unrelated functionality has not changed.
* If a requested change requires modifying another part of the system, explain the dependency before changing it.
* Never expose secrets, service-role keys, passwords, or private environment values in documentation or code.
