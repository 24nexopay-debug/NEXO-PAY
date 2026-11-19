(() => {
  const cfg = window.NEXO_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const dialog = $("authDialog");
  let mode = "login";
  let supabase = null;
  let currentUserId = null;
  if (window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  }
  const notice = (message) => { $("notice").textContent = message; };
  const money = (minor, currency = "BDT") => {
    const amount = Number(minor) / 100;
    const formatted = Number.isFinite(amount)
      ? amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";
    return (currency === "BDT" ? "৳ " : currency + " ") + formatted;
  };
  const openAuth = () => {
    if (!supabase) $("authMessage").textContent = "সার্ভার কনফিগারেশন পাওয়া যায়নি।";
    dialog.showModal();
  };
  $("authOpen").addEventListener("click", openAuth);
  $("getStarted").addEventListener("click", () => { mode = "signup"; updateMode(); openAuth(); });
  $("closeDialog").addEventListener("click", () => dialog.close());
  $("toggleAuth").addEventListener("click", () => { mode = mode === "login" ? "signup" : "login"; updateMode(); });
  function updateMode() {
    $("authTitle").textContent = mode === "login" ? "আপনার অ্যাকাউন্টে প্রবেশ করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন";
    $("authSubmit").textContent = mode === "login" ? "লগইন" : "সাইন আপ";
    $("toggleAuth").textContent = mode === "login" ? "নতুন অ্যাকাউন্ট খুলবেন? সাইন আপ" : "আগে থেকেই অ্যাকাউন্ট আছে? লগইন";
    $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
    $("authMessage").textContent = "";
  }
  $("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const email = $("email").value.trim();
    const password = $("password").value;
    $("authSubmit").disabled = true;
    $("authMessage").textContent = "অনুগ্রহ করে অপেক্ষা করুন…";
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (result.error) throw result.error;
      $("authMessage").textContent = mode === "signup" ? "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাই প্রয়োজন হতে পারে।" : "লগইন সফল।";
      if (result.data.session) { dialog.close(); await loadSession(result.data.session); }
    } catch (error) {
      $("authMessage").textContent = error.message || "অনুরোধ সম্পন্ন হয়নি।";
    } finally {
      $("authSubmit").disabled = false;
    }
  });
  $("signOut").addEventListener("click", async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) notice("লগআউট সম্পন্ন হয়নি: " + error.message);
  });
  async function loadSession(session) {
    const user = session?.user;
    if (!user) {
      currentUserId = null;
      $("userStatus").textContent = "আপনি লগইন করেননি";
      $("signOut").classList.add("hidden");
      $("transactions").textContent = "অ্যাকাউন্টে লগইন করলে তথ্য দেখা যাবে।";
      $("walletBalance").textContent = "৳ —";
      $("heroBalance").textContent = "৳ —";
      $("transactionCount").textContent = "—";
      return;
    }
    if (currentUserId === user.id) return;
    currentUserId = user.id;
    $("userStatus").textContent = user.email || "স্বাগতম";
    $("signOut").classList.remove("hidden");
    notice("আপনার অ্যাকাউন্ট সংযুক্ত হয়েছে।");
    try {
      const [wallets, txs] = await Promise.all([
        supabase.from("wallets").select("balance_minor,currency,status").eq("user_id", user.id).limit(1),
        supabase.from("transactions").select("id,amount_minor,currency,status,created_at,transaction_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
      ]);
      if (currentUserId !== user.id) return;
      if (!wallets.error && wallets.data?.length) {
        const w = wallets.data[0];
        const formatted = money(w.balance_minor, w.currency);
        $("walletBalance").textContent = formatted;
        $("heroBalance").textContent = formatted;
      } else if (wallets.error) {
        notice("ওয়ালেট তথ্য পড়া যায়নি: " + wallets.error.message);
      } else {
        $("walletBalance").textContent = "৳ 0.00";
        $("heroBalance").textContent = "৳ 0.00";
      }
      if (!txs.error) {
        $("transactionCount").textContent = String(txs.data.length);
        $("transactions").innerHTML = txs.data.length ? txs.data.map(t => {
          const date = new Date(t.created_at).toLocaleString("bn-BD");
          return '<div class="transaction"><span>' + escapeHtml(t.transaction_type || t.status || "লেনদেন") + '<br><small>' + escapeHtml(date) + '</small></span><b>' + escapeHtml(money(t.amount_minor, t.currency)) + '</b></div>';
        }).join("") : "এখনো কোনো লেনদেন নেই।";
      } else {
        $("transactions").textContent = "লেনদেনের তথ্য এই মুহূর্তে পড়া যায়নি।";
      }
    } catch (error) {
      if (currentUserId === user.id) notice("অ্যাকাউন্টের তথ্য লোড করা যায়নি। পরে আবার চেষ্টা করুন।");
    }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  async function loadCatalogue() {
    const target = $("operatorList");
    if (!supabase) { target.textContent = "Supabase সংযোগ কনফিগার করা হয়নি।"; return; }
    target.textContent = "অপারেটর তালিকা লোড হচ্ছে…";
    try {
      const { data, error } = await supabase.from("telecom_operators")
        .select("name,code,display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      target.innerHTML = data?.length
        ? data.map(o => '<span class="operator">' + escapeHtml(o.name || o.code) + '</span>').join("")
        : "এখনো কোনো সক্রিয় অপারেটর নেই।";
    } catch (error) {
      target.textContent = "অপারেটর তালিকা লোড করা যায়নি। পরে আবার চেষ্টা করুন।";
    }
  }
  if (supabase) {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) notice("সেশন যাচাই করা যায়নি: " + error.message);
      loadSession(data?.session);
    }).catch(() => notice("সেশন যাচাই করা যায়নি।"));
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = null;
      loadSession(session);
    });
    loadCatalogue();
  } else {
    $("operatorList").textContent = "Supabase সংযোগ পাওয়া যায়নি।";
    notice("সাইটের ডেমো ইন্টারফেস প্রস্তুত; Supabase সংযোগ যাচাই করুন।");
  }
})();