(function () {
  "use strict";

  var STORAGE = "lotto-predict-v1";
  var LABELS = ["①", "②", "③", "④", "⑤"];
  var engine = window.LottoEngine;
  var root = document.getElementById("app");
  var draws = [];
  var lastCombos = [];
  var prefs = { range: "100", mode: "혼합형" };
  var statusText = "";
  var busy = false;
  var updatedAt = "";

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (Array.isArray(data.draws) && data.draws.length) draws = data.draws;
      lastCombos = Array.isArray(data.lastCombos) ? data.lastCombos : [];
      if (data.prefs) prefs = data.prefs;
      if (data.updatedAt) updatedAt = data.updatedAt;
    } catch (e) {}
  }

  function savePrefs() {
    localStorage.setItem(STORAGE, JSON.stringify({
      draws: draws,
      lastCombos: lastCombos,
      prefs: prefs,
      updatedAt: updatedAt
    }));
  }

  function allDraws() {
    return draws;
  }

  function latest() {
    return draws.length ? draws[draws.length - 1] : null;
  }

  function absorb(incoming) {
    if (!incoming || !incoming.length) return 0;
    var merged = engine.mergeDraws(draws, incoming);
    var added = merged.inserted;
    draws = merged.draws;
    if (added) {
      updatedAt = nowStamp();
      savePrefs();
    }
    return added;
  }

  function nowStamp() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ballsHtml(nums, bonus) {
    var html = '<div class="balls">';
    nums.forEach(function (n) {
      html += '<span class="ball" style="background:' + engine.ballColor(n) + '">' + engine.pad2(n) + "</span>";
    });
    if (bonus != null) {
      html += '<span class="plus">+</span><span class="ball bonus" style="background:' + engine.ballColor(bonus) + '">' + engine.pad2(bonus) + "</span>";
    }
    return html + "</div>";
  }

  function tabBar(active) {
    return '<nav class="tabbar">' +
      '<button type="button" class="' + (active === "home" ? "on" : "") + '" data-go="/">추천</button>' +
      '<button type="button" class="' + (active === "history" ? "on" : "") + '" data-go="/history">기록</button>' +
      '<button type="button" class="' + (active === "info" ? "on" : "") + '" data-go="/info">안내</button>' +
      "</nav>";
  }

  function parseHash() {
    var hash = (location.hash || "#/").replace(/^#/, "") || "/";
    var q = hash.indexOf("?");
    var path = q === -1 ? hash : hash.slice(0, q);
    var params = new URLSearchParams(q === -1 ? "" : hash.slice(q + 1));
    var parts = path.replace(/^\/+/, "").split("/").filter(Boolean);
    return { path: path, parts: parts, params: params };
  }

  function go(path) {
    if ((location.hash || "#/") === "#" + path) render();
    else location.hash = path;
  }

  function bindNav() {
    root.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { go(el.getAttribute("data-go")); });
    });
  }

  function rangeValue() {
    return parseInt(prefs.range, 10) || 0;
  }

  function generate() {
    if (!draws.length) {
      statusText = "당첨번호를 불러오는 중입니다. 잠시 후 다시 눌러 주세요.";
      render();
      return;
    }
    var recentWindow = rangeValue();
    if (recentWindow === 0) recentWindow = draws.length;
    lastCombos = engine.recommend(draws, {
      Mode: engine.modeFromKorean(prefs.mode),
      RecentWindow: recentWindow,
      CombinationCount: 5
    });
    statusText = engine.modeToKorean(engine.modeFromKorean(prefs.mode)) +
      " 기준으로 분석 추천번호 " + lastCombos.length + "개를 생성했습니다.";
    savePrefs();
    render();
  }

  function renderCombos() {
    if (!lastCombos.length) {
      return '<p class="lede">분석범위와 방식을 고른 뒤 추천번호를 생성하세요.</p>';
    }
    return lastCombos.map(function (combo) {
      return '<div class="card combo">' +
        '<div class="combo-row"><strong>' + LABELS[combo.Index - 1] + "</strong>" +
        ballsHtml(combo.Numbers) + "</div>" +
        '<p class="meta">' + escapeHtml(combo.OddEvenText) + " · " +
        escapeHtml(combo.SumText) + " · " + escapeHtml(combo.ZoneText) + "</p></div>";
    }).join("");
  }

  function autoNote() {
    var last = latest();
    if (!last) return busy ? "공식 당첨번호를 자동으로 불러오는 중입니다." : "당첨번호를 준비하는 중입니다.";
    return "1회부터 " + last.n + "회까지 공식 당첨번호를 자동으로 반영합니다. 번호를 직접 넣을 필요는 없습니다.";
  }

  function renderHome() {
    var last = latest();
    root.innerHTML =
      '<div class="topbar"><span class="ghost"></span><h1>LOTTO 6/45</h1><span class="ghost"></span></div>' +
      '<p class="site">분석 추천</p>' +
      '<div class="stats">' +
        '<div class="card"><small>최신 회차</small><strong>' + (last ? last.n + "회" : "-") + "</strong></div>" +
        '<div class="card"><small>자동 반영</small><strong>' + draws.length + "</strong></div>" +
        '<div class="card"><small>방식</small><strong>' + escapeHtml(prefs.mode) + "</strong></div>" +
      "</div>" +
      '<p class="lede">' + escapeHtml(autoNote()) + (last ? "<br>최신 " + last.n + "회 · " + last.d : "") + "</p>" +
      (statusText ? '<p class="ok">' + escapeHtml(statusText) + "</p>" : "") +
      '<div class="grid2">' +
        '<label class="field"><span>분석범위</span><select id="range">' +
          '<option value="50"' + (prefs.range === "50" ? " selected" : "") + ">최근 50회</option>" +
          '<option value="100"' + (prefs.range === "100" ? " selected" : "") + ">최근 100회</option>" +
          '<option value="0"' + (prefs.range === "0" ? " selected" : "") + ">전체 회차</option>" +
        "</select></label>" +
        '<label class="field"><span>추천방식</span><select id="mode">' +
          ["균형형", "통계형", "분산형", "혼합형"].map(function (m) {
            return '<option' + (prefs.mode === m ? " selected" : "") + ">" + m + "</option>";
          }).join("") +
        "</select></label>" +
      "</div>" +
      '<button class="btn btn-primary" id="gen-btn"' + (busy && !draws.length ? " disabled" : "") + ">추천번호 생성</button>" +
      '<div class="stack" style="margin-top:16px">' + renderCombos() + "</div>" +
      (lastCombos.length ? '<button class="btn btn-secondary" id="regen-btn">다시 생성</button>' : "") +
      '<p class="disclaimer">과거 당첨번호의 통계적 특성을 분석해 조합을 만듭니다. 실제 당첨을 보장하지 않습니다.</p>' +
      tabBar("home");
    bindNav();
    document.getElementById("range").addEventListener("change", function () {
      prefs.range = this.value;
      savePrefs();
    });
    document.getElementById("mode").addEventListener("change", function () {
      prefs.mode = this.value;
      savePrefs();
    });
    document.getElementById("gen-btn").addEventListener("click", generate);
    var regen = document.getElementById("regen-btn");
    if (regen) regen.addEventListener("click", generate);
  }

  function renderHistory() {
    var rows = draws.slice().reverse();
    var q = (parseHash().params.get("q") || "").trim();
    if (q) {
      rows = rows.filter(function (d) {
        return String(d.n).indexOf(q) !== -1 || d.d.indexOf(q) !== -1 || d.nums.join(" ").indexOf(q) !== -1;
      });
    }
    var list = rows.slice(0, 80).map(function (d) {
      return '<div class="card history-row"><div><strong>' + d.n + "회</strong><span class=\"muted\"> " + d.d + "</span></div>" +
        ballsHtml(d.nums, d.b) + "</div>";
    }).join("");
    root.innerHTML =
      '<div class="topbar"><span class="ghost"></span><h1>과거 데이터</h1><span class="ghost"></span></div>' +
      '<p class="lede">공식 당첨번호 ' + draws.length + "회를 자동으로 불러왔습니다. 직접 입력하지 않습니다.</p>" +
      '<input id="search" type="search" placeholder="회차·날짜·번호 검색" value="' + escapeHtml(q) + '">' +
      '<div class="stack" style="margin-top:12px">' + (list || '<div class="empty card">표시할 회차가 없습니다.</div>') + "</div>" +
      (rows.length > 80 ? '<p class="muted">최근 80건만 화면에 보여 줍니다. 검색으로 더 찾을 수 있습니다.</p>' : "") +
      tabBar("history");
    bindNav();
    document.getElementById("search").addEventListener("change", function () {
      go(this.value ? "/history?q=" + encodeURIComponent(this.value) : "/history");
    });
  }

  function renderInfo() {
    root.innerHTML =
      '<div class="topbar"><span class="ghost"></span><h1>안내</h1><span class="ghost"></span></div>' +
      '<p class="lede">Windows용 LOTTO 6/45 분석기와 같은 기준·로직입니다.</p>' +
      '<div class="card stack-text">' +
        "<p><strong>당첨번호</strong></p>" +
        "<p>1회부터 최신 회차까지 동행복권 공식 번호를 앱이 자동으로 가져옵니다. 매번 입력할 필요가 없습니다. 앱을 열면 새 회차도 이어서 반영합니다.</p>" +
        "<p><strong>아이폰에 앱처럼 두기</strong></p>" +
        "<p>Safari로 이 페이지를 연 뒤 공유 버튼 → <strong>홈 화면에 추가</strong>를 누르면 됩니다.</p>" +
        "<p><strong>추천 방식</strong></p>" +
        "<p>균형형, 통계형, 분산형, 혼합형. 번호 빈도·최근 출현·홀짝·합계·구간·연속수·끝수 중복을 같은 가중치로 점수를 매깁니다.</p>" +
        "<p><strong>주의</strong></p>" +
        "<p>통계 분석일 뿐이며 당첨을 보장하지 않습니다.</p>" +
      "</div>" +
      tabBar("info");
    bindNav();
  }

  function render() {
    var parsed = parseHash();
    var page = parsed.parts[0] || "";
    if (page === "history") renderHistory();
    else if (page === "info") renderInfo();
    else renderHome();
  }

  function fetchText(url, timeoutMs) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 10000);
    return fetch(url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function fetchViaCors(url) {
    var proxies = [
      url,
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
      "https://corsproxy.io/?" + encodeURIComponent(url)
    ];
    var i = 0;
    function next() {
      if (i >= proxies.length) return Promise.reject(new Error("official fetch failed"));
      var target = proxies[i++];
      return fetchText(target, 12000).then(function (text) {
        var parsed = engine.parseOfficialDraws(text);
        if (!parsed.length) throw new Error("empty");
        return parsed;
      }).catch(function () { return next(); });
    }
    return next();
  }

  function fillGaps(latestNo) {
    var have = {};
    draws.forEach(function (d) { have[d.n] = true; });
    var missing = [];
    var n;
    for (n = 1; n <= latestNo; n++) if (!have[n]) missing.push(n);
    if (!missing.length) return Promise.resolve(0);
    if (missing.length > 20) {
      return fetchViaCors(engine.OFFICIAL_INFO + "?srchLtEpsd=all").then(function (list) {
        return absorb(list);
      });
    }
    var chain = Promise.resolve(0);
    missing.forEach(function (drawNo) {
      chain = chain.then(function (sum) {
        return fetchViaCors(engine.OFFICIAL_INFO + "?srchLtEpsd=" + drawNo)
          .then(function (list) { return sum + absorb(list); })
          .catch(function () {
            return fetchViaCors(engine.OFFICIAL_COMMON + "&drwNo=" + drawNo)
              .then(function (list) { return sum + absorb(list); })
              .catch(function () { return sum; });
          });
      });
    });
    return chain;
  }

  function syncOfficial() {
    return fetchViaCors(engine.OFFICIAL_INFO).then(function (list) {
      var added = absorb(list);
      var max = 0;
      list.forEach(function (d) { if (d.n > max) max = d.n; });
      draws.forEach(function (d) { if (d.n > max) max = d.n; });
      return fillGaps(max).then(function (more) { return added + more; });
    });
  }

  function syncBundled() {
    return fetch("data/draws.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (payload) {
        if (payload && payload.updatedAt) updatedAt = payload.updatedAt;
        return absorb(payload && payload.draws ? payload.draws : engine.parseOfficialDraws(payload));
      });
  }

  function autoSync() {
    if (busy) return;
    busy = true;
    var before = latest() ? latest().n : 0;
    if (!draws.length) statusText = "공식 당첨번호를 자동으로 불러오는 중입니다.";
    render();
    syncBundled()
      .catch(function () { return 0; })
      .then(function () { return syncOfficial().catch(function () { return 0; }); })
      .then(function () {
        var now = latest() ? latest().n : 0;
        if (!now) statusText = "당첨번호를 아직 불러오지 못했습니다. 인터넷 연결을 확인하면 자동으로 다시 시도합니다.";
        else if (now > before) statusText = "최신 " + now + "회까지 공식 당첨번호를 자동 반영했습니다.";
        else statusText = "1회부터 " + now + "회까지 공식 당첨번호를 자동 반영 중입니다.";
        savePrefs();
      })
      .finally(function () {
        busy = false;
        render();
      });
  }

  loadPrefs();
  window.addEventListener("hashchange", render);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") autoSync();
  });
  render();
  autoSync();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
