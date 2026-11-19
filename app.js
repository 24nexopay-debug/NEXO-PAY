(() => {
  "use strict";
  const cfg = window.NEXO_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const dialog = $("authDialog");
  let mode = "login";
  let supabase = null;
  let currentUser = null;
  let requestVersion = 0;
  $("year").textContent = new Date().getFullYear();

  if (window.supabase?.createClient && cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY) {
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  }
  const notice = (message) => { $("notice").textContent = message; };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const money = (minor, currency = "BDT") => {
    const amount = Number(minor) / 100;
    const value = Number.isFinite(amount)
      ? amount.toLocaleString("bn-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";
    return (currency === "BDT" ? "৳ " : currency + " ") + value;
  };
  const setAuthMessage = (message) => { $("authMessage").textContent = message; };
  const openAuth = (nextMode = "login") => {
    mode = nextMode;
    updateMode();
    if (!supabase) setAuthMessage("সার্ভার কনফিগারেশন পাওয়া যায়নি।");
    dialog.showModal();
  };
  $("authOpen").addEventListener("click", () => openAuth("login"));
  $("getStarted").addEventListener("click", () => openAuth("signup"));
  $("closeDialog").addEventListener("click", () => dialog.close());
  $("toggleAuth").addEventListener("click", () => {
    mode = mode === "login" ? "signup" : "login";
    updateMode();
  });
  function updateMode() {
    $("authTitle").textContent = mode === "login" ? "আপনার অ্যাকাউন্টে প্রবেশ করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন";
    $("authSubmit").textContent = mode === "login" ? "লগইন" : "সাইন আপ";
    $("toggleAuth").textContent = mode === "login" ? "নতুন অ্যাকাউন্ট খুলবেন? সাইন আপ" : "আগে থেকেই অ্যাকাউন্ট আছে? লগইন";
    $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
    setAuthMessage("");
  }

  $("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const email = $("email").value.trim();
    const password = $("password").value;
    $("authSubmit").disabled = true;
    setAuthMessage("অনুগ্রহ করে অপেক্ষা করুন…");
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email, password,
            options: { emailRedirectTo: location.origin + location.pathname }
          });
      if (result.error) throw result.error;
      if (result.data.session) {
        dialog.close();
        setAuthMessage("");
        await loadSession(result.data.session);
      } else if (mode === "signup") {
        setAuthMessage("অ্যাকাউন্ট তৈরি হয়েছে। লগইনের আগে ইমেইল যাচাই করুন।");
      } else {
        setAuthMessage("লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।");
      }
    } catch (error) {
      setAuthMessage(error.message || "অনুরোধ সম্পন্ন হয়নি।");
    } finally {
      $("authSubmit").disabled = false;
    }
  });

  $("resetPassword").addEventListener("click", async () => {
    if (!supabase) return;
    const email = $("email").value.trim();
    if (!email) { setAuthMessage("পাসওয়ার্ড রিসেটের জন্য আগে ইমেইল লিখুন।"); $("email").focus(); return; }
    $("resetPassword").disabled = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      if (error) throw error;
      setAuthMessage("ইমেইলটি Supabase-এ নিবন্ধিত থাকলে পাসওয়ার্ড রিসেটের নির্দেশনা পাঠানো হয়েছে।");
    } catch (error) {
      setAuthMessage(error.message || "রিসেট ইমেইল পাঠানো যায়নি।");
    } finally {
      $("resetPassword").disabled = false;
    }
  });

  $("claimAdmin").addEventListener("click", async () => {
    if (!supabase || !currentUser || (currentUser.email || "").toLowerCase() !== "24nexopay@gmail.com") return;
    const button = $("claimAdmin");
    button.disabled = true;
    $("adminMessage").textContent = "প্রশাসক অনুমতি যাচাই হচ্ছে…";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(cfg.ADMIN_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.SUPABASE_PUBLISHABLE_KEY,
          "Authorization": "Bearer " + session.access_token
        },
        body: JSON.stringify({ action: "bootstrap-claim" })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "প্রশাসক অনুমতি সক্রিয় হয়নি।");
      if (result.data === true) {
        $("adminMessage").textContent = "Super Admin অনুমতি সক্রিয় হয়েছে। নিরাপদে লগআউট করে আবার লগইন করুন।";
      } else {
        $("adminMessage").textContent = "প্রাথমিক প্রশাসক অনুমতি গ্রহণ করা যায়নি।";
      }
    } catch (error) {
      $("adminMessage").textContent = error.message || "অনুমতি যাচাই ব্যর্থ হয়েছে।";
    } finally {
      button.disabled = false;
    }
  });

  $("signOut").addEventListener("click", async () => {
    if (!supabase) return;
    $("signOut").disabled = true;
    const { error } = await supabase.auth.signOut();
    $("signOut").disabled = false;
    if (error) notice("লগআউট সম্পন্ন হয়নি: " + error.message);
  });

  function clearDashboard() {
    currentUser = null;
    $("userStatus").textContent = "আপনি লগইন করেননি";
    $("signOut").classList.add("hidden");
    $("transactions").textContent = "অ্যাকাউন্টে লগইন করলে তথ্য দেখা যাবে।";
    $("walletBalance").textContent = "৳ —";
    $("heroBalance").textContent = "৳ —";
    $("transactionCount").textContent = "—";
    $("merchantMessage").textContent = "আবেদন করতে প্রথমে লগইন করুন।";
    $("adminBootstrap").classList.add("hidden");
  }

  async function loadSession(session) {
    const user = session?.user;
    if (!user) {
      requestVersion++;
      clearDashboard();
      return;
    }
    currentUser = user;
    const version = ++requestVersion;
    $("userStatus").textContent = user.email || "স্বাগতম";
    $("signOut").classList.remove("hidden");
    $("merchantMessage").textContent = "আপনি লগইন করেছেন। ব্যবসার তথ্য দিয়ে আবেদন করুন।";
    $("adminBootstrap").classList.toggle("hidden", (user.email || "").toLowerCase() !== "24nexopay@gmail.com");
    notice("আপনার অ্যাকাউন্ট সংযুক্ত হয়েছে।");
    try {
      const [wallets, txs] = await Promise.all([
        supabase.from("wallets")
          .select("balance_minor,currency,status")
          .eq("user_id", user.id).limit(1),
        supabase.from("transactions")
          .select("id,amount_minor,currency,status,created_at,transaction_type,description")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(5)
      ]);
      if (version !== requestVersion) return;
      if (wallets.error) {
        notice("ওয়ালেট তথ্য পড়া যায়নি। Supabase নীতি বা সংযোগ যাচাই প্রয়োজন।");
      } else if (wallets.data?.length) {
        const w = wallets.data[0];
        const value = money(w.balance_minor, w.currency);
        $("walletBalance").textContent = value;
        $("heroBalance").textContent = value;
        if (w.status !== "active") notice("আপনার ওয়ালেটের অবস্থা: " + w.status + "। লেনদেন চালুর আগে যাচাই প্রয়োজন।");
      } else {
        $("walletBalance").textContent = "৳ 0.00";
        $("heroBalance").textContent = "৳ 0.00";
      }
      if (!txs.error) {
        $("transactionCount").textContent = String(txs.data.length);
        $("transactions").innerHTML = txs.data.length ? txs.data.map(t => {
          const date = new Date(t.created_at).toLocaleString("bn-BD");
          const title = t.description || t.transaction_type || t.status || "লেনদেন";
          return '<div class="transaction"><span>' + escapeHtml(title) +
            '<br><small>' + escapeHtml(date) + ' · ' + escapeHtml(t.status) +
            '</small></span><b>' + escapeHtml(money(t.amount_minor, t.currency)) + '</b></div>';
        }).join("") : "এখনো কোনো লেনদেন নেই।";
      } else {
        $("transactions").textContent = "লেনদেনের তথ্য এই মুহূর্তে পড়া যায়নি।";
      }
    } catch (_) {
      if (version === requestVersion) notice("অ্যাকাউন্টের তথ্য লোড করা যায়নি। পরে আবার চেষ্টা করুন।");
    }
  }

  async function loadCatalogue() {
    const operators = $("operatorList");
    const categories = $("categoryList");
    const bundles = $("bundleList");
    if (!supabase) {
      operators.textContent = categories.textContent = bundles.textContent = "Supabase সংযোগ পাওয়া যায়নি।";
      return;
    }
    try {
      const [opResult, catResult, bundleResult] = await Promise.all([
        supabase.from("telecom_operators").select("id,code,name,display_order")
          .eq("is_active", true).order("display_order", { ascending: true }),
        supabase.from("telecom_service_categories").select("code,name,display_order")
          .eq("is_active", true).order("display_order", { ascending: true }),
        supabase.from("telecom_bundles")
          .select("name,description,price_minor,data_mb,minutes,sms_count,validity_hours,recharge_type,operator_id,category_id,telecom_operators(name),telecom_service_categories(name)")
          .eq("is_active", true).order("price_minor", { ascending: true }).limit(30)
      ]);
      if (opResult.error) throw opResult.error;
      operators.innerHTML = opResult.data?.length
        ? opResult.data.map(o => '<span class="operator">' + escapeHtml(o.name) + '</span>').join("")
        : "কোনো সক্রিয় অপারেটর পাওয়া যায়নি।";
      categories.innerHTML = catResult.error ? "সেবার ধরন লোড করা যায়নি।" :
        (catResult.data?.length ? catResult.data.map(c => '<span class="operator">' + escapeHtml(c.name) + '</span>').join("") : "কোনো সেবা বিভাগ নেই।");
      if (bundleResult.error) {
        bundles.textContent = "প্যাকেজ তালিকা এই মুহূর্তে পাওয়া যাচ্ছে না।";
      } else if (!bundleResult.data?.length) {
        bundles.textContent = "এখনো কোনো সক্রিয় প্যাকেজ যোগ করা হয়নি।";
      } else {
        bundles.innerHTML = bundleResult.data.map(b => {
          const meta = [b.data_mb ? (b.data_mb >= 1024 ? (b.data_mb/1024).toFixed(1)+" GB" : b.data_mb+" MB") : "",
            b.minutes ? b.minutes+" মিনিট" : "", b.sms_count ? b.sms_count+" SMS" : "",
            b.validity_hours ? b.validity_hours+" ঘণ্টা" : ""].filter(Boolean).join(" · ");
          return '<article class="bundle"><div><b>' + escapeHtml(b.name) + '</b><small>' +
            escapeHtml(b.description || meta || "টেলিকম প্যাকেজ") + '</small></div><strong>' +
            escapeHtml(money(b.price_minor)) + '</strong></article>';
        }).join("");
      }
    } catch (_) {
      operators.textContent = "অপারেটর তালিকা লোড করা যায়নি।";
      categories.textContent = "সেবা বিভাগ লোড করা যায়নি।";
      bundles.textContent = "প্যাকেজ তালিকা লোড করা যায়নি।";
    }
  }

  $("merchantForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) { $("merchantMessage").textContent = "সার্ভার সংযোগ পাওয়া যায়নি।"; return; }
    if (!currentUser) { $("merchantMessage").textContent = "আবেদন করতে আগে লগইন করুন।"; openAuth("login"); return; }
    const button = $("merchantSubmit");
    button.disabled = true;
    $("merchantMessage").textContent = "আবেদন জমা হচ্ছে…";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("সেশন মেয়াদ শেষ। আবার লগইন করুন।");
      const response = await fetch(cfg.SUPABASE_URL + "/functions/v1/merchant-api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": cfg.SUPABASE_PUBLISHABLE_KEY,
          "Authorization": "Bearer " + session.access_token
        },
        body: JSON.stringify({
          business_name: $("businessName").value.trim(),
          business_type: $("businessType").value.trim() || null,
          contact_email: $("businessEmail").value.trim() || currentUser.email || null,
          contact_phone: $("businessPhone").value.trim() || null
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "আবেদন জমা হয়নি।");
      $("merchantMessage").textContent = "আবেদন গ্রহণ করা হয়েছে। অনুমোদনের অবস্থা: অপেক্ষমাণ।";
      $("merchantForm").reset();
    } catch (error) {
      $("merchantMessage").textContent = error.message || "আবেদন জমা দেওয়া যায়নি।";
    } finally {
      button.disabled = false;
    }
  });

  if (supabase) {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) notice("সেশন যাচাই করা যায়নি।");
      loadSession(data?.session);
    }).catch(() => notice("সেশন যাচাই করা যায়নি।"));
    supabase.auth.onAuthStateChange((_event, session) => {
      loadSession(session);
    });
    loadCatalogue();
  } else {
    clearDashboard();
    $("operatorList").textContent = "Supabase সংযোগ পাওয়া যায়নি।";
    $("categoryList").textContent = "Supabase সংযোগ পাওয়া যায়নি।";
    $("bundleList").textContent = "Supabase সংযোগ পাওয়া যায়নি।";
    notice("সাইটের ইন্টারফেস প্রস্তুত; Supabase সংযোগ যাচাই করুন।");
  }
})();