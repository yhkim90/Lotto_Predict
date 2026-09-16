(function (global) {
  "use strict";

  var FIRST_DATE = "2002-12-07";

  var MODE = {
    Balanced: "Balanced",
    Statistical: "Statistical",
    Spread: "Spread",
    Mixed: "Mixed"
  };

  var MODE_KO = {
    Balanced: "균형형",
    Statistical: "통계형",
    Spread: "분산형",
    Mixed: "혼합형"
  };

  function modeFromKorean(text) {
    if (text === "균형형") return MODE.Balanced;
    if (text === "통계형") return MODE.Statistical;
    if (text === "분산형") return MODE.Spread;
    return MODE.Mixed;
  }

  function modeToKorean(mode) {
    return MODE_KO[mode] || MODE_KO.Mixed;
  }

  function modeWeights(mode) {
    if (mode === MODE.Balanced) {
      return {
        FreqAll: 0.28, FreqRecent: 0.22, Absence: 0.15,
        Number: 0.12, OddEven: 0.22, Sum: 0.18, Zone: 0.18,
        Consecutive: 0.12, Ending: 0.10, Spread: 0.08, MinAcceptScore: 0.42
      };
    }
    if (mode === MODE.Statistical) {
      return {
        FreqAll: 0.42, FreqRecent: 0.38, Absence: 0.10,
        Number: 0.48, OddEven: 0.12, Sum: 0.12, Zone: 0.10,
        Consecutive: 0.08, Ending: 0.06, Spread: 0.04, MinAcceptScore: 0.38
      };
    }
    if (mode === MODE.Spread) {
      return {
        FreqAll: 0.18, FreqRecent: 0.16, Absence: 0.10,
        Number: 0.12, OddEven: 0.10, Sum: 0.10, Zone: 0.26,
        Consecutive: 0.08, Ending: 0.10, Spread: 0.24, MinAcceptScore: 0.36
      };
    }
    return {
      FreqAll: 0.30, FreqRecent: 0.28, Absence: 0.14,
      Number: 0.24, OddEven: 0.15, Sum: 0.14, Zone: 0.14,
      Consecutive: 0.10, Ending: 0.09, Spread: 0.14, MinAcceptScore: 0.40
    };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function ballColor(n) {
    if (n <= 10) return "#F2C200";
    if (n <= 20) return "#4573D5";
    if (n <= 30) return "#E05454";
    if (n <= 40) return "#7A7A7A";
    return "#2FA36B";
  }

  function zoneIndex(number) {
    if (number <= 10) return 0;
    if (number <= 20) return 1;
    if (number <= 30) return 2;
    if (number <= 40) return 3;
    return 4;
  }

  function oddEvenKey(oddCount) {
    return oddCount + ":" + (6 - oddCount);
  }

  function zoneNote(zoneCount) {
    return "구간 " + zoneCount + "/5";
  }

  function comboKey(numbers) {
    return numbers.slice().sort(function (a, b) { return a - b; }).join("-");
  }

  function describe(numbers) {
    var sorted = numbers.slice().sort(function (a, b) { return a - b; });
    var odd = 0;
    var zones = [0, 0, 0, 0, 0];
    var endings = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var i;
    for (i = 0; i < sorted.length; i++) {
      if (sorted[i] % 2 === 1) odd += 1;
      zones[zoneIndex(sorted[i])] += 1;
      endings[sorted[i] % 10] += 1;
    }
    var consecutive = 0;
    var gaps = [];
    for (i = 1; i < sorted.length; i++) {
      var gap = sorted[i] - sorted[i - 1];
      gaps.push(gap);
      if (gap === 1) consecutive += 1;
    }
    var zoneCount = 0;
    var maxEnding = 0;
    for (i = 0; i < 5; i++) if (zones[i] > 0) zoneCount += 1;
    for (i = 0; i < 10; i++) if (endings[i] > maxEnding) maxEnding = endings[i];
    var sum = 0;
    for (i = 0; i < sorted.length; i++) sum += sorted[i];
    var avgGap = 0;
    if (gaps.length) {
      for (i = 0; i < gaps.length; i++) avgGap += gaps[i];
      avgGap /= gaps.length;
    }
    return {
      OddCount: odd,
      EvenCount: 6 - odd,
      Sum: sum,
      ZoneCount: zoneCount,
      ConsecutivePairs: consecutive,
      MaxEndingDuplicate: maxEnding,
      AverageGap: avgGap,
      ZoneOccupancy: zones
    };
  }

  function overlapCount(a, b) {
    var set = {};
    var i;
    var n = 0;
    for (i = 0; i < a.length; i++) set[a[i]] = true;
    for (i = 0; i < b.length; i++) if (set[b[i]]) n += 1;
    return n;
  }

  function gaussian(value, mean, std) {
    var z = (value - mean) / std;
    return Math.exp(-0.5 * z * z);
  }

  function historicalShare(map, key, total) {
    if (total <= 0) return 0.5;
    return (map[key] || 0) / total;
  }

  function analyze(allDraws, query) {
    query = query || {};
    var asOf = query.AsOfDrawNo;
    var recentWindow = Math.max(1, query.RecentWindow || 100);
    var draws = allDraws.filter(function (d) {
      return asOf == null || d.n <= asOf;
    }).slice().sort(function (a, b) { return a.n - b.n; });

    var recentCount = Math.min(recentWindow, draws.length);
    var recent = draws.slice(draws.length - recentCount);
    var latestNo = draws.length ? draws[draws.length - 1].n : 0;

    var stats = [];
    var n;
    for (n = 1; n <= 45; n++) {
      var countAll = 0;
      var countRecent = 0;
      var lastSeen = 0;
      var i;
      for (i = 0; i < draws.length; i++) {
        if (draws[i].nums.indexOf(n) !== -1) {
          countAll += 1;
          lastSeen = draws[i].n;
        }
      }
      for (i = 0; i < recent.length; i++) {
        if (recent[i].nums.indexOf(n) !== -1) countRecent += 1;
      }
      stats.push({
        Number: n,
        CountAll: countAll,
        CountRecent: countRecent,
        LastSeenGap: lastSeen === 0 ? draws.length : latestNo - lastSeen
      });
    }

    var oddEven = {};
    var zoneCounts = {};
    var consecutive = {};
    var sums = [];
    var keys = {};
    var i;
    for (i = 0; i < draws.length; i++) {
      var profile = describe(draws[i].nums);
      sums.push(profile.Sum);
      keys[comboKey(draws[i].nums)] = true;
      var oe = oddEvenKey(profile.OddCount);
      oddEven[oe] = (oddEven[oe] || 0) + 1;
      zoneCounts[profile.ZoneCount] = (zoneCounts[profile.ZoneCount] || 0) + 1;
      consecutive[profile.ConsecutivePairs] = (consecutive[profile.ConsecutivePairs] || 0) + 1;
    }

    var sumMean = 0;
    for (i = 0; i < sums.length; i++) sumMean += sums[i];
    sumMean = sums.length ? sumMean / sums.length : 0;
    var sumStd = 20;
    if (sums.length >= 2) {
      var acc = 0;
      for (i = 0; i < sums.length; i++) acc += (sums[i] - sumMean) * (sums[i] - sumMean);
      sumStd = Math.sqrt(acc / (sums.length - 1));
      if (sumStd <= 0) sumStd = 20;
    }

    var maxCountAll = 0;
    var maxCountRecent = 0;
    for (i = 0; i < stats.length; i++) {
      if (stats[i].CountAll > maxCountAll) maxCountAll = stats[i].CountAll;
      if (stats[i].CountRecent > maxCountRecent) maxCountRecent = stats[i].CountRecent;
    }

    return {
      Draws: draws,
      RecentDraws: recent,
      NumberStats: stats,
      MaxCountAll: maxCountAll,
      MaxCountRecent: Math.max(1, maxCountRecent),
      SumMean: sumMean,
      SumStd: sumStd,
      OddEvenCounts: oddEven,
      ZoneCountCounts: zoneCounts,
      ConsecutiveCounts: consecutive,
      HistoricalMainKeys: keys
    };
  }

  function scoreNumbers(snapshot, weights) {
    var scores = new Array(46);
    var i;
    for (i = 0; i < snapshot.NumberStats.length; i++) {
      var stat = snapshot.NumberStats[i];
      var freqAll = snapshot.MaxCountAll === 0 ? 0 : stat.CountAll / snapshot.MaxCountAll;
      var freqRecent = stat.CountRecent / snapshot.MaxCountRecent;
      var absence = 1.0 - Math.min(stat.LastSeenGap, 30) / 30.0;
      scores[stat.Number] =
        weights.FreqAll * freqAll +
        weights.FreqRecent * freqRecent +
        weights.Absence * absence;
    }
    return scores;
  }

  function weightedPick(items, weights, random) {
    var total = 0;
    var i;
    for (i = 0; i < weights.length; i++) total += weights[i];
    var cursor = random() * total;
    var acc = 0;
    for (i = 0; i < items.length; i++) {
      acc += weights[i];
      if (cursor <= acc) return items[i];
    }
    return items[items.length - 1];
  }

  function sampleCombination(numberScores, random, mode) {
    var pool = [];
    var n;
    for (n = 1; n <= 45; n++) pool.push(n);
    var picked = [];

    while (picked.length < 6 && pool.length > 0) {
      var weights = pool.map(function (num) {
        var baseWeight = 0.12 + numberScores[num];
        if (mode === MODE.Spread && picked.length > 0) {
          var nearest = 99;
          var i;
          for (i = 0; i < picked.length; i++) {
            var dist = Math.abs(picked[i] - num);
            if (dist < nearest) nearest = dist;
          }
          if (nearest <= 2) baseWeight *= 0.35;
          else if (nearest >= 7) baseWeight *= 1.25;
        }
        return Math.max(0.01, baseWeight);
      });
      var chosen = weightedPick(pool, weights, random);
      picked.push(chosen);
      pool = pool.filter(function (x) { return x !== chosen; });
    }

    if (picked.length !== 6) return null;
    picked.sort(function (a, b) { return a - b; });
    return picked;
  }

  function scoreCombination(numbers, profile, snapshot, numberScores, weights) {
    var numberScore = 0;
    var i;
    for (i = 0; i < numbers.length; i++) numberScore += numberScores[numbers[i]];
    numberScore /= numbers.length;

    var oddEvenScore = historicalShare(snapshot.OddEvenCounts, oddEvenKey(profile.OddCount), snapshot.Draws.length);
    var zoneScore = historicalShare(snapshot.ZoneCountCounts, profile.ZoneCount, snapshot.Draws.length);
    var consecutiveScore = historicalShare(snapshot.ConsecutiveCounts, profile.ConsecutivePairs, snapshot.Draws.length);
    var sumScore = gaussian(profile.Sum, snapshot.SumMean, snapshot.SumStd);
    var endingScore = profile.MaxEndingDuplicate <= 1 ? 1.0 : profile.MaxEndingDuplicate === 2 ? 0.72 : 0.25;
    var spreadScore = clamp(profile.AverageGap / 10.0, 0, 1.0);

    var similarPenalty = 0;
    var recent = snapshot.RecentDraws;
    var start = Math.max(0, recent.length - 8);
    for (i = start; i < recent.length; i++) {
      var overlap = overlapCount(recent[i].nums, numbers);
      if (overlap >= 5) similarPenalty += 0.55;
      else if (overlap === 4) similarPenalty += 0.25;
    }
    for (i = 0; i < snapshot.Draws.length; i++) {
      if (overlapCount(snapshot.Draws[i].nums, numbers) >= 5) {
        similarPenalty += 0.35;
        break;
      }
    }

    return weights.Number * numberScore +
      weights.OddEven * oddEvenScore +
      weights.Sum * sumScore +
      weights.Zone * zoneScore +
      weights.Consecutive * consecutiveScore +
      weights.Ending * endingScore +
      weights.Spread * spreadScore -
      similarPenalty;
  }

  function recommend(allDraws, request) {
    request = request || {};
    var mode = request.Mode || MODE.Mixed;
    var snapshot = analyze(allDraws, {
      AsOfDrawNo: request.AsOfDrawNo,
      RecentWindow: request.RecentWindow || 100
    });
    if (!snapshot.Draws.length) return [];

    var weights = modeWeights(mode);
    var numberScores = scoreNumbers(snapshot, weights);
    var random = request.random || Math.random;
    var selected = [];
    var attempts = 0;
    var maxAttempts = 4000;
    var combinationCount = request.CombinationCount || 5;
    var maxOverlap = request.MaxOverlap == null ? 3 : request.MaxOverlap;

    while (selected.length < combinationCount && attempts < maxAttempts) {
      attempts += 1;
      var combo = sampleCombination(numberScores, random, mode);
      if (!combo) continue;
      var key = comboKey(combo);
      if (snapshot.HistoricalMainKeys[key]) continue;
      var dup = false;
      var i;
      for (i = 0; i < selected.length; i++) {
        if (comboKey(selected[i].Numbers) === key) { dup = true; break; }
        if (overlapCount(selected[i].Numbers, combo) > maxOverlap) { dup = true; break; }
      }
      if (dup) continue;
      var profile = describe(combo);
      var score = scoreCombination(combo, profile, snapshot, numberScores, weights);
      if (score < weights.MinAcceptScore && attempts < maxAttempts - 200) continue;
      selected.push({ Numbers: combo, Profile: profile, Score: score });
    }

    for (i = selected.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = selected[i];
      selected[i] = selected[j];
      selected[j] = tmp;
    }
    return selected.map(function (c, i) {
      return {
        Index: i + 1,
        Numbers: c.Numbers,
        Profile: c.Profile,
        Score: c.Score,
        OddEvenText: "홀짝 " + c.Profile.OddCount + ":" + c.Profile.EvenCount,
        SumText: "합계 " + c.Profile.Sum,
        ZoneText: zoneNote(c.Profile.ZoneCount)
      };
    });
  }

  function parseOfficialDate(raw) {
    raw = String(raw || "").trim();
    if (/^\d{8}$/.test(raw)) {
      return raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6, 8);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return null;
  }

  function validateDraw(draw, existingNos) {
    var errors = [];
    if (!draw.n || draw.n <= 0) errors.push("회차 번호가 올바르지 않습니다: " + draw.n);
    if (existingNos && existingNos[draw.n]) errors.push("회차 " + draw.n + "가 이미 저장되어 있습니다.");
    var nums = draw.nums || [];
    if (nums.length !== 6) {
      errors.push("회차 " + draw.n + ": 본번호 개수가 6개가 아닙니다.");
      return errors;
    }
    var uniq = {};
    var i;
    for (i = 0; i < 6; i++) {
      if (uniq[nums[i]]) errors.push("회차 " + draw.n + ": 본번호가 서로 중복됩니다.");
      uniq[nums[i]] = true;
      if (nums[i] < 1 || nums[i] > 45) errors.push("회차 " + draw.n + ": 번호 " + nums[i] + "이 1~45 범위를 벗어납니다.");
    }
    if (draw.b < 1 || draw.b > 45) errors.push("회차 " + draw.n + ": 보너스 번호 " + draw.b + "가 1~45 범위를 벗어납니다.");
    else if (uniq[draw.b]) errors.push("회차 " + draw.n + ": 보너스 번호가 본번호와 중복됩니다.");
    if (draw.d < FIRST_DATE) errors.push("회차 " + draw.n + ": 추첨일이 너무 이릅니다.");
    return errors;
  }

  function parseCsv(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return { ok: false, message: "파일이 비어 있습니다.", errors: ["파일이 비어 있습니다."], draws: [] };
    var start = 0;
    var first = lines[0].split(/[,\t;]/)[0].trim();
    if (first.indexOf("회차") !== -1 || /^draw(_no)?$/i.test(first)) start = 1;
    if (start >= lines.length) return { ok: false, message: "회차 데이터가 없습니다.", errors: ["회차 데이터가 없습니다."], draws: [] };

    var draws = [];
    var errors = [];
    var i;
    for (i = start; i < lines.length; i++) {
      var lineNo = i + 1;
      var parts = lines[i].split(/[,\t;]/).map(function (p) { return p.trim(); });
      if (parts.length < 9) {
        errors.push(lineNo + "행: 열이 부족합니다. 회차,추첨일,번호1~6,보너스가 필요합니다.");
        continue;
      }
      var drawNo = parseInt(parts[0], 10);
      if (!drawNo) {
        errors.push(lineNo + "행: 회차 번호가 숫자가 아닙니다.");
        continue;
      }
      var date = parseOfficialDate(parts[1]);
      if (!date) {
        errors.push(lineNo + "행: 추첨일 형식이 올바르지 않습니다. YYYY-MM-DD 또는 YYYYMMDD를 사용하세요.");
        continue;
      }
      var nums = [];
      var numberOk = true;
      var k;
      for (k = 0; k < 6; k++) {
        var v = parseInt(parts[2 + k], 10);
        if (!v) {
          errors.push(lineNo + "행: 번호" + (k + 1) + "이 숫자가 아닙니다.");
          numberOk = false;
        } else nums.push(v);
      }
      var bonus = parseInt(parts[8], 10);
      if (!bonus) {
        errors.push(lineNo + "행: 보너스 번호가 숫자가 아닙니다.");
        numberOk = false;
      }
      if (!numberOk) continue;
      nums.sort(function (a, b) { return a - b; });
      draws.push({ n: drawNo, d: date, nums: nums, b: bonus });
    }

    if (errors.length) return { ok: false, message: "CSV 파일에 오류가 있어 저장하지 않았습니다.", errors: errors, draws: [] };
    return { ok: true, message: "", errors: [], draws: draws };
  }

  function mergeDraws(base, extra) {
    var map = {};
    var i;
    for (i = 0; i < (base || []).length; i++) map[base[i].n] = base[i];
    var inserted = 0;
    for (i = 0; i < (extra || []).length; i++) {
      if (!extra[i] || !extra[i].n) continue;
      if (!map[extra[i].n]) inserted += 1;
      map[extra[i].n] = extra[i];
    }
    var out = Object.keys(map).map(function (k) { return map[k]; });
    out.sort(function (a, b) { return a.n - b.n; });
    return { draws: out, inserted: inserted };
  }

  function fromInfoItem(item) {
    var nums = [
      item.tm1WnNo, item.tm2WnNo, item.tm3WnNo,
      item.tm4WnNo, item.tm5WnNo, item.tm6WnNo
    ].map(function (n) { return parseInt(n, 10); }).sort(function (a, b) { return a - b; });
    return {
      n: parseInt(item.ltEpsd, 10),
      d: parseOfficialDate(item.ltRflYmd),
      nums: nums,
      b: parseInt(item.bnsWnNo, 10)
    };
  }

  function fromCommonItem(item) {
    if (!item || (item.returnValue && item.returnValue !== "success")) return null;
    if (item.drwNo == null) return null;
    var nums = [
      item.drwtNo1, item.drwtNo2, item.drwtNo3,
      item.drwtNo4, item.drwtNo5, item.drwtNo6
    ].map(function (n) { return parseInt(n, 10); }).sort(function (a, b) { return a - b; });
    return {
      n: parseInt(item.drwNo, 10),
      d: parseOfficialDate(item.drwNoDate) || String(item.drwNoDate || ""),
      nums: nums,
      b: parseInt(item.bnusNo, 10)
    };
  }

  function parseJsonPayload(raw) {
    if (raw && typeof raw === "object") return raw;
    var text = String(raw || "").replace(/^\uFEFF/, "").trim();
    if (!text || text.charAt(0) !== "{") return null;
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function parseOfficialDraws(raw) {
    var payload = parseJsonPayload(raw);
    if (!payload) return [];
    if (payload.data && Array.isArray(payload.data.list)) {
      return payload.data.list.map(fromInfoItem).filter(function (d) {
        return d && d.n && d.d && d.nums && d.nums.length === 6;
      });
    }
    if (payload.draws && Array.isArray(payload.draws)) return payload.draws;
    var one = fromCommonItem(payload);
    return one ? [one] : [];
  }

  var OFFICIAL_INFO = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";
  var OFFICIAL_COMMON = "https://www.dhlottery.co.kr/common.do?method=getLottoNumber";

  global.LottoEngine = {
    MODE: MODE,
    modeFromKorean: modeFromKorean,
    modeToKorean: modeToKorean,
    analyze: analyze,
    recommend: recommend,
    describe: describe,
    ballColor: ballColor,
    pad2: pad2,
    validateDraw: validateDraw,
    parseCsv: parseCsv,
    mergeDraws: mergeDraws,
    parseOfficialDraws: parseOfficialDraws,
    OFFICIAL_INFO: OFFICIAL_INFO,
    OFFICIAL_COMMON: OFFICIAL_COMMON,
    comboKey: comboKey
  };
})(window);
