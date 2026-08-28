(function () {
  "use strict";

  var MIN_CHANNELS = 3;
  var MAX_CHANNELS = 24;
  var BASES = [2, 8, 10, 16];
  var BASE_LABEL = { 2: "BIN", 8: "OCT", 10: "DEC", 16: "HEX" };
  var BASE_NAME  = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" };
  var BASE_PLACEHOLDER = { 2: "e.g. 1010", 8: "e.g. 377", 10: "e.g. 255", 16: "e.g. 1F" };

  var channelState = [
    { base: 10, value: "" },
    { base: 10, value: "" },
    { base: 10, value: "" }
  ];

  var channelsEl = document.getElementById("channels");
  var countInput = document.getElementById("channel-count");
  var countDecBtn = document.getElementById("count-dec");
  var countIncBtn = document.getElementById("count-inc");

  /* ---------- validation + conversion (mirrors the C version) ---------- */

  function isValidDigitForBase(ch, base) {
    var c = ch.toUpperCase();
    var val;
    if (c >= "0" && c <= "9") {
      val = c.charCodeAt(0) - 48;
    } else if (c >= "A" && c <= "F") {
      val = c.charCodeAt(0) - 65 + 10;
    } else {
      return false;
    }
    return val < base;
  }

  function findInvalidChar(str, base) {
    for (var i = 0; i < str.length; i++) {
      if (!isValidDigitForBase(str[i], base)) return str[i];
    }
    return null;
  }

  // A single validated char (0-9, A-F) always maps to 0-15 via
  // hex parsing, regardless of which base it was validated against.
  function stringToBigIntBase(str, base) {
    var b = BigInt(base);
    var result = 0n;
    for (var i = 0; i < str.length; i++) {
      result = result * b + BigInt(parseInt(str[i], 16));
    }
    return result;
  }

  function bigIntToBase(num, base) {
    if (num === 0n) return "0";
    var digits = "0123456789ABCDEF";
    var b = BigInt(base);
    var out = "";
    var n = num;
    while (n > 0n) {
      out = digits[Number(n % b)] + out;
      n = n / b;
    }
    return out;
  }

  /* ---------- rendering ---------- */

  function resizeChannelState(count) {
    if (count > channelState.length) {
      while (channelState.length < count) {
        channelState.push({ base: 10, value: "" });
      }
    } else {
      channelState.length = count;
    }
  }

  function channelTemplate(index) {
    var num = String(index + 1).padStart(2, "0");
    var baseButtons = BASES.map(function (b) {
      return '<button type="button" class="base-btn" data-base="' + b + '">' + BASE_LABEL[b] + "</button>";
    }).join("");
    var tiles = BASES.map(function (b) {
      return (
        '<div class="readout-tile is-empty" data-base="' + b + '">' +
          '<span class="readout-label">' + BASE_LABEL[b] + "</span>" +
          '<span class="readout-value">—</span>' +
        "</div>"
      );
    }).join("");

    return (
      '<article class="channel" data-index="' + index + '">' +
        '<div class="channel-head">' +
          '<span class="channel-tag">IN <b>' + num + "</b></span>" +
          '<div class="base-toggle" role="radiogroup" aria-label="Input base for channel ' + (index + 1) + '">' + baseButtons + "</div>" +
        "</div>" +
        '<div class="input-row">' +
          '<input type="text" class="value-input" autocomplete="off" spellcheck="false" aria-label="Value for channel ' + (index + 1) + '" />' +
          '<span class="input-error" aria-live="polite"></span>' +
        "</div>" +
        '<div class="readout-grid">' + tiles + "</div>" +
      "</article>"
    );
  }

  function renderChannels() {
    channelsEl.innerHTML = channelState.map(function (_, i) { return channelTemplate(i); }).join("");

    channelState.forEach(function (state, i) {
      var el = channelsEl.querySelector('.channel[data-index="' + i + '"]');
      var input = el.querySelector(".value-input");

      // Set the value via the DOM property, never via interpolated
      // HTML, so arbitrary typed characters can never break markup.
      input.value = state.value;
      input.placeholder = BASE_PLACEHOLDER[state.base];

      var activeBtn = el.querySelector('.base-btn[data-base="' + state.base + '"]');
      activeBtn.classList.add("is-active");

      el.querySelectorAll(".base-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.classList.contains("is-active")) return;
          el.querySelectorAll(".base-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          var newBase = parseInt(btn.dataset.base, 10);
          channelState[i].base = newBase;
          input.placeholder = BASE_PLACEHOLDER[newBase];
          updateChannel(el, i);
        });
      });

      input.addEventListener("input", function () {
        channelState[i].value = input.value;
        updateChannel(el, i);
      });

      updateChannel(el, i);
    });
  }

  function updateChannel(el, i) {
    var state = channelState[i];
    var input = el.querySelector(".value-input");
    var errorEl = el.querySelector(".input-error");
    var tiles = el.querySelectorAll(".readout-tile");
    var raw = state.value.trim();

    function clearTiles() {
      tiles.forEach(function (tile) {
        tile.classList.add("is-empty");
        tile.classList.remove("is-source");
        tile.querySelector(".readout-value").textContent = "—";
      });
    }

    if (raw === "") {
      input.classList.remove("is-invalid");
      errorEl.textContent = "";
      clearTiles();
      return;
    }

    var badChar = findInvalidChar(raw, state.base);
    if (badChar !== null) {
      input.classList.add("is-invalid");
      errorEl.textContent = '"' + badChar + '" is not a valid ' + BASE_NAME[state.base] + " digit.";
      clearTiles();
      return;
    }

    input.classList.remove("is-invalid");
    errorEl.textContent = "";

    var value = stringToBigIntBase(raw, state.base);
    var results = {
      2: bigIntToBase(value, 2),
      8: bigIntToBase(value, 8),
      10: value.toString(10),
      16: bigIntToBase(value, 16)
    };

    tiles.forEach(function (tile) {
      var b = parseInt(tile.dataset.base, 10);
      tile.classList.remove("is-empty");
      tile.classList.toggle("is-source", b === state.base);
      tile.querySelector(".readout-value").textContent = results[b];
    });
  }

  /* ---------- channel count controls ---------- */

  function setCount(newCount) {
    newCount = Math.max(MIN_CHANNELS, Math.min(MAX_CHANNELS, newCount));
    countInput.value = newCount;
    countDecBtn.disabled = newCount <= MIN_CHANNELS;
    countIncBtn.disabled = newCount >= MAX_CHANNELS;
    resizeChannelState(newCount);
    renderChannels();
  }

  countDecBtn.addEventListener("click", function () {
    setCount(parseInt(countInput.value, 10) - 1);
  });
  countIncBtn.addEventListener("click", function () {
    setCount(parseInt(countInput.value, 10) + 1);
  });
  countInput.addEventListener("change", function () {
    var n = parseInt(countInput.value, 10);
    if (isNaN(n)) n = MIN_CHANNELS;
    setCount(n);
  });

  setCount(channelState.length);
})();