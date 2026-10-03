/**
 * common.js - Shared utilities, constants, base converters, and tab navigation
 * Number System Converter & Digital Logic Engine
 */

(function () {
  "use strict";

  var MIN_CHANNELS = 3;
  var MAX_CHANNELS = 24;
  var BASES = [2, 8, 10, 16];

  // Human-readable info about each base
  var BASE_LABEL = { 2: "2", 8: "8", 10: "10", 16: "16" };
  var BASE_NAME = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" };
  var BASE_PLACEHOLDER = { 2: "e.g. 1010", 8: "e.g. 377", 10: "e.g. 255", 16: "e.g. 1F" };

  // Display symbols for operators
  var OP_DISPLAY = {
    "+": "+",
    "-": "\u2212",
    "*": "\u00D7",
    "/": "\u00F7"
  };

  // Variable mappings: 0 -> 'a', 1 -> 'b', ..., 23 -> 'x'
  function indexToVar(i) {
    return String.fromCharCode(97 + i);
  }

  function varToIndex(str) {
    var s = str.trim().toLowerCase();
    // Support single letter 'a'..'x'
    if (/^[a-z]$/.test(s)) {
      return s.charCodeAt(0) - 97;
    }
    // Support 'in1'..'in24' or 'in01'..'in24'
    var m = s.match(/^in0*(\d+)$/);
    if (m) {
      return parseInt(m[1], 10) - 1;
    }
    return -1;
  }

  function padIndex(i) {
    return String(i + 1).padStart(2, "0");
  }

  function numWithBase(numStr, baseNum) {
    var wrap = document.createElement("span");
    wrap.className = "num-with-base num-base-" + baseNum;
    wrap.appendChild(document.createTextNode(numStr));
    var sub = document.createElement("sub");
    sub.className = "base-sub";
    sub.textContent = String(baseNum);
    wrap.appendChild(sub);
    return wrap;
  }

  function setReadoutValue(tile, numStr, baseNum) {
    var valueEl = tile.querySelector(".readout-value");
    if (!valueEl) return;
    valueEl.textContent = "";
    valueEl.appendChild(numWithBase(numStr, baseNum));
  }

  /* VALIDATION + NUMBER CONVERSION HELPERS */

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
    var neg = num < 0n;
    var n = neg ? -num : num;
    var digits = "0123456789ABCDEF";
    var b = BigInt(base);
    var out = "";
    while (n > 0n) {
      out = digits[Number(n % b)] + out;
      n = n / b;
    }
    return (neg ? "-" : "") + out;
  }

  /* 1'S & 2'S COMPLEMENT SHARED CALCULATION HELPER */

  function calculateOnesAndTwosComplements(value, bitWidthChoice, rawInputStr, inputBase) {
    var rawBin = value === 0n ? "0" : value.toString(2);
    var width;
    if (!bitWidthChoice || bitWidthChoice === "auto") {
      // In Auto mode: exact length of the binary representation or typed binary string
      if (inputBase === 2 && rawInputStr) {
        width = Math.max(rawInputStr.replace(/\s+/g, "").length, 1);
      } else {
        width = Math.max(rawBin.length, 1);
      }
    } else {
      width = parseInt(bitWidthChoice, 10);
    }

    var mod = 1n << BigInt(width);
    var maxVal = mod - 1n;
    var isOverflow = value > maxVal;

    // Pad or trim to width
    var paddedBin = (inputBase === 2 && rawInputStr && (!bitWidthChoice || bitWidthChoice === "auto"))
      ? rawInputStr.replace(/\s+/g, "")
      : rawBin.padStart(width, "0");
    if (paddedBin.length > width) {
      paddedBin = paddedBin.slice(-width);
    } else if (paddedBin.length < width) {
      paddedBin = paddedBin.padStart(width, "0");
    }

    // 1's Complement: invert each bit
    var onesBin = "";
    for (var i = 0; i < paddedBin.length; i++) {
      onesBin += (paddedBin[i] === "0" ? "1" : "0");
    }
    var onesBigInt = stringToBigIntBase(onesBin, 2);

    // 2's Complement: (onesBigInt + 1n) % mod
    var twosBigInt = (onesBigInt + 1n) % mod;
    var twosBin = twosBigInt.toString(2).padStart(width, "0");

    return {
      width: width,
      isOverflow: isOverflow,
      originalBin: paddedBin,
      ones: {
        binary: onesBin,
        hex: bigIntToBase(onesBigInt, 16),
        octal: bigIntToBase(onesBigInt, 8),
        dec: onesBigInt.toString(10)
      },
      twos: {
        binary: twosBin,
        hex: bigIntToBase(twosBigInt, 16),
        octal: bigIntToBase(twosBigInt, 8),
        unsignedDec: twosBigInt.toString(10),
        signedDec: value === 0n ? "0" : "-" + value.toString(10)
      }
    };
  }

  /* TAB NAVIGATION CONTROLLER */

  var TAB_HEADER_META = {
    "panel-converter": {
      title: "Number System Converter & Arithmetic Operations",
      desc: "Convert between binary, octal, decimal, and hexadecimal live per channel, compute 1's and 2's complements, and evaluate exact multi-base arithmetic formulas."
    },
    "panel-complement": {
      title: "1's & 2's Complement Subtraction",
      desc: "Perform step-by-step digital logic subtraction using 1's and 2's complements with end-around carry addition and carry-discard evaluation."
    },
    "panel-bcd": {
      title: "BCD Arithmetic",
      desc: "Perform Binary-Coded Decimal (BCD) addition with automatic +0110₂ (+6) correction, and step-by-step BCD subtraction using 9's and 10's complement methods."
    }
  };

  function setupTabs() {
    var tabBtns = Array.prototype.slice.call(document.querySelectorAll(".tab-btn"));
    var tabPanels = Array.prototype.slice.call(document.querySelectorAll(".tab-panel"));
    var mainTitleEl = document.getElementById("page-main-title") || document.querySelector(".masthead .title");
    var mainDescEl = document.getElementById("page-main-desc") || document.querySelector(".masthead .subtitle");

    if (!tabBtns.length || !tabPanels.length) return;

    function switchTab(targetPanelId) {
      tabBtns.forEach(function (btn) {
        var isTarget = btn.getAttribute("aria-controls") === targetPanelId;
        btn.classList.toggle("is-active", isTarget);
        btn.setAttribute("aria-selected", isTarget ? "true" : "false");
        btn.setAttribute("tabindex", isTarget ? "0" : "-1");
      });

      tabPanels.forEach(function (panel) {
        var isTarget = panel.id === targetPanelId;
        panel.classList.toggle("is-active", isTarget);
        if (isTarget) {
          panel.removeAttribute("hidden");
        } else {
          panel.setAttribute("hidden", "hidden");
        }
      });

      if (TAB_HEADER_META[targetPanelId]) {
        if (mainTitleEl) mainTitleEl.textContent = TAB_HEADER_META[targetPanelId].title;
        if (mainDescEl) mainDescEl.textContent = TAB_HEADER_META[targetPanelId].desc;
      }
    }

    tabBtns.forEach(function (btn, index) {
      btn.addEventListener("click", function () {
        var targetPanelId = btn.getAttribute("aria-controls");
        switchTab(targetPanelId);
      });

      btn.addEventListener("keydown", function (e) {
        var newIndex = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          newIndex = (index + 1) % tabBtns.length;
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          newIndex = (index - 1 + tabBtns.length) % tabBtns.length;
        } else if (e.key === "Home") {
          newIndex = 0;
        } else if (e.key === "End") {
          newIndex = tabBtns.length - 1;
        }

        if (newIndex !== -1) {
          e.preventDefault();
          tabBtns[newIndex].focus();
          var targetPanelId = tabBtns[newIndex].getAttribute("aria-controls");
          switchTab(targetPanelId);
        }
      });
    });
  }

  // Cross-tab channel accessor placeholder
  var getChannelsFn = function () {
    return [];
  };

  // Expose global NumberApp namespace
  window.NumberApp = {
    MIN_CHANNELS: MIN_CHANNELS,
    MAX_CHANNELS: MAX_CHANNELS,
    BASES: BASES,
    BASE_LABEL: BASE_LABEL,
    BASE_NAME: BASE_NAME,
    BASE_PLACEHOLDER: BASE_PLACEHOLDER,
    OP_DISPLAY: OP_DISPLAY,
    indexToVar: indexToVar,
    varToIndex: varToIndex,
    padIndex: padIndex,
    numWithBase: numWithBase,
    setReadoutValue: setReadoutValue,
    isValidDigitForBase: isValidDigitForBase,
    findInvalidChar: findInvalidChar,
    stringToBigIntBase: stringToBigIntBase,
    bigIntToBase: bigIntToBase,
    calculateOnesAndTwosComplements: calculateOnesAndTwosComplements,
    setupTabs: setupTabs,
    getChannels: function () {
      return getChannelsFn();
    },
    setChannelGetter: function (fn) {
      getChannelsFn = fn;
    },
    notifyChannelsUpdated: function (channels) {
      document.dispatchEvent(new CustomEvent("channels:updated", { detail: channels }));
    }
  };

  // Initialize tabs when document is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupTabs);
  } else {
    setupTabs();
  }
})();
