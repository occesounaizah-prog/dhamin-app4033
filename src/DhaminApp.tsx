import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Shield, Scale, Send, ArrowRight, Briefcase, Building2, Home, MessageSquare, Compass,
  Wallet, CheckCircle2, Clock, Lock, CreditCard, X, Plus, Star, Filter, LogOut, FileText, AlertTriangle, Loader2, Paperclip, Download, BellRing, Image as ImageIcon, File as FileIcon, Eye,
} from "lucide-react";
import { ATTACHMENTS_BUCKET, supabase } from "@/lib/supabase";
import {
  type Role, type TStatus, type Taameed, type Msg, type MsgAttachment, type OfferRow, type RequestRow, type ConversationRow,
  fetchRequests, fetchAllOffers, fetchConversations, fetchMessages, fetchTaameeds, fetchTaameedsByConversation,
  insertRequest, insertOffer, incrementRequestBids, insertConversation, updateConversationPreview, insertMessage, insertTaameed, updateTaameedStatus,
  deleteTaameedsByConversation, insertDispute, fetchDispute,
} from "@/lib/dhamin-data";

type Screen = "welcome" | "login" | "otp" | "home" | "offers" | "lounge" | "conversations" | "chat" | "proposal" | "payment" | "success" | "dashboard-detail";

interface ActiveOffer { offer: OfferRow; request: RequestRow }

const SECTORS = ["الكل", "أبشر", "وزارة التجارة", "بلدي", "الموارد البشرية", "أخرى"];
const fmtSAR = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " ر.س";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const now = () => new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

const SESSION_KEY = "dhamin_session_v1";
type SavedSession = { role: Role; loggedIn: boolean } | null;
const loadSession = (): SavedSession => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (parsed && (parsed.role === "client" || parsed.role === "muqeeb") && typeof parsed.loggedIn === "boolean") return parsed;
    return null;
  } catch { return null; }
};
const saveSession = (s: SavedSession) => {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};
const clearSession = () => saveSession(null);

export default function DhaminApp() {
  const initialSession = loadSession();
  const [screen, setScreen] = useState<Screen>(initialSession?.loggedIn ? "home" : "welcome");
  const [role, setRole] = useState<Role>(initialSession?.role ?? "client");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [sheet, setSheet] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [sector, setSector] = useState("الكل");
  const [selectedRequestId, setSelectedRequestId] = useState("R1");
  const [dashboardDetail, setDashboardDetail] = useState("المعاملات");
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  const [activeConversationId, setActiveConversationId] = useState("conv-trade-renewal");
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [dataError, setDataError] = useState("");

  const [taameeds, setTaameeds] = useState<Taameed[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Msg[]>>({});
  const [typed, setTyped] = useState("");
  const [allOffers, setAllOffers] = useState<OfferRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [bidSent, setBidSent] = useState<string[]>([]);
  const [newReq, setNewReq] = useState({ title: "", sector: "أبشر", desc: "" });
  const [offerModal, setOfferModal] = useState<RequestRow | null>(null);
  const [disputeConfirm, setDisputeConfirm] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const roleRef = useRef<Role>(role);
  const screenRef = useRef<Screen>(screen);
  const activeConvRef = useRef<string>(activeConversationId);
  const audioRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { activeConvRef.current = activeConversationId; }, [activeConversationId]);

  const goHome = () => setScreen("home");
  const logout = () => { clearSession(); setScreen("welcome"); };

  useEffect(() => {
    const onPop = () => {
      const cur = screenRef.current;
      if (cur === "welcome" || cur === "login" || cur === "otp") return;
      const subScreens: Screen[] = ["chat", "offers", "conversations", "lounge", "proposal", "dashboard-detail", "payment", "success"];
      if (subScreens.includes(cur)) {
        try { history.pushState({ dhamin: true }, ""); } catch { /* ignore */ }
        goHome();
      } else if (cur === "home") {
        const ts = Date.now();
        if (lastBackRef.current && ts - lastBackRef.current < 2000) {
          lastBackRef.current = 0;
          clearSession();
          setScreen("welcome");
        } else {
          lastBackRef.current = ts;
          setBackToast(true);
          try { history.pushState({ dhamin: true }, ""); } catch { /* ignore */ }
          setTimeout(() => setBackToast(false), 1900);
        }
      }
    };
    try { history.pushState({ dhamin: true }, ""); } catch { /* ignore */ }
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); };
  }, []);

  const lastBackRef = useRef(0);
  const [backToast, setBackToast] = useState(false);

  const selectedOffers = allOffers.filter((o) => o.requestId === selectedRequestId);

  useEffect(() => {
    if (screen !== "otp" || timer === 0) return;
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, timer]);

  const loadData = async () => {
    try {
      const [reqs, convs, offers, taams] = await Promise.all([fetchRequests(), fetchConversations(), fetchAllOffers(), fetchTaameeds()]);
      setRequests(reqs);
      setConversations(convs);
      setAllOffers(offers);
      setTaameeds(taams);
      setDataError("");
    } catch {
      setDataError("تعذر تحميل البيانات. تحقق من الاتصال.");
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("dhamin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => { void fetchConversations().then(setConversations); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { conversation_id: string; sender: string };
        if (!row?.conversation_id) return;
        void fetchMessages(row.conversation_id).then((msgs) => setMessagesByConversation((items) => ({ ...items, [row.conversation_id]: msgs })));
        const currentRole = roleRef.current;
        const isOwnMessage = row.sender === currentRole;
        const isSystem = row.sender === "system";
        const isViewingThisChat = screenRef.current === "chat" && activeConvRef.current === row.conversation_id;
        if (!isOwnMessage && !isSystem) {
          playNotificationSound();
          if (!isViewingThisChat) {
            setUnread((u) => ({ ...u, [row.conversation_id]: (u[row.conversation_id] ?? 0) + 1 }));
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "taameeds" }, () => { void fetchTaameeds().then(setTaameeds); })
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => { void fetchRequests().then(setRequests); })
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, () => { void fetchAllOffers().then(setAllOffers); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const loadMessages = async (conversationId: string) => {
    try {
      const msgs = await fetchMessages(conversationId);
      setMessagesByConversation((items) => ({ ...items, [conversationId]: msgs }));
    } catch {
      setDataError("تعذر تحميل الرسائل.");
    }
  };

  const loadConversationTaameeds = async (conversationId: string) => {
    try {
      const taams = await fetchTaameedsByConversation(conversationId);
      setTaameeds(taams);
    } catch {
      setDataError("تعذر تحميل التعميدات.");
    }
  };

  const escrow = taameeds.filter((t) => t.status === "paid").reduce((a, t) => a + t.amount, 0);
  const pending = taameeds.filter((t) => t.status === "pending_payment").length;
  const hasPaidTaameed = taameeds.some((t) => t.status === "paid");
  const hasPendingTaameed = taameeds.some((t) => t.status === "pending_payment");

  const currentConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const msgs = messagesByConversation[activeConversationId] ?? [];
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const sendMsg = () => {
    if (!typed.trim()) return;
    const text = typed;
    const time = now();
    const id = `m-${Date.now()}`;
    void insertMessage({ id, conversation_id: activeConversationId, sender: role, text, taameed_id: null, display_time: time }).then(() => {
      void updateConversationPreview(activeConversationId, text, time);
    }).catch(() => setDataError("تعذر إرسال الرسالة."));
    setTyped("");
  };

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setUnread((u) => { const n = { ...u }; delete n[conversationId]; return n; });
    void loadMessages(conversationId);
    void loadConversationTaameeds(conversationId);
    setScreen("chat");
  };

  const uploadAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setAttachmentError("يسمح بصور ومستندات محددة بحجم أقصى 10 ميجابايت.");
      return;
    }
    setUploading(true);
    setAttachmentError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `conversations/${activeConversationId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setAttachmentError("تعذر رفع الملف. حاول مرة أخرى.");
      setUploading(false);
      return;
    }
    const time = now();
    const id = `m-${Date.now()}`;
    void insertMessage({ id, conversation_id: activeConversationId, sender: role, text: null, taameed_id: null, display_time: time, attachment_path: path, attachment_name: file.name, attachment_mimetype: file.type, attachment_size: file.size }).then(() => {
      void updateConversationPreview(activeConversationId, file.type.startsWith("image/") ? "📷 صورة" : `📎 ${file.name}`, time);
    }).catch(() => setAttachmentError("تعذر تسجيل المرفق في المحادثة."));
    setUploading(false);
  };

  const downloadAttachment = async (attachment: MsgAttachment) => {
    try {
      const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).download(attachment.path);
      if (error || !data) {
        setAttachmentError("تعذر تحميل الملف حالياً.");
        return;
      }
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      setAttachmentError("تعذر تحميل الملف حالياً.");
    }
  };

  const viewAttachment = async (attachment: MsgAttachment) => {
    try {
      const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).download(attachment.path);
      if (error || !data) {
        setAttachmentError("تعذر فتح الملف حالياً.");
        return;
      }
      const blobUrl = URL.createObjectURL(data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 300000);
    } catch {
      setAttachmentError("تعذر فتح الملف حالياً.");
    }
  };

  const playNotificationSound = () => {
    try {
      const ctx = audioRef.current ?? new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
      audioRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {
      /* AudioContext unavailable */
    }
  };

  const notifyOtherParty = () => {
    const recipient = role === "client" ? currentConversation?.providerName : currentConversation?.clientName;
    const time = now();
    void insertMessage({ id: `m-${Date.now()}`, conversation_id: activeConversationId, sender: "system", text: `تم إرسال تنبيه إلى ${recipient}.`, taameed_id: null, display_time: time }).then(() => {
      void updateConversationPreview(activeConversationId, "تم إرسال تنبيه", time);
    });
    playNotificationSound();
  };

  useEffect(() => {
    if (screen === "chat") {
      void loadMessages(activeConversationId);
      void loadConversationTaameeds(activeConversationId);
    }
  }, [activeConversationId, screen]);

  useEffect(() => {
    if (screen === "chat" && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, screen]);

  const acceptOffer = (offer: OfferRow) => {
    const request = requests.find((item) => item.id === selectedRequestId) ?? requests[0];
    const conversationId = `conv-${request.id}-${offer.id}`;
    setActiveOffer({ offer, request });
    setActiveConversationId(conversationId);
    void insertConversation({ id: conversationId, request_id: request.id, title: request.title, client_name: "أبو يزن", provider_name: offer.muqeeb, last_message: "تم قبول العرض وبدأ التوافق.", last_message_time: now() }).then(() => {
      void insertMessage({ id: `m-${Date.now()}`, conversation_id: conversationId, sender: "system", text: `تم قبول عرض ${offer.muqeeb}. بدأت المحادثة للتوافق على التفاصيل قبل إنشاء التعميد.`, taameed_id: null, display_time: now() });
    }).catch(() => setDataError("تعذر إنشاء المحادثة."));
    setScreen("chat");
  };

  const createTaameed = (title: string, terms: string, amount: number, date: string) => {
    const id = "TM-" + Math.floor(1000 + Math.random() * 9000);
    const time = now();
    void insertTaameed({ id, conversation_id: activeConversationId, title, terms, amount, date, status: "pending_payment" }).then(() => {
      void insertMessage({ id: `m-${Date.now()}`, conversation_id: activeConversationId, sender: "muqeeb", text: null, taameed_id: id, display_time: time });
      void updateConversationPreview(activeConversationId, "تم إرسال التعميد المتفق عليه", time);
    }).catch(() => setDataError("تعذر إنشاء التعميد."));
    setSheet(false);
    setScreen("chat");
  };

  const withdrawFromAgreement = () => {
    if (hasPaidTaameed) return;
    const time = now();
    void deleteTaameedsByConversation(activeConversationId).then(() => {
      void insertMessage({ id: `m-${Date.now()}`, conversation_id: activeConversationId, sender: "system", text: "قام " + (role === "client" ? "العميل" : "مقدم الخدمة") + " بالانسحاب قبل الدفع وإعادة الطلب إلى صالة العروض.", taameed_id: null, display_time: time });
      void updateConversationPreview(activeConversationId, "تم الانسحاب وعاد الطلب للصالة", time);
    });
    setActiveOffer(null);
    setScreen("lounge");
  };

  const closeConversation = () => {
    if (hasPaidTaameed) return;
    const time = now();
    const actor = role === "client" ? "العميل" : "مقدم الخدمة";
    void insertMessage({ id: `m-${Date.now()}`, conversation_id: activeConversationId, sender: "system", text: "قام " + actor + " بإغلاق المحادثة.", taameed_id: null, display_time: time }).then(() => {
      void updateConversationPreview(activeConversationId, "تم إغلاق المحادثة", time);
    });
    setActiveOffer(null);
    setScreen("conversations");
  };

  const confirmPaid = (id: string) => {
    const time = now();
    void updateTaameedStatus(id, "paid").then(() => {
      void insertMessage({ id: `m-${Date.now()}`, conversation_id: activeConversationId, sender: "system", text: `تم سداد التعميد ${id} والمبلغ محجوز بأمان تحت الضمان 🔒`, taameed_id: null, display_time: time });
      void updateConversationPreview(activeConversationId, "تم سداد التعميد وحجز المبلغ", time);
    });
    setScreen("success");
  };

  const raiseDispute = () => {
    if (!hasPaidTaameed || !disputeConfirm) return;
    const time = now();
    void insertDispute(activeConversationId).then(() => {
      void insertMessage({ id: `m-${Date.now()}`, conversation_id: activeConversationId, sender: "system", text: "تم رفع نزاع مالي إلى إدارة التحكيم وتجميد المبالغ المحجوزة.", taameed_id: null, display_time: time });
      void updateConversationPreview(activeConversationId, "تم رفع نزاع مالي", time);
    });
    setDisputeConfirm(false);
  };

  const confirmRaiseDispute = () => setDisputeConfirm(true);

  const submitOffer = (request: RequestRow, price: number, days: number, note: string) => {
    const id = "O" + Date.now();
    const muqeebName = "مكتب الرياض للتعقيب المعتمد";
    void insertOffer({ id, request_id: request.id, muqeeb: muqeebName, rating: 4.8, price, days, note }).then(() => {
      void incrementRequestBids(request.id);
      setBidSent((b) => [...b, request.id]);
    }).catch(() => setDataError("تعذر إرسال العرض."));
    setOfferModal(null);
  };

  const openDashboardDetail = (title: string, nextScreen?: Screen) => {
    setDashboardDetail(title);
    setScreen(nextScreen ?? "dashboard-detail");
  };

  const inApp = !["welcome", "login", "otp", "payment", "success"].includes(screen);

  return (
    <div dir="rtl" className="h-[100dvh] bg-surface flex justify-center sm:py-6">
      <div className="relative w-full max-w-md bg-background sm:rounded-3xl shadow-elevated overflow-hidden flex flex-col h-[100dvh] sm:h-[860px] sm:max-h-[calc(100dvh-3rem)]">
        {screen === "welcome" && (
          <div className="flex-1 flex flex-col bg-gradient-to-b from-navy to-navy-deep text-navy-foreground">
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="size-24 rounded-3xl bg-gold/15 border border-gold/40 grid place-items-center"><Shield className="size-12 text-gold" /></div>
              <h1 className="text-5xl font-black">ضامن</h1>
              <p className="text-navy-foreground/70 text-sm leading-7">المنصة السعودية للوساطة والتعميد المالي الآمن<br />بين العملاء ومكاتب التعقيب المعتمدة</p>
            </div>
            <div className="bg-background text-foreground rounded-t-3xl p-6 space-y-3">
              <p className="font-bold text-center mb-2">اختر طريقة الدخول</p>
              <RoleBtn icon={<Briefcase />} label="تسجيل دخول كعميل" sub="Client" onClick={() => { setRole("client"); setScreen("login"); }} />
              <RoleBtn icon={<Building2 />} label="تسجيل دخول كمقدم خدمة / معقب" sub="Muqeeb" gold onClick={() => { setRole("muqeeb"); setScreen("login"); }} />
            </div>
          </div>
        )}

        {screen === "login" && (
          <div className="flex-1 p-6 flex flex-col gap-6">
            <BackBtn onClick={() => setScreen("welcome")} />
            <div>
              <h2 className="text-2xl font-black text-navy">تسجيل الدخول</h2>
              <p className="text-muted-foreground text-sm mt-1">{role === "client" ? "حساب العميل" : "حساب مقدم الخدمة / المعقب"}</p>
            </div>
            <div className="rounded-2xl border p-5 shadow-card space-y-4">
              <label className="block text-sm font-bold">رقم الجوال</label>
              <div dir="ltr" className="flex items-center rounded-xl border overflow-hidden">
                <span className="px-3 py-3 bg-surface font-bold text-navy">+966</span>
                <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="5XXXXXXXX" className="flex-1 px-3 py-3 outline-none bg-transparent" inputMode="numeric" />
              </div>
              <label className="block text-sm font-bold">كلمة المرور</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border px-3 py-3 outline-none" placeholder="••••••••" />
              <PrimaryBtn disabled={mobile.length < 9 || !password} onClick={() => { setTimer(60); setOtp(["", "", "", ""]); setScreen("otp"); }}>دخول</PrimaryBtn>
            </div>
          </div>
        )}

        {screen === "otp" && (
          <div className="flex-1 p-6 flex flex-col gap-6">
            <BackBtn onClick={() => setScreen("login")} />
            <div className="text-center space-y-2">
              <div className="mx-auto size-16 rounded-2xl bg-money-soft grid place-items-center"><Lock className="text-money" /></div>
              <h2 className="text-2xl font-black text-navy">رمز التحقق</h2>
              <p className="text-sm text-muted-foreground">أرسلنا رمزاً من 4 أرقام إلى <span dir="ltr" className="font-bold">+966 {mobile}</span></p>
            </div>
            <div dir="ltr" className="flex justify-center gap-3">
              {otp.map((d, i) => (
                <input key={i} id={`otp-${i}`} value={d} inputMode="numeric" maxLength={1}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); const n = [...otp]; n[i] = v; setOtp(n); if (v && i < 3) document.getElementById(`otp-${i + 1}`)?.focus(); }}
                  className="size-14 text-center text-2xl font-black rounded-xl border-2 focus:border-money outline-none" />
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {timer > 0 ? <>إعادة الإرسال خلال <b className="text-navy">{timer}</b> ثانية</> : <button className="text-money font-bold" onClick={() => setTimer(60)}>إعادة إرسال الرمز</button>}
            </p>
            <PrimaryBtn disabled={otp.join("").length < 4} onClick={() => { saveSession({ role, loggedIn: true }); setScreen("home"); }}>تحقق ومتابعة</PrimaryBtn>
            <p className="text-center text-xs text-muted-foreground">نموذج تجريبي: أدخل أي 4 أرقام</p>
          </div>
        )}

        {inApp && screen !== "chat" && (
          <header className="bg-navy text-navy-foreground px-5 pt-6 pb-5 flex items-center justify-between shrink-0">
            <div>
              <p className="text-xs text-navy-foreground/60">{role === "client" ? "لوحة تحكم العميل" : "لوحة تحكم مقدم الخدمة"}</p>
              <h1 className="text-xl font-black flex items-center gap-2"><Shield className="size-5 text-gold" /> {role === "client" ? "أبو يزن" : "مكتب الرياض للتعقيب المعتمد"}</h1>
            </div>
            <button onClick={logout} className="p-2 rounded-xl bg-navy-foreground/10" aria-label="خروج"><LogOut className="size-5" /></button>
          </header>
        )}

        {screen === "home" && (
          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            {dataError && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{dataError}</div>}
            {role === "client" ? (
              <div className="grid grid-cols-2 gap-3">
                <Stat label="المبالغ المحجوزة بالضمان" value={fmtSAR(escrow)} money wide />
                <Stat label="معاملات مكتملة" value="12" onClick={() => openDashboardDetail("المعاملات المكتملة")} />
                <Stat label="عروض بانتظارك" value={String(selectedOffers.length)} onClick={() => openDashboardDetail("عروض الأسعار", "offers")} />
                <Stat label="بانتظار السداد" value={String(pending)} onClick={() => openDashboardDetail("المحادثات بانتظار السداد", "conversations")} />
                <Stat label="نزاعات" value={hasPaidTaameed ? "1" : "0"} onClick={() => openDashboardDetail("النزاعات", "chat")} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Stat label="أرباح محجوزة تحت الضمان" value={fmtSAR(escrow)} money wide />
                <Stat label="عروض منشورة" value={String(bidSent.length + 3)} />
                <Stat label="أعمال جارية" value={String(taameeds.length)} onClick={() => openDashboardDetail("الأعمال الجارية", "conversations")} />
                <Stat label="بانتظار سداد العميل" value={String(pending)} onClick={() => openDashboardDetail("المحادثات بانتظار السداد", "conversations")} />
                <Stat label="تنبيهات نزاع" value={hasPaidTaameed ? "1" : "0"} onClick={() => openDashboardDetail("النزاعات", "chat")} />
              </div>
            )}
            {hasPaidTaameed && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm flex gap-2"><AlertTriangle className="text-destructive size-5 shrink-0" /> تم رفع نزاع مالي وتجميد المبلغ لحين قرار التحكيم.</div>}
            <Section title="التعميدات النشطة">
              {taameeds.map((t) => (
                <button key={t.id} onClick={() => openConversation(t.conversationId)} className="w-full text-right rounded-2xl border p-4 shadow-card flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t.id}</p>
                    <p className="font-bold truncate">{t.title}</p>
                    <StatusBadge s={t.status} />
                  </div>
                  <p className="font-black text-money whitespace-nowrap">{fmtSAR(t.amount)}</p>
                </button>
              ))}
            </Section>
            {role === "muqeeb" && <PrimaryBtn onClick={() => setScreen("proposal")}><Plus className="size-5" /> إنشاء عرض سعر جديد</PrimaryBtn>}
          </main>
        )}

        {screen === "offers" && (
          <main className="flex-1 overflow-y-auto p-4 space-y-3">
            <div><h2 className="font-black text-lg text-navy">عروض الأسعار المستلمة</h2><p className="text-sm text-muted-foreground mt-1">اختر المعاملة لعرض عروضها فقط</p></div>
            <div className="space-y-2">
              {requests.map((request) => <button key={request.id} onClick={() => setSelectedRequestId(request.id)} className={`w-full text-right rounded-xl border p-3 ${selectedRequestId === request.id ? "border-money bg-money-soft" : "bg-background"}`}><p className="font-bold text-sm">{request.title}</p><p className="text-xs text-muted-foreground mt-1">{request.bids} عروض متاحة</p></button>)}
            </div>
            {selectedOffers.map((o) => (
              <div key={o.id} className="rounded-2xl border p-4 shadow-card space-y-3">
                <div className="flex justify-between items-start">
                  <div><p className="font-bold">{o.muqeeb}</p><p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="size-3 fill-gold text-gold" /> {o.rating}</p></div>
                  <p className="font-black text-money">{fmtSAR(o.price)}</p>
                </div>
                <p className="text-sm text-muted-foreground">{o.note}</p>
                <div className="flex items-center gap-1 text-sm text-navy"><Clock className="size-4" /> مدة الإنجاز: {o.days} أيام</div>
                <PrimaryBtn onClick={() => acceptOffer(o)}>قبول العرض وفتح المحادثة</PrimaryBtn>
              </div>
            ))}
          </main>
        )}

        {screen === "dashboard-detail" && (
          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            <BackBtn onClick={() => setScreen("home")} />
            <h2 className="font-black text-lg text-navy">{dashboardDetail}</h2>
            <div className="rounded-2xl border bg-surface p-5 text-center space-y-2"><CheckCircle2 className="mx-auto size-10 text-money" /><p className="font-bold">تم فتح قسم {dashboardDetail}</p><p className="text-sm text-muted-foreground">ستظهر هنا تفاصيل هذا القسم عند توفر معاملات مرتبطة بحسابك.</p></div>
          </main>
        )}

        {screen === "conversations" && (
          <main className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div><h2 className="font-black text-lg text-navy">المحادثات</h2><p className="text-sm text-muted-foreground">محادثة مستقلة لكل معاملة</p></div>
              <MessageSquare className="text-money" />
            </div>
            {conversations.map((conversation) => {
              const u = unread[conversation.id] ?? 0;
              return (
              <button key={conversation.id} onClick={() => openConversation(conversation.id)} className="w-full text-right rounded-2xl border p-4 shadow-card space-y-2 transition hover:border-money relative">
                {u > 0 && <span className="absolute top-3 left-3 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-black grid place-items-center">{u}</span>}
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-xl bg-money-soft text-money grid place-items-center shrink-0"><MessageSquare className="size-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className={`truncate ${u > 0 ? "font-black" : "font-bold"}`}>{conversation.title}</p><span className="text-xs text-muted-foreground whitespace-nowrap">{conversation.time}</span></div><p className="text-xs text-navy mt-1">{role === "client" ? conversation.providerName : conversation.clientName}</p><p className={`text-sm truncate mt-1 ${u > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{conversation.lastMessage}</p></div>
                </div>
              </button>
              );
            })}
          </main>
        )}

        {screen === "proposal" && <ProposalBuilder onBack={() => setScreen("home")} onSubmit={() => setScreen("lounge")} />}

        {screen === "lounge" && (
          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            <h2 className="font-black text-lg text-navy">صالة العروض والمشاريع</h2>
            {role === "client" && (
              <div className="rounded-2xl border border-gold/50 bg-gold-soft p-4 space-y-3">
                <p className="font-bold">انشر معاملة جديدة</p>
                <input value={newReq.title} onChange={(e) => setNewReq({ ...newReq, title: e.target.value })} placeholder="عنوان المعاملة" className="w-full rounded-xl border bg-background px-3 py-2.5 outline-none" />
                <select value={newReq.sector} onChange={(e) => setNewReq({ ...newReq, sector: e.target.value })} className="w-full rounded-xl border bg-background px-3 py-2.5">
                  {SECTORS.slice(1).map((s) => <option key={s}>{s}</option>)}
                </select>
                <textarea value={newReq.desc} onChange={(e) => setNewReq({ ...newReq, desc: e.target.value })} placeholder="تفاصيل المعاملة" rows={2} className="w-full rounded-xl border bg-background px-3 py-2.5 outline-none" />
                <PrimaryBtn disabled={!newReq.title} onClick={() => { const id = "R" + Date.now(); void insertRequest({ id, title: newReq.title, sector: newReq.sector, description: newReq.desc, bids: 0, budget: "مفتوح" }); setNewReq({ title: "", sector: "أبشر", desc: "" }); }}>نشر في الصالة</PrimaryBtn>
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Filter className="size-4 text-muted-foreground shrink-0 mt-2" />
              {SECTORS.map((s) => (
                <button key={s} onClick={() => setSector(s)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${sector === s ? "bg-navy text-navy-foreground border-navy" : "bg-background"}`}>{s}</button>
              ))}
            </div>
            {requests.filter((r) => sector === "الكل" || r.sector === sector).map((r) => (
              <div key={r.id} className="rounded-2xl border p-4 shadow-card space-y-2">
                <div className="flex gap-2 text-xs"><span className="px-2 py-0.5 rounded-full bg-gold-soft text-navy font-bold">{r.sector}</span><span className="px-2 py-0.5 rounded-full bg-surface">{r.bids} عروض</span><span className="px-2 py-0.5 rounded-full bg-money-soft text-money font-bold">{r.budget}</span></div>
                <p className="font-bold">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
                {role === "muqeeb" ? (
                  bidSent.includes(r.id)
                    ? <p className="text-sm text-money font-bold flex items-center gap-1"><CheckCircle2 className="size-4" /> تم إرسال عرضك</p>
                    : <PrimaryBtn onClick={() => setOfferModal(r)}>تقديم عرض سعر فوري</PrimaryBtn>
                ) : (
                  <button onClick={() => { setSelectedRequestId(r.id); setScreen("offers"); }} className="text-sm font-bold text-navy">مقارنة عروض هذه المعاملة ←</button>
                )}
              </div>
            ))}
          </main>
        )}

        {screen === "chat" && currentConversation && (
          <div className="flex-1 flex flex-col min-h-0">
            <header className="bg-navy text-navy-foreground px-4 py-4 flex items-center gap-3">
              <button onClick={() => setScreen("conversations")} aria-label="العودة إلى المحادثات"><ArrowRight /></button>
              <div className="size-10 rounded-full bg-gold/20 grid place-items-center font-black text-gold">{role === "client" ? "م" : "ع"}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{role === "client" ? currentConversation.providerName : currentConversation.clientName}</p>
                <p className="text-xs text-gold truncate">{currentConversation.title}</p>
                <p className="text-xs text-navy-foreground/60">{hasPaidTaameed ? "⚠️ تحت التحكيم المالي" : "متصل الآن"}</p>
              </div>
              <div className="flex items-center gap-2">
                {!hasPaidTaameed && (
                  <>
                    <button onClick={closeConversation} className="size-10 rounded-full bg-navy-foreground/15 text-navy-foreground grid place-items-center shadow-card" aria-label="إغلاق المحادثة"><X className="size-5" /></button>
                    <button onClick={withdrawFromAgreement} className="size-10 rounded-full bg-gold-soft text-navy grid place-items-center shadow-card" aria-label="الانسحاب وإعادة الطلب للصالة"><LogOut className="size-5" /></button>
                  </>
                )}
                {hasPaidTaameed && <button onClick={confirmRaiseDispute} className="size-10 rounded-full bg-destructive grid place-items-center shadow-card" aria-label="رفع نزاع"><Scale className="size-5 text-navy-foreground" /></button>}
                <button onClick={notifyOtherParty} className="size-10 rounded-full bg-money-soft text-money grid place-items-center shadow-card" aria-label="إرسال تنبيه للطرف الآخر"><BellRing className="size-5" /></button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto bg-surface p-4 space-y-3">
              {msgs.map((m) => {
                if (m.from === "system") return <p key={m.id} className="text-center text-xs bg-gold-soft text-navy rounded-xl px-3 py-2 mx-6">{m.text}</p>;
                const mine = m.from === role;
                const t = m.taameedId ? taameeds.find((x) => x.id === m.taameedId) : null;
                if (t) {
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                      <TaameedCard t={t} role={role} onPay={() => { setPayFor(t.id); setScreen("payment"); }} onWithdraw={withdrawFromAgreement} />
                    </div>
                  );
                }
                if (m.attachment) {
                  const isImage = m.attachment.mimeType.startsWith("image/");
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                      <AttachmentBubble attachment={m.attachment} mine={mine} time={m.time} onView={() => void viewAttachment(m.attachment!)} onDownload={() => void downloadAttachment(m.attachment!)} />
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${mine ? "bg-money text-money-foreground rounded-tr-sm" : "bg-background border rounded-tl-sm"}`}>
                      {m.text}<p className={`text-[10px] mt-1 ${mine ? "text-money-foreground/70" : "text-muted-foreground"}`}>{m.time}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            {attachmentError && <p className="px-3 pt-2 text-xs text-destructive bg-surface">{attachmentError}</p>}
            {dataError && <p className="px-3 pt-2 text-xs text-destructive bg-surface">{dataError}</p>}
            <div className="p-3 border-t bg-background flex gap-2 items-center">
              <label className="size-11 rounded-xl bg-surface text-navy grid place-items-center cursor-pointer" aria-label="رفع مستند أو صورة"><Paperclip className="size-5" /><input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => void uploadAttachment(event)} disabled={uploading} /></label>
              {role === "muqeeb" && !hasPendingTaameed && <button onClick={() => setSheet(true)} className="size-11 rounded-xl bg-gold-soft text-navy grid place-items-center" aria-label="إنشاء التعميد المتفق عليه"><FileText className="size-5" /></button>}
              <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMsg()} placeholder={uploading ? "جاري رفع الملف..." : "اكتب رسالتك..."} className="flex-1 rounded-xl bg-surface px-4 py-3 outline-none" />
              <button onClick={sendMsg} className="size-11 rounded-xl bg-money text-money-foreground grid place-items-center" aria-label="إرسال"><Send className="size-5 -scale-x-100" /></button>
            </div>
          </div>
        )}

        {screen === "payment" && payFor && (
          <PaymentScreen t={taameeds.find((x) => x.id === payFor)!} onBack={() => setScreen("chat")} onDone={() => confirmPaid(payFor)} />
        )}

        {screen === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="size-24 rounded-full bg-money-soft grid place-items-center animate-in zoom-in"><CheckCircle2 className="size-14 text-money" /></div>
            <h2 className="text-2xl font-black text-navy leading-10">تم سداد التعميد بنجاح والمبلغ محجوز بأمان تحت الضمان</h2>
            <p className="text-muted-foreground text-sm">لن يتم تحويل المبلغ للمعقب إلا بعد تأكيدك لإنجاز المعاملة.</p>
            <PrimaryBtn onClick={() => setScreen("chat")}>العودة للمحادثة</PrimaryBtn>
          </div>
        )}

        {inApp && screen !== "chat" && (
          <nav className="bg-background border-t grid grid-cols-4 py-2 shrink-0">
            <NavBtn icon={<Home />} label="الرئيسية" active={screen === "home"} onClick={() => setScreen("home")} />
            <NavBtn icon={<Compass />} label="الصالة" active={screen === "lounge"} onClick={() => setScreen("lounge")} />
            <NavBtn icon={<MessageSquare />} label="المحادثات" active={screen === "conversations"} onClick={() => setScreen("conversations")} badge={totalUnread} />
            {role === "client"
              ? <NavBtn icon={<Wallet />} label="العروض" active={screen === "offers"} onClick={() => setScreen("offers")} />
              : <NavBtn icon={<FileText />} label="عرض سعر" active={screen === "proposal"} onClick={() => setScreen("proposal")} />}
          </nav>
        )}

        {sheet && <CreateTaameedSheet onClose={() => setSheet(false)} onSubmit={createTaameed} />}
        {offerModal && <OfferSheet request={offerModal} onClose={() => setOfferModal(null)} onSubmit={(price, days, note) => submitOffer(offerModal, price, days, note)} />}
        {disputeConfirm && <ConfirmDialog title="تأكيد رفع النزاع" message="سيتم رفع نزاع مالي إلى إدارة التحكيم وتجميد المبالغ المحجوزة لحين البت. هل أنت متأكد؟" confirmLabel="نعم، رفع النزاع" destructive onConfirm={raiseDispute} onCancel={() => setDisputeConfirm(false)} />}
        {backToast && (
          <div className="absolute bottom-24 inset-x-0 z-40 flex justify-center pointer-events-none">
            <div className="bg-navy-deep/95 text-navy-foreground text-sm font-bold px-4 py-2.5 rounded-full shadow-elevated">اضغط زر الرجوع مرة أخرى للخروج</div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaameedCard({ t, role, onPay, onWithdraw }: { t: Taameed; role: Role; onPay: () => void; onWithdraw: () => void }) {
  return (
    <div className="w-[88%] bg-background rounded-2xl border-2 border-gold/60 shadow-card p-4 space-y-3">
      <div className="flex items-center gap-2"><Shield className="size-5 text-gold fill-gold/20" /><p className="font-black text-navy">طلب تعميد مالي رسمي</p><span className="mr-auto text-[10px] text-muted-foreground">{t.id}</span></div>
      <div className="h-px bg-border" />
      <p className="font-bold text-sm">{t.title}</p>
      <p className="text-sm text-muted-foreground leading-6">{t.terms}</p>
      <p className="text-sm">⏱️ موعد الإنجاز: <span className="font-bold text-navy">{fmtDate(t.date)}</span></p>
      <div className="rounded-xl bg-money-soft p-3"><p className="text-xs text-muted-foreground">قيمة التعميد المحجوزة:</p><p className="text-2xl font-black text-money">{fmtSAR(t.amount)}</p></div>
      {role === "client" ? (
        t.status === "paid"
          ? <StatusBadge s="paid" />
          : <button onClick={onPay} className="w-full py-3.5 rounded-xl bg-money text-money-foreground font-black transition hover:brightness-95 active:scale-[0.98]">سداد قيمة التعميد والبدء</button>
      ) : (
        <div className={`w-full py-3 rounded-xl text-center font-bold text-sm ${t.status === "paid" ? "bg-money-soft text-money" : "bg-gold-soft text-navy"}`}>{t.status === "paid" ? "التعميد نشط - قيد التنفيذ" : "بانتظار سداد العميل"}</div>
      )}
      {t.status === "pending_payment" && <button onClick={onWithdraw} className="w-full py-2.5 rounded-xl border border-destructive/30 text-destructive font-bold text-sm">الانسحاب وإعادة الطلب إلى الصالة</button>}
    </div>
  );
}

function AttachmentBubble({ attachment, mine, time, onView, onDownload }: { attachment: MsgAttachment; mine: boolean; time: string; onView: () => void; onDownload: () => void }) {
  const isImage = attachment.mimeType.startsWith("image/");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;
    void supabase.storage.from(ATTACHMENTS_BUCKET).download(attachment.path).then(({ data }) => {
      if (active && data) {
        blobUrl = URL.createObjectURL(data);
        setUrl(blobUrl);
      }
    });
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [attachment.path]);
  const fmtSize = (n: number) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`;
  if (isImage) {
    return (
      <div className={`max-w-[80%] rounded-2xl overflow-hidden ${mine ? "bg-money rounded-tr-sm" : "bg-background border rounded-tl-sm"} shadow-card`}>
        <button onClick={onView} className="block relative w-full" aria-label="فتح الصورة">
          {url ? <img src={url} alt={attachment.name} className="w-full max-h-72 object-cover" /> : <div className="w-full h-48 grid place-items-center bg-surface"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
          <span className="absolute top-2 left-2 size-8 rounded-full bg-black/40 grid place-items-center"><Eye className="size-4 text-white" /></span>
        </button>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className={`text-[10px] truncate flex-1 ${mine ? "text-money-foreground/80" : "text-muted-foreground"}`}>{attachment.name}</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] ${mine ? "text-money-foreground/70" : "text-muted-foreground"}`}>{time}</span>
            <button onClick={onDownload} className={`p-1 ${mine ? "text-money-foreground/90" : "text-money"}`} aria-label="تحميل الصورة"><Download className="size-3.5" /></button>
          </div>
        </div>
      </div>
    );
  }
  const ext = attachment.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return (
    <div className={`max-w-[80%] rounded-2xl overflow-hidden ${mine ? "bg-money text-money-foreground rounded-tr-sm" : "bg-background border rounded-tl-sm"} shadow-card p-3 flex items-center gap-3`}>
      <div className={`size-12 rounded-xl grid place-items-center shrink-0 ${mine ? "bg-money-foreground/15" : "bg-gold-soft"}`}>
        {ext === "PDF" ? <FileText className={`size-6 ${mine ? "text-money-foreground" : "text-money"}`} /> : <FileIcon className={`size-6 ${mine ? "text-money-foreground" : "text-money"}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{attachment.name}</p>
        <p className={`text-[10px] ${mine ? "text-money-foreground/70" : "text-muted-foreground"}`}>{ext} · {fmtSize(attachment.size)} · {time}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onView} className={`p-2 rounded-lg ${mine ? "hover:bg-money-foreground/10" : "hover:bg-surface"}`} aria-label="عرض الملف"><Eye className="size-4" /></button>
        <button onClick={onDownload} className={`p-2 rounded-lg ${mine ? "hover:bg-money-foreground/10" : "hover:bg-surface"}`} aria-label="تحميل الملف"><Download className="size-4" /></button>
      </div>
    </div>
  );
}

function OfferSheet({ request, onClose, onSubmit }: { request: RequestRow; onClose: () => void; onSubmit: (price: number, days: number, note: string) => void }) {
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="absolute inset-0 z-20 bg-navy-deep/60 flex items-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full bg-background rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-border" />
        <div className="flex justify-between items-center"><div><h3 className="font-black text-lg text-navy">تقديم عرض سعر</h3><p className="text-xs text-muted-foreground">{request.title}</p></div><button onClick={onClose} aria-label="إغلاق"><X /></button></div>
        <Field label="السعر التقريبي (ر.س)"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="w-full rounded-xl border px-3 py-3 outline-none font-bold text-money" placeholder="0" /></Field>
        <Field label="مدة الإنجاز (أيام)"><input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="w-full rounded-xl border px-3 py-3 outline-none" placeholder="0" /></Field>
        <Field label="نص العرض وملاحظاته"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-xl border px-3 py-3 outline-none" placeholder="اشرح منهجية التنفيذ والملاحظات..." /></Field>
        <PrimaryBtn disabled={!Number(price) || !Number(days)} onClick={() => onSubmit(Number(price), Number(days), note || "عرض سعر احترافي مع ضمان الجودة.")}>إرسال العرض للعميل</PrimaryBtn>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, destructive, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-30 bg-navy-deep/60 grid place-items-center p-6" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full bg-background rounded-3xl p-5 space-y-4 shadow-elevated animate-in zoom-in">
        <div className="size-14 rounded-2xl bg-destructive/10 grid place-items-center mx-auto"><AlertTriangle className="size-7 text-destructive" /></div>
        <h3 className="font-black text-lg text-navy text-center">{title}</h3>
        <p className="text-sm text-muted-foreground text-center leading-6">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border font-bold text-sm">إلغاء</button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-black text-sm text-white ${destructive ? "bg-destructive" : "bg-money"}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function CreateTaameedSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (a: string, b: string, c: number, d: string) => void }) {
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  return (
    <div className="absolute inset-0 z-20 bg-navy-deep/60 flex items-end" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full bg-background rounded-t-3xl p-5 space-y-3 animate-in slide-in-from-bottom">
        <div className="mx-auto w-12 h-1.5 rounded-full bg-border" />
        <div className="flex justify-between items-center"><h3 className="font-black text-lg text-navy">إنشاء التعميد المتفق عليه</h3><button onClick={onClose} aria-label="إغلاق"><X /></button></div>
        <Field label="عنوان المعاملة"><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
        <Field label="تفاصيل وشروط التعميد"><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المبلغ (ر.س)"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="w-full rounded-xl border px-3 py-3 outline-none font-bold text-money" /></Field>
          <Field label="موعد الإنجاز"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
        </div>
        <PrimaryBtn disabled={!title || !terms || !Number(amount)} onClick={() => onSubmit(title, terms, Number(amount), date)}>إرسال التعميد المتفق عليه للعميل</PrimaryBtn>
      </div>
    </div>
  );
}

function PaymentScreen({ t, onBack, onDone }: { t: Taameed; onBack: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const fee = Math.round(t.amount * 0.025 * 100) / 100;
  const ok = name && card.replace(/\s/g, "").length === 16 && exp.length === 5 && cvv.length === 3;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-gradient-to-b from-navy to-navy-deep text-navy-foreground p-5 pb-16">
        <button onClick={onBack} aria-label="رجوع"><ArrowRight /></button>
        <h2 className="text-xl font-black mt-3 flex items-center gap-2"><Lock className="size-5 text-gold" /> بوابة الدفع الآمن</h2>
        <div className="flex gap-2 mt-3 text-xs font-black">{["مدى", "VISA", "Mastercard"].map((b) => <span key={b} className="px-3 py-1 rounded-lg bg-navy-foreground/10 border border-navy-foreground/20">{b}</span>)}</div>
      </div>
      <div className="-mt-10 mx-4 rounded-2xl bg-background shadow-elevated p-4 space-y-2 text-sm">
        <p className="font-bold text-navy">ملخص الطلب</p>
        <Row k="رقم التعميد" v={t.id} />
        <Row k="قيمة التعميد" v={fmtSAR(t.amount)} />
        <Row k="رسوم الضمان (2.5%)" v={fmtSAR(fee)} />
        <div className="h-px bg-border" />
        <Row k="الإجمالي" v={<span className="text-money font-black text-lg">{fmtSAR(t.amount + fee)}</span>} />
      </div>
      <div className="p-4 space-y-3">
        <Field label="اسم حامل البطاقة"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
        <Field label="رقم البطاقة"><div className="relative"><input dir="ltr" value={card} onChange={(e) => setCard(e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim())} placeholder="0000 0000 0000 0000" inputMode="numeric" className="w-full rounded-xl border px-3 py-3 outline-none tracking-widest" /><CreditCard className="absolute left-3 top-3 text-muted-foreground" /></div></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ الانتهاء"><input dir="ltr" value={exp} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setExp(v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v); }} placeholder="MM/YY" className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
          <Field label="CVV"><input dir="ltr" type="password" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="•••" className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
        </div>
        <PrimaryBtn disabled={!ok || loading} onClick={() => { setLoading(true); setTimeout(onDone, 1800); }}>
          {loading ? <><Loader2 className="size-5 animate-spin" /> جاري المعالجة...</> : "تأكيد الدفع الآمن وعزل المبلغ 🔒"}
        </PrimaryBtn>
        <p className="text-center text-xs text-muted-foreground">نموذج تجريبي — لا يتم خصم أي مبلغ فعلي</p>
      </div>
    </div>
  );
}

function ProposalBuilder({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  const [steps, setSteps] = useState(["مراجعة المستندات", "رفع الطلب للجهة", "التسليم النهائي"]);
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <main className="flex-1 overflow-y-auto p-4 space-y-4">
      <BackBtn onClick={onBack} />
      <h2 className="font-black text-lg text-navy">مركز إعداد العروض</h2>
      <Field label="وصف تنفيذ المهمة"><textarea rows={3} className="w-full rounded-xl border px-3 py-3 outline-none" placeholder="اشرح منهجية التنفيذ..." /></Field>
      <Field label="مراحل العمل">
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2 items-center"><span className="size-7 rounded-full bg-navy text-navy-foreground grid place-items-center text-xs font-bold shrink-0">{i + 1}</span>
              <input value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 rounded-xl border px-3 py-2 outline-none" /></div>
          ))}
          <button onClick={() => setSteps([...steps, ""])} className="text-sm font-bold text-navy flex items-center gap-1"><Plus className="size-4" /> إضافة مرحلة</button>
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="السعر (ر.س)"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border px-3 py-3 outline-none font-bold text-money" /></Field>
        <Field label="المدة (أيام)"><input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border px-3 py-3 outline-none" /></Field>
      </div>
      {sent ? <p className="text-money font-bold text-center flex justify-center gap-1"><CheckCircle2 /> تم نشر العرض في الصالة</p>
        : <PrimaryBtn disabled={!price || !days} onClick={() => { setSent(true); setTimeout(onSubmit, 900); }}>نشر العرض في صالة العروض</PrimaryBtn>}
    </main>
  );
}

function RoleBtn({ icon, label, sub, gold, onClick }: { icon: ReactNode; label: string; sub: string; gold?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full p-4 rounded-2xl flex items-center gap-3 text-right font-bold shadow-card ${gold ? "bg-gold-soft border border-gold/50 text-navy" : "bg-navy text-navy-foreground"}`}>
      <span className="size-11 rounded-xl bg-background/15 grid place-items-center">{icon}</span>
      <span className="flex-1">{label}<span className="block text-xs font-normal opacity-70">{sub}</span></span>
      <ArrowRight className="rotate-180" />
    </button>
  );
}
function PrimaryBtn({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className="w-full py-3.5 rounded-xl bg-money text-money-foreground font-black flex items-center justify-center gap-2 transition hover:brightness-95 active:scale-[0.98] disabled:opacity-40">{children}</button>;
}
function BackBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="self-start p-2 -mr-2 text-muted-foreground" aria-label="رجوع"><ArrowRight /></button>;
}
function Stat({ label, value, money, wide, onClick }: { label: string; value: string; money?: boolean; wide?: boolean; onClick?: () => void }) {
  const className = `w-full text-right rounded-2xl p-4 shadow-card ${wide ? "col-span-2 bg-gradient-to-l from-navy to-navy-deep text-navy-foreground" : "border bg-background"} ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-elevated" : ""}`;
  const content = <><p className={`text-xs ${wide ? "text-navy-foreground/70" : "text-muted-foreground"}`}>{label}</p><p className={`font-black mt-1 ${wide ? "text-3xl" : "text-2xl text-navy"} ${money ? "text-money" : ""}`}>{value}</p>{onClick && <p className={`text-[11px] mt-2 ${wide ? "text-navy-foreground/60" : "text-muted-foreground"}`}>اضغط لعرض التفاصيل</p>}</>;
  return onClick ? <button onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}
function StatusBadge({ s }: { s: TStatus }) {
  return <span className={`inline-flex items-center gap-1 mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${s === "paid" ? "bg-money-soft text-money" : "bg-gold-soft text-navy"}`}>{s === "paid" ? "محجوز تحت الضمان 🔒" : "بانتظار السداد"}</span>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3"><h3 className="font-bold text-sm text-muted-foreground">{title}</h3>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm font-bold">{label}</span>{children}</label>;
}
function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-bold">{v}</span></div>;
}
function NavBtn({ icon, label, active, onClick, badge }: { icon: ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 text-xs [&_svg]:size-5 relative ${active ? "text-money font-bold" : "text-muted-foreground"}`}>
      <span className="relative">
        {icon}
        {badge && badge > 0 ? <span className="absolute -top-1.5 -left-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[9px] font-black grid place-items-center">{badge > 9 ? "9+" : badge}</span> : null}
      </span>
      {label}
    </button>
  );
}
