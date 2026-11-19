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
    $("adminTools").classList.add("hidden");
    $("adminDashboard").classList.add("hidden");
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
    verifyAdminAccess();
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
          .select("name,description,price_minor,data_mb,minutes,sms_count,validity_hours,recharge_type,source,operator_id,category_id,telecom_operators(name),telecom_service_categories(name)")
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
          const isDemo = String(b.name || "").startsWith("DEMO ·") || String(b.description || "").toLowerCase().includes("ডেমো");
          return '<article class="bundle"><div><b>' + escapeHtml(b.name) + (isDemo ? ' <span class="demo-tag">DEMO</span>' : '') + '</b><small>' +
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

  async function adminRequest(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("সেশন মেয়াদ শেষ। আবার লগইন করুন।");
    const response = await fetch(cfg.ADMIN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.SUPABASE_PUBLISHABLE_KEY,
        "Authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "অ্যাডমিন অনুরোধ সম্পন্ন হয়নি।");
    return result.data;
  }

  async function verifyAdminAccess() {
    const panel = $("adminTools");
    panel.classList.add("hidden");
    if (!currentUser) return;
    try {
      await adminRequest({ action: "summary" });
      panel.classList.remove("hidden");
      $("bundleAdminMessage").textContent = "Super Admin অনুমতি যাচাই হয়েছে।";
      await loadAdminDashboard();
    } catch (_) {
      $("bundleAdminMessage").textContent = "এই অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই।";
    }
  }


  async function loadAdminDashboard() {
    const panel=$("adminDashboard");
    panel.classList.add("hidden");
    if(!currentUser) return;
    try {
      const summary=await adminRequest({action:"summary"});
      const labels=[["মোট অ্যাকাউন্ট",summary.users],["ওয়ালেট",summary.wallets],["সক্রিয় ওয়ালেট",summary.active_wallets],["মোট লেনদেন",summary.transactions_total],["অপেক্ষমাণ লেনদেন",summary.transactions_pending],["অপেক্ষমাণ মার্চেন্ট",summary.merchants_pending],["খোলা রিফান্ড",summary.refunds_open],["খোলা বিরোধ",summary.disputes_open]];
      $("adminStats").innerHTML=labels.map(([label,value])=>'<div class="admin-stat"><span>'+escapeHtml(label)+'</span><strong>'+escapeHtml(Number(value||0).toLocaleString("bn-BD"))+'</strong></div>').join("");
      panel.classList.remove("hidden");
      await Promise.all([loadAdminMerchants(),loadAdminProviders(),loadAdminOperations()]);
    } catch(error) {
      $("adminDashboardMessage").textContent=error.message||"অ্যাডমিন ড্যাশবোর্ড লোড হয়নি।";
    }
  }
  async function loadAdminOperations() {
    const specs=[
      ["adminTransactions","transactions","id,reference,amount_minor,currency,status,transaction_type,created_at"],
      ["adminRefunds","refunds","id,amount_minor,reason,status,created_at"],
      ["adminDisputes","disputes","id,reason,status,created_at"]
    ];
    for(const [target,table,columns] of specs){
      const box=$(target);
      const {data,error}=await supabase.from(table).select(columns).order("created_at",{ascending:false}).limit(10);
      if(error){box.textContent="তালিকা লোড করা যায়নি।";continue;}
      if(!data?.length){box.textContent="কোনো রেকর্ড নেই।";continue;}
      box.innerHTML=data.map(row=>{
        const title=table==="transactions"?(row.reference||row.transaction_type||row.id.slice(0,8)):(row.reason||row.id.slice(0,8));
        const amount=Number.isFinite(Number(row.amount_minor))?" · "+escapeHtml(money(row.amount_minor,row.currency||"BDT")):"";
        return '<article class="admin-row admin-row-compact"><div><b>'+escapeHtml(title)+'</b><small>'+escapeHtml(row.status||"unknown")+amount+'</small><small>'+escapeHtml(new Date(row.created_at).toLocaleString("bn-BD"))+'</small></div></article>';
      }).join("");
    }
  }
  async function loadAdminMerchants() {
    const box=$("adminMerchants");
    const {data,error}=await supabase.from("merchants").select("id,business_name,business_type,contact_email,contact_phone,status,created_at").in("status",["pending","under_review"]).order("created_at",{ascending:false}).limit(30);
    if(error) { box.textContent="মার্চেন্ট তালিকা পড়া যায়নি: "+error.message; return; }
    if(!data?.length) { box.textContent="কোনো অপেক্ষমাণ আবেদন নেই।"; return; }
    box.innerHTML=data.map(m=>'<article class="admin-row"><div><b>'+escapeHtml(m.business_name)+'</b><small>'+escapeHtml(m.business_type||"ব্যবসার ধরন নেই")+' · '+escapeHtml(m.contact_email||m.contact_phone||"যোগাযোগ নেই")+'</small><small>অবস্থা: '+escapeHtml(m.status)+'</small></div><div class="admin-actions"><button class="btn btn-outline" data-merchant="'+m.id+'" data-status="active">অনুমোদন</button><button class="btn btn-outline" data-merchant="'+m.id+'" data-status="rejected">প্রত্যাখ্যান</button></div></article>').join("");
    box.querySelectorAll("button[data-merchant]").forEach(button=>button.addEventListener("click",async()=>{
      button.disabled=true;
      try { await adminRequest({action:"review-merchant",merchant_id:button.dataset.merchant,status:button.dataset.status,note:"Reviewed in NEXO PAY admin console"}); await loadAdminMerchants(); await loadAdminDashboardSummaryOnly(); }
      catch(e){ $("adminDashboardMessage").textContent=e.message||"মার্চেন্ট আপডেট হয়নি।"; button.disabled=false; }
    }));
  }
  async function loadAdminDashboardSummaryOnly() {
    const s=await adminRequest({action:"summary"});
    const labels=[["মোট অ্যাকাউন্ট",s.users],["ওয়ালেট",s.wallets],["সক্রিয় ওয়ালেট",s.active_wallets],["মোট লেনদেন",s.transactions_total],["অপেক্ষমাণ লেনদেন",s.transactions_pending],["অপেক্ষমাণ মার্চেন্ট",s.merchants_pending],["খোলা রিফান্ড",s.refunds_open],["খোলা বিরোধ",s.disputes_open]];
    $("adminStats").innerHTML=labels.map(([l,v])=>'<div class="admin-stat"><span>'+escapeHtml(l)+'</span><strong>'+escapeHtml(Number(v||0).toLocaleString("bn-BD"))+'</strong></div>').join("");
  }
  async function loadAdminProviders() {
    const box=$("adminProviders");
    const {data,error}=await supabase.from("payment_providers").select("code,display_name,provider_type,is_enabled,supported_services").order("display_name");
    if(error){box.textContent="প্রোভাইডার তালিকা পড়া যায়নি।";return;}
    box.innerHTML=(data||[]).map(p=>'<article class="admin-row"><div><b>'+escapeHtml(p.display_name)+'</b><small>'+escapeHtml(p.provider_type)+' · '+escapeHtml((p.supported_services||[]).join(", "))+'</small><small>অবস্থা: '+(p.is_enabled?"সক্রিয়":"বন্ধ")+'</small></div><button class="btn btn-outline" data-provider="'+escapeHtml(p.code)+'" data-enabled="'+(!p.is_enabled)+'" '+(!p.is_enabled?'disabled title="Credentials ও অনুমোদন না আসা পর্যন্ত চালু করা যাবে না"':'')+'>'+(p.is_enabled?"বন্ধ করুন":"চালু করুন")+'</button></article>').join("")||"কোনো প্রোভাইডার নেই।";
    box.querySelectorAll("button[data-provider]").forEach(button=>button.addEventListener("click",async()=>{
      const enabled=button.dataset.enabled==="true";
      if(enabled&&!confirm("প্রোভাইডার চালু করবেন? বৈধ অনুমোদন, credentials ও webhook পরীক্ষা ছাড়া এটি করবেন না।"))return;
      button.disabled=true;
      try{await adminRequest({action:"provider-toggle",provider_code:button.dataset.provider,enabled});await loadAdminProviders();}
      catch(e){$("adminDashboardMessage").textContent=e.message||"প্রোভাইডার আপডেট হয়নি।";button.disabled=false;}
    }));
  }
  $("adminWalletForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=$("adminWalletSubmit"),amount=Number($("adminWalletAmount").value);
    if(!Number.isFinite(amount)||amount<=0||amount>1000000){$("adminWalletMessage").textContent="সঠিক পরিমাণ লিখুন (সর্বোচ্চ ১০ লাখ টাকা)।";return;}
    if(!confirm("আপনি কি এই ওয়ালেট সমন্বয়টি জমা দিতে চান? এটি প্রকৃত ব্যালেন্স পরিবর্তন করবে।"))return;
    button.disabled=true;$("adminWalletMessage").textContent="অনুরোধ যাচাই হচ্ছে…";
    try{
      const data=await adminRequest({action:"wallet-adjustment",user_id:$("adminWalletUser").value.trim(),amount_minor:Math.round(amount*100),direction:$("adminWalletDirection").value,idempotency_key:"admin-"+crypto.randomUUID(),reason:$("adminWalletReason").value.trim()});
      $("adminWalletForm").reset();$("adminWalletMessage").textContent="সমন্বয়ের অনুরোধ সম্পন্ন: "+JSON.stringify(data);
      await loadAdminDashboardSummaryOnly();
    }catch(e){$("adminWalletMessage").textContent=e.message||"ওয়ালেট সমন্বয় হয়নি।";}
    finally{button.disabled=false;}
  });

  $("bundleAdminForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) return;
    const button = $("bundleSave");
    const price = Number($("bundlePrice").value);
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
      $("bundleAdminMessage").textContent = "সঠিক প্যাকেজ মূল্য লিখুন।";
      return;
    }
    const optionalInt = id => $(id).value.trim() === "" ? null : Number.parseInt($(id).value, 10);
    button.disabled = true;
    $("bundleAdminMessage").textContent = "প্যাকেজ সংরক্ষণ হচ্ছে…";
    try {
      await adminRequest({
        action: "bundle-save",
        operator_code: $("bundleOperator").value,
        category_code: $("bundleCategory").value,
        name: $("bundleName").value.trim(),
        description: null,
        price_minor: Math.round(price * 100),
        data_mb: optionalInt("bundleData"),
        minutes: optionalInt("bundleMinutes"),
        sms_count: optionalInt("bundleSms"),
        validity_hours: optionalInt("bundleValidity"),
        recharge_type: "prepaid",
        is_active: $("bundleActive").checked
      });
      $("bundleAdminForm").reset();
      $("bundleAdminMessage").textContent = "প্যাকেজ সংরক্ষিত হয়েছে। ক্যাটালগ রিফ্রেশ করা হচ্ছে।";
      await loadCatalogue();
    } catch (error) {
      $("bundleAdminMessage").textContent = error.message || "প্যাকেজ সংরক্ষণ করা যায়নি।";
    } finally {
      button.disabled = false;
    }
  });

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