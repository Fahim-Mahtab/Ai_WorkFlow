/** Sample prompts and edit/work-log examples shown in the UI. */
export const TEST_A_PROMPT =
  "আমার পৌরসভার জন্য একটি Data Entry Management System তৈরি করো। ১২ জন কর্মী থাকবে। Citizen Name, NID, Ward Number, Mobile Number এবং Address দিয়ে একটি Form তৈরি করো। কর্মীদের মধ্যে কাজ Assign করতে হবে। Daily Progress এবং Manager Review Dashboard চাই।";

export const TEST_B_PROMPT =
  "Amader software development team er jonno ekta dashboard banao. 4 jon developer and 2 jon tester ache. Bug tracking, sprint management, task assignment, deployment status and daily work reports lagbe.";

export const SAMPLE_PROMPTS: { label: string; lang: string; prompt: string }[] = [
  { label: "Municipality data entry", lang: "বাংলা", prompt: TEST_A_PROMPT },
  { label: "Software team", lang: "Banglish", prompt: TEST_B_PROMPT },
  { label: "Office project tracker", lang: "Banglish", prompt: "Amar office er jonno ekta project management dashboard banao. 8 jon employee ache, weekly report dekhte chai." },
  { label: "Sales CRM", lang: "English", prompt: "Create a sales team workspace for 6 sales reps and 1 manager. Track leads with Customer Name, Company, Phone, Email, Deal Value and Stage. Show a weekly pipeline report." },
  { label: "কাজ ভাগ", lang: "বাংলা", prompt: "আমাদের ১০ জন employee আছে, তাদের মধ্যে কাজ ভাগ করে দাও। প্রতিদিনের কাজের রিপোর্ট দেখতে চাই।" },
];

export const SAMPLE_EDITS: string[] = [
  "Dashboard e ekta weekly report chart add koro.",
  "Monthly report ta remove kore daily report add koro.",
  "Task board e ekta Review status add koro.",
  "2 jon notun developer add koro: Rafi, Nusrat",
  "Employee der jonno daily work submission form add koro.",
  "ড্যাশবোর্ডে একটি সাপ্তাহিক রিপোর্ট চার্ট যোগ করো।",
];

export const WORKLOG_SAMPLES: string[] = [
  "Ajke API integration korechi, database optimize korechi and 2 ta bug fix korechi.",
  "আজ ওয়ার্ড ৩-এর ৮৫টি নাগরিক তথ্য এন্ট্রি করেছি এবং ২০টি এন্ট্রি যাচাই করেছি।",
  "Today I attended the sprint planning meeting, wrote unit tests for payments and reviewed 3 pull requests.",
];
