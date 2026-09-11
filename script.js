(function () {
  "use strict";

  var MIN_CHANNELS = 3;  
  var MAX_CHANNELS = 24;  
  var BASES = [2, 8, 10, 16]; 

  // Human-readable info about each base
  var BASE_LABEL = { 2: "2", 8: "8", 10: "10", 16: "16" }; 
  var BASE_NAME  = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" }; 
  var BASE_PLACEHOLDER = { 2: "e.g. 1010", 8: "e.g. 377", 10: "e.g. 255", 16: "e.g. 1F" }; 

  // Symbols/names for the four arithmetic operators the tool supports.
  var OP_SYMBOL = { add: "+", sub: "\u2212", mul: "\u00D7", div: "\u00F7" };
  var OP_NAME   = { add: "Addition", sub: "Subtraction", mul: "Multiplication", div: "Division" };

  var channelState = [
    { base: 10, value: "" },
    { base: 10, value: "" },
    { base: 10, value: "" }
  ];
  var operatorState = "add"; 


  var channelsEl = document.getElementById("channels");  
  var countInput = document.getElementById("channel-count");  
  var countDecBtn = document.getElementById("count-dec");     
  var countIncBtn = document.getElementById("count-inc");    

  var opExpressionEl = document.getElementById("op-expression"); 
  var opErrorEl = document.getElementById("op-error");  
  var opResultEl = document.getElementById("op-result"); 
  var globalOpToggleEl = document.getElementById("global-op-toggle"); 

  // VALIDATION + NUMBER CONVERSION HELPERS 

  function isValidDigitForBase(ch, base) {
    var c = ch.toUpperCase();
    var val;
    if (c >= "0" && c <= "9") {
      val = c.charCodeAt(0) - 48;       // '0'..'9' -> 0..9
    } else if (c >= "A" && c <= "F") {
      val = c.charCodeAt(0) - 65 + 10;  // 'A'..'F' -> 10..15
    } else {
      return false; 
    }
    return val < base; // e.g., digit value 9 is NOT valid in base 8 (only 0-7 allowed)
  }

  // Scans a whole string and returns the first character that ISN'T a valid digit for the given base, or null if the whole string is valid
  function findInvalidChar(str, base) {
    for (var i = 0; i < str.length; i++) {
      if (!isValidDigitForBase(str[i], base)) return str[i];
    }
    return null; // every character was valid
  }

  // Converts a string of digits (already validated) into a BigInt, treating it as a number written in `base`
  // parseInt(char, 16) turns any single valid digit character (0-9, A-F) into its numeric value 0-15, no matter which base we're converting from
 
  function stringToBigIntBase(str, base) {
    var b = BigInt(base);
    var result = 0n;
    for (var i = 0; i < str.length; i++) {
      result = result * b + BigInt(parseInt(str[i], 16));
    }
    return result;
  }

  // Converts a BigInt number into a string of digits in the given base. (This is the reverse of stringToBigIntBase.)
  function bigIntToBase(num, base) {
    if (num === 0n) return "0";
    var neg = num < 0n;
    var n = neg ? -num : num;
    var digits = "0123456789ABCDEF";
    var b = BigInt(base);
    var out = "";
    while (n > 0n) {
      out = digits[Number(n % b)] + out; // peel off one digit at a time, from the right
      n = n / b;
    }
    return (neg ? "-" : "") + out;
  }

  // Turns a zero-based index into a friendly 2-digit label, e.g. 0 -> "01", 11 -> "12".
  function padIndex(i) {
    return String(i + 1).padStart(2, "0");
  }

  /* DISPLAYING VALUES WITH A SUBSCRIPT BASE */
     
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

  // Clears out a readout tile's value and replaces it with the number+subscript element above.
  function setReadoutValue(tile, numStr, baseNum) {
    var valueEl = tile.querySelector(".readout-value");
    valueEl.textContent = "";
    valueEl.appendChild(numWithBase(numStr, baseNum));
  }

  /*  BUILDING / UPDATING THE CHANNEL CARDS (the input boxes) */

  function resizeChannelState(count) {
    if (count > channelState.length) {
      while (channelState.length < count) {
        channelState.push({ base: 10, value: "" });
      }
    } else {
      channelState.length = count;
    }
  }

  // Builds the HTML markup (as a string) for a single channel card: the base-picker buttons (2/8/10/16), the text input, and the 4 little "readout" tiles that will show the converted values.
  function channelTemplate(index) {
    var num = String(index + 1).padStart(2, "0");

    // One button per base (2, 8, 10, 16) for picking which base this input uses.
    var baseButtons = BASES.map(function (b) {
      return '<button type="button" class="base-btn" data-base="' + b + '" aria-label="' + BASE_NAME[b] + '">' + BASE_LABEL[b] + "</button>";
    }).join("");

    // One "readout" tile per base, showing the converted value (starts empty).
    var tiles = BASES.map(function (b) {
      return (
        '<div class="readout-tile is-empty" data-base="' + b + '" aria-label="' + BASE_NAME[b] + ' value">' +
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

  // Rebuilds ALL the channel cards from scratch based on channelState, then wires up their buttons/inputs with event listeners. Called whenever the number of channels changes.
  function renderChannels() {
    // Build the markup for every channel and drop it into the page.
    var html = "";
    channelState.forEach(function (_, i) {
      html += channelTemplate(i);
    });
    channelsEl.innerHTML = html;

    // For each newly-created channel card, restore its saved state and hook up its interactive behavior.
    channelState.forEach(function (state, i) {
      var el = channelsEl.querySelector('.channel[data-index="' + i + '"]');
      var input = el.querySelector(".value-input");

      // Set the input's value via the DOM property (input.value = ...), never by inserting it into an HTML string. That means whatever the user types can never accidentally be interpreted as markup.
      input.value = state.value;
      input.placeholder = BASE_PLACEHOLDER[state.base];

      var activeBaseBtn = el.querySelector('.base-btn[data-base="' + state.base + '"]');
      activeBaseBtn.classList.add("is-active");

      // Clicking a base button switches which base this one channel uses.
      el.querySelectorAll(".base-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {

          if (btn.classList.contains("is-active")) return; // already selected, nothing to do

          el.querySelectorAll(".base-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          var newBase = parseInt(btn.dataset.base, 10);
          channelState[i].base = newBase;
          input.placeholder = BASE_PLACEHOLDER[newBase];
          updateChannel(el, i); // re-validate & re-convert now that the base changed
        });
      });

      // Typing in the input box updates the stored value and re-converts it live.
      input.addEventListener("input", function () {
        channelState[i].value = input.value;
        updateChannel(el, i);
      });

      updateChannel(el, i); // Do an initial conversion/validation pass right away.
    });
  }

  // Re-validates one channel's typed value and refreshes its 4 readout tiles (binary/octal/decimal/hex) to match. Also triggers a recalculation of the combined arithmetic result across all channels
  function updateChannel(el, i) {
    var state = channelState[i];
    var input = el.querySelector(".value-input");
    var errorEl = el.querySelector(".input-error");
    var tiles = el.querySelectorAll(".readout-tile");
    var raw = state.value.trim();

    // Resets all 4 readout tiles back to their empty "—" placeholder state.
    function clearTiles() {
      tiles.forEach(function (tile) {
        tile.classList.add("is-empty");
        tile.classList.remove("is-source");
        tile.querySelector(".readout-value").textContent = "—";
      });
    }

    // Case 1: the box is empty, nothing to show, nothing to validate
    if (raw === "") {
      input.classList.remove("is-invalid");
      errorEl.textContent = "";
      clearTiles();
      recomputeArithmetic();
      return;
    }

    // Case 2: the box has text, but it contains a character that isn't valid for the chosen base
    var badChar = findInvalidChar(raw, state.base);
    if (badChar !== null) {
      input.classList.add("is-invalid");
      errorEl.textContent = '"' + badChar + '" is not a valid ' + BASE_NAME[state.base] + " digit.";
      clearTiles();
      recomputeArithmetic();
      return;
    }

    // Case 3: valid input — clear any old error, convert the value into a single common number, then re-render it back out in all 4 bases.
    input.classList.remove("is-invalid");
    errorEl.textContent = "";

    var value = stringToBigIntBase(raw, state.base); // parse the typed text into an exact number
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
      setReadoutValue(tile, results[b], b);
    });

    recomputeArithmetic();
  }


  /* COMBINING ALL CHANNELS TOGETHER WITH ONE OPERATOR */

  function evaluateExpression(values, operator) {
    var acc = values[0]; // running total, starts as the first value
    for (var i = 1; i < values.length; i++) {
      var v = values[i];
      switch (operator) {
        case "add": acc = acc + v; break;
        case "sub": acc = acc - v; break;
        case "mul": acc = acc * v; break;
        case "div": acc = acc / v; break; // BigInt division: rounds toward zero (drops remainder)
      }
    }
    return acc;
  }

  // Fills in the "IN01 + IN02 + IN03 ..." row shown above the combined result.
  function appendExpressionTerms(container) {
    channelState.forEach(function (st, i) {
      container.appendChild(numWithBase(st.value.trim(), st.base));
      if (i < channelState.length - 1) {
        var opSpan = document.createElement("span");
        opSpan.className = "expr-op";
        opSpan.textContent = OP_SYMBOL[operatorState];
        container.appendChild(opSpan);
      }
    });
  }

  function setExpressionDash() {
    opExpressionEl.textContent = "—";
  }


  function setExpressionOnly() {
    opExpressionEl.textContent = "";
    appendExpressionTerms(opExpressionEl);
  }

  function setExpressionWithResult(result) {
    opExpressionEl.textContent = "";
    appendExpressionTerms(opExpressionEl);

    var eq = document.createElement("span");
    eq.className = "expr-op expr-eq";
    eq.textContent = "=";
    opExpressionEl.appendChild(eq);

    opExpressionEl.appendChild(numWithBase(result.toString(10), 10));
  }

  function showOpMessage(msg) {
    opErrorEl.textContent = msg;
  }

  function clearOpResult() {
    opResultEl.querySelectorAll(".readout-tile").forEach(function (tile) {
      tile.classList.add("is-empty");
      tile.querySelector(".readout-value").textContent = "—";
    });
  }

  // Fills in the combined-result tiles with the final computed value, shown in all 4 bases.
  function renderOpResult(result) {
    opResultEl.querySelectorAll(".readout-tile").forEach(function (tile) {
      var b = parseInt(tile.dataset.base, 10);
      tile.classList.remove("is-empty");
      setReadoutValue(tile, bigIntToBase(result, b), b);
    });
  }

  // The main "recalculate everything" function. Runs every time any channel's value, base, or the global operator changes.
  function recomputeArithmetic() {
    var n = channelState.length;

    //  Before combining anything, every single input must be filled in AND valid.
    for (var i = 0; i < n; i++) {
      var raw = channelState[i].value.trim();

      if (raw === "") {
        showOpMessage("Fill in Input " + padIndex(i) + " to see the combined result.");
        setExpressionDash();
        clearOpResult();
        return;
      }
      if (findInvalidChar(raw, channelState[i].base) !== null) {
        showOpMessage("Input " + padIndex(i) + " has an invalid " + BASE_NAME[channelState[i].base] + " value.");
        setExpressionDash();
        clearOpResult();
        return;
      }
    }

    // Convert every channel's typed text into one common format, so channels using different bases can be combined directly
    var values = channelState.map(function (st) {
      return stringToBigIntBase(st.value.trim(), st.base);
    });

    // Special case for division — check every value AFTER the first one for zero, since dividing by zero isn't allowed.
    if (operatorState === "div") {
      for (var j = 1; j < values.length; j++) {
        if (values[j] === 0n) {
          showOpMessage("Cannot divide by zero \u2014 Input " + padIndex(j) + " evaluates to 0.");
          setExpressionOnly();
          clearOpResult();
          return;
        }
      }
    }

    // if everything checks out, actually compute the combined result and display it 
    var result = evaluateExpression(values, operatorState);

    showOpMessage(""); // clear any previous error message
    setExpressionWithResult(result);
    renderOpResult(result);
  }

  /* GLOBAL OPERATOR TOGGLE (the +/−/×/÷ buttons) */

  function setupGlobalOpToggle() {
    if (!globalOpToggleEl) return; // safety check in case the element is missing from the page

    var activeBtn = globalOpToggleEl.querySelector('.op-btn-mini[data-op="' + operatorState + '"]');
    if (activeBtn) activeBtn.classList.add("is-active");

    // Clicking an operator button switches the global operator and immediately recalculates the combined result.
    globalOpToggleEl.querySelectorAll(".op-btn-mini").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.classList.contains("is-active")) return; // already selected
        globalOpToggleEl.querySelectorAll(".op-btn-mini").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        operatorState = btn.dataset.op;
        recomputeArithmetic();
      });
    });
  }



  // Changes the number of channels, keeping it within the allowed MIN_CHANNELS..MAX_CHANNELS range
  function setCount(newCount) {
    newCount = Math.max(MIN_CHANNELS, Math.min(MAX_CHANNELS, newCount));
    countInput.value = newCount;
    countDecBtn.disabled = newCount <= MIN_CHANNELS; // disable "-" at the minimum
    countIncBtn.disabled = newCount >= MAX_CHANNELS; // disable "+" at the maximum
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
    if (isNaN(n)) n = MIN_CHANNELS; // fall back to the minimum if the input wasn't a valid number
    setCount(n);
  });


  setupGlobalOpToggle();  // wire up the +/−/×/÷ buttons once
  setCount(channelState.length); // build the initial set of channel cards and compute the first result
})();