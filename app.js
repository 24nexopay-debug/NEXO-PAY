(() => {
  const cfg = window.NEXO_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const dialog = $("authDialog");
  let mode = "login";
  let supabase = null;
  if (window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  }
  const notice = (message) => { $("notice").textContent = message; };
  const openAuth = () => { if (!supabase) { $("authMessage").textContent = "সার্ভার কনফিগারেশন পাওয়া যায়নি।"; } dialog.showModal(); };
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
    } catch (error) { $("authMessage").textContent = error.message || "অনুরোধ সম্পন্ন হয়নি।"; }
    finally { $("authSubmit").disabled = false; }
  });
  $("signOut").addEventListener("click", async () => { await supabase?.auth.signOut(); });
  async function loadSession(session) {
    const user = session?.user;
    if (!user) {
      $("userStatus").textContent = "আপনি লগইন করেননি";
      $("signOut").classList.add("hidden");
      $("transactions").textContent = "অ্যাকাউন্টে লগইন করলে তথ্য দেখা যাবে।";
      $("walletBalance").textContent = "৳ —";
      $("heroBalance").textContent = "৳ —";
      $("transactionCount").textContent = "—";
      return;
    }
    $("userStatus").textContent = user.email || "স্বাগতম";
    $("signOut").classList.remove("hidden");
    notice("আপনার অ্যাকাউন্ট সংযুক্ত হয়েছে।");
    const [wallets, txs] = await Promise.all([
      supabase.from("wallets").select("balance,currency,status").eq("user_id", user.id).limit(1),
      supabase.from("transactions").select("id,amount,currency,status,created_at,type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
    ]);
    if (!wallets.error && wallets.data?.length) {
      const w = wallets.data[0];
      const amount = Number(w.balance);
      const formatted = Number.isFinite(amount) ? amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
      $("walletBalance").textContent = (w.currency === "BDT" ? "৳ " : (w.currency || "") + " ") + formatted;
      $("heroBalance").textContent = $("walletBalance").textContent;
    } else if (wallets.error) { notice("ওয়ালেট তথ্য পড়া যায়নি: " + wallets.error.message); }
    if (!txs.error) {
      $("transactionCount").textContent = String(txs.data.length);
      $("transactions").innerHTML = txs.data.length ? txs.data.map(t => {
        const date = new Date(t.created_at).toLocaleString("bn-BD");
        const amount = Number(t.amount).toLocaleString("en-BD");
        return '<div class="transaction"><span>' + escapeHtml(t.type || t.status || "লেনদেন") + '<br><small>' + escapeHtml(date) + '</small></span><b>' + escapeHtml(amount) + ' ' + escapeHtml(t.currency || "BDT") + '</b></div>';
      }).join("") : "এখনো কোনো লেনদেন নেই।";
    } else { $("transactions").textContent = "লেনদেনের তথ্য এই মুহূর্তে পড়া যায়নি।"; }
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
  async function loadCatalogue() {
    if (!supabase) { $("operatorList").textContent = "Supabase সংযোগ কনফিগার করা হয়নি।"; return; }
    const { data, error } = await supabase.from("telecom_operators").select("name,code").eq("is_active", true).order("name");
    if (error) { $("operatorList").textContent = "অপারেটর তালিকা লোড করা যায়নি।"; return; }
    $("operatorList").innerHTML = data?.length ? data.map(o => '<span class="operator">' + escapeHtml(o.name || o.code) + '</span>').join("") : "এখনো কোনো সক্রিয় অপারেটর নেই।";
  }
  if (supabase) {
    supabase.auth.getSession().then(({ data }) => loadSession(data.session));
    supabase.auth.onAuthStateChange((_event, session) => loadSession(session));
    loadCatalogue();
  } else {
    $("operatorList").textContent = "Supabase সংযোগ পাওয়া যায়নি।";
    notice("সাইটের ডেমো ইন্টারফেস প্রস্তুত; Supabase সংযোগ যাচাই করুন।");
  }
})();
