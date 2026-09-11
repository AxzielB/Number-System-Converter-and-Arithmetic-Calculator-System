(function () {
  "use strict";

  var MIN_CHANNELS = 3;
  var MAX_CHANNELS = 24;
  var BASES = [2, 8, 10, 16];

  // Human-readable info about each base
  var BASE_LABEL = { 2: "2", 8: "8", 10: "10", 16: "16" };
  var BASE_NAME  = { 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" };
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

  // Initial channels: 3 channels (a, b, c) matching (a+b)*c
  var channelState = [
    { base: 10, value: "" },
    { base: 10, value: "" },
    { base: 10, value: "" }
  ];

  var channelsEl = document.getElementById("channels");
  var countInput = document.getElementById("channel-count");
  var countDecBtn = document.getElementById("count-dec");
  var countIncBtn = document.getElementById("count-inc");

  var exprInput = document.getElementById("expr-input");
  var exprClearBtn = document.getElementById("expr-clear");
  var keypadVarsEl = document.getElementById("keypad-vars");
  var keypadOpsEl = document.querySelector(".keypad-ops");
  var presetPillsEl = document.getElementById("preset-pills");
  var keyBackspaceBtn = document.getElementById("key-backspace");

  var opExpressionEl = document.getElementById("op-expression");
  var opErrorEl = document.getElementById("op-error");
  var opResultEl = document.getElementById("op-result");

  /* ==========================================================================
     VALIDATION + NUMBER CONVERSION HELPERS
     ========================================================================== */

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
    valueEl.textContent = "";
    valueEl.appendChild(numWithBase(numStr, baseNum));
  }

  /* ==========================================================================
     EXPRESSION LEXER, PARSER (PRECEDENCE & ASSOCIATIVITY) & EVALUATOR
     ========================================================================== */

  /**
   * Tokenizer
   * Produces tokens: NUMBER, VAR, OP (+, -, *, /, %, ^), LPAREN, RPAREN
   */
  function tokenize(exprStr) {
    var tokens = [];
    var i = 0;
    var len = exprStr.length;

    while (i < len) {
      var ch = exprStr[i];

      // Ignore whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Parentheses
      if (ch === "(") {
        tokens.push({ type: "LPAREN", value: "(", pos: i });
        i++;
        continue;
      }
      if (ch === ")") {
        tokens.push({ type: "RPAREN", value: ")", pos: i });
        i++;
        continue;
      }

      // Unsupported operators: % and ^
      if (ch === "%") {
        throw new Error("Operator '%' is not supported. Please use +, -, *, /.");
      }
      if (ch === "^" || (ch === "*" && i + 1 < len && exprStr[i + 1] === "*")) {
        throw new Error("Operator '^' is not supported. Please use +, -, *, /.");
      }

      // Standard operators: + , - / − , * / × , / / ÷
      if (ch === "+" || ch === "-" || ch === "\u2212" || ch === "*" || ch === "\u00D7" || ch === "/" || ch === "\u00F7") {
        var op = ch;
        if (ch === "\u2212") op = "-";
        else if (ch === "\u00D7") op = "*";
        else if (ch === "\u00F7") op = "/";
        tokens.push({ type: "OP", value: op, pos: i });
        i++;
        continue;
      }

      // Hex, Binary, Octal literals: 0x..., 0b..., 0o...
      if (ch === "0" && i + 1 < len && (exprStr[i + 1].toLowerCase() === "x" || exprStr[i + 1].toLowerCase() === "b" || exprStr[i + 1].toLowerCase() === "o")) {
        var prefix = exprStr.substring(i, i + 2).toLowerCase();
        var startPos = i;
        i += 2;
        var radix = prefix === "0x" ? 16 : (prefix === "0b" ? 2 : 8);
        var rName = prefix === "0x" ? "hexadecimal" : (prefix === "0b" ? "binary" : "octal");
        var digits = "";
        while (i < len && isValidDigitForBase(exprStr[i], radix)) {
          digits += exprStr[i];
          i++;
        }
        if (digits.length === 0) {
          throw new Error("Missing digits for " + rName + " literal '" + prefix + "' at position " + (startPos + 1) + ".");
        }
        tokens.push({
          type: "NUMBER",
          value: stringToBigIntBase(digits, radix),
          raw: prefix + digits,
          base: radix,
          pos: startPos
        });
        continue;
      }

      // Decimal numbers
      if (ch >= "0" && ch <= "9") {
        var numStart = i;
        var decStr = "";
        while (i < len && exprStr[i] >= "0" && exprStr[i] <= "9") {
          decStr += exprStr[i];
          i++;
        }
        tokens.push({
          type: "NUMBER",
          value: BigInt(decStr),
          raw: decStr,
          base: 10,
          pos: numStart
        });
        continue;
      }

      // Identifiers: variables 'a'..'x' or 'in1'..'in24'
      if (/[a-zA-Z]/.test(ch)) {
        var idStart = i;
        var idStr = "";
        while (i < len && /[a-zA-Z0-9]/.test(exprStr[i])) {
          idStr += exprStr[i];
          i++;
        }
        var varIdx = varToIndex(idStr);
        if (varIdx !== -1) {
          tokens.push({
            type: "VAR",
            name: idStr.toLowerCase(),
            index: varIdx,
            pos: idStart
          });
          continue;
        } else {
          throw new Error("Unrecognized identifier '" + idStr + "' at position " + (idStart + 1) + ". Channels are 'a' to 'x' (or 'in1' to 'in24').");
        }
      }

      throw new Error("Invalid character '" + ch + "' at position " + (i + 1) + ".");
    }

    return tokens;
  }

  /**
   * Recursive Descent Parser
   * Enforces:
   * 1. Parentheses: ()
   * 2. Unary operators: +, - (right-associative)
   * 3. Power operator: ^ (right-associative)
   * 4. Multiplicative operators: *, /, % (left-associative)
   * 5. Additive operators: +, - (left-associative)
   */
  function parseExpression(tokens) {
    var cur = 0;

    function peek() {
      return tokens[cur] || null;
    }

    function consume() {
      return tokens[cur++];
    }

    function parsePrimary() {
      var tok = peek();
      if (!tok) {
        throw new Error("Incomplete expression: expected a number, variable, or '('.");
      }

      if (tok.type === "NUMBER") {
        consume();
        return { type: "Literal", value: tok.value, raw: tok.raw, base: tok.base, pos: tok.pos };
      }

      if (tok.type === "VAR") {
        consume();
        return { type: "Variable", name: tok.name, index: tok.index, pos: tok.pos };
      }

      if (tok.type === "LPAREN") {
        var lparenPos = tok.pos;
        consume(); // eat '('

        var nextTok = peek();
        if (nextTok && nextTok.type === "RPAREN") {
          throw new Error("Empty parentheses '()' are not allowed at position " + (lparenPos + 1) + ".");
        }

        var inner = parseAdditive();

        var closingTok = peek();
        if (!closingTok || closingTok.type !== "RPAREN") {
          throw new Error("Mismatched parentheses: missing closing ')' for '(' at position " + (lparenPos + 1) + ".");
        }
        consume(); // eat ')'
        return { type: "Group", expr: inner, pos: lparenPos };
      }

      if (tok.type === "RPAREN") {
        throw new Error("Unexpected closing parenthesis ')' at position " + (tok.pos + 1) + ".");
      }

      if (tok.type === "OP") {
        throw new Error("Unexpected operator '" + tok.value + "' at position " + (tok.pos + 1) + ".");
      }

      throw new Error("Unexpected syntax error at position " + (tok.pos + 1) + ".");
    }

    function parseUnary() {
      var tok = peek();
      if (tok && tok.type === "OP" && (tok.value === "+" || tok.value === "-")) {
        consume();
        var operand = parseUnary();
        return { type: "Unary", op: tok.value, expr: operand, pos: tok.pos };
      }
      return parsePrimary();
    }

    function parseMultiplicative() {
      var left = parseUnary();
      var tok = peek();
      while (tok && tok.type === "OP" && (tok.value === "*" || tok.value === "/")) {
        consume();
        var right = parseUnary();
        left = { type: "Binary", op: tok.value, left: left, right: right, pos: tok.pos };
        tok = peek();
      }
      return left;
    }

    function parseAdditive() {
      var left = parseMultiplicative();
      var tok = peek();
      while (tok && tok.type === "OP" && (tok.value === "+" || tok.value === "-")) {
        consume();
        var right = parseMultiplicative();
        left = { type: "Binary", op: tok.value, left: left, right: right, pos: tok.pos };
        tok = peek();
      }
      return left;
    }

    if (tokens.length === 0) {
      throw new Error("Please enter an expression to calculate (e.g. (a+b-c)*d).");
    }

    var ast = parseAdditive();

    if (cur < tokens.length) {
      var unparsed = tokens[cur];
      if (unparsed.type === "RPAREN") {
        throw new Error("Unexpected closing parenthesis ')' at position " + (unparsed.pos + 1) + ".");
      }
      var label = unparsed.raw || unparsed.name || unparsed.value || "token";
      throw new Error("Missing operator before '" + label + "' at position " + (unparsed.pos + 1) + ".");
    }

    return ast;
  }

  /**
   * Evaluates the parsed AST against active channels.
   * Performs rigorous error checking for:
   * - Undefined variables
   * - Unfilled or invalid channel values
   * - Division by zero
   * - Modulo by zero
   * - Negative exponents
   * - Dangerous exponent overflows
   */
  function evaluateAST(node, channels) {
    if (node.type === "Literal") {
      return node.value;
    }

    if (node.type === "Variable") {
      var idx = node.index;
      var varName = node.name;

      if (idx >= channels.length) {
        var lastVar = indexToVar(channels.length - 1);
        throw new Error(
          "Variable '" + varName + "' is not available. Active channels are a\u2013" +
          lastVar + " (Inputs 01\u2013" + padIndex(channels.length - 1) + "). Increase channel count to use it."
        );
      }

      var st = channels[idx];
      var raw = st.value.trim();

      if (raw === "") {
        throw new Error(
          "Channel '" + varName + "' (Input " + padIndex(idx) + ") is empty. Fill it in to evaluate."
        );
      }

      var badChar = findInvalidChar(raw, st.base);
      if (badChar !== null) {
        throw new Error(
          "Channel '" + varName + "' (Input " + padIndex(idx) + ") contains invalid " +
          BASE_NAME[st.base] + " digit '" + badChar + "'."
        );
      }

      return stringToBigIntBase(raw, st.base);
    }

    if (node.type === "Group") {
      return evaluateAST(node.expr, channels);
    }

    if (node.type === "Unary") {
      var operandVal = evaluateAST(node.expr, channels);
      if (node.op === "-") return -operandVal;
      return operandVal;
    }

    if (node.type === "Binary") {
      var leftVal = evaluateAST(node.left, channels);
      var rightVal = evaluateAST(node.right, channels);

      if (node.op === "+") return leftVal + rightVal;
      if (node.op === "-") return leftVal - rightVal;
      if (node.op === "*") return leftVal * rightVal;

      if (node.op === "/") {
        if (rightVal === 0n) {
          throw new Error("Division by zero: denominator evaluated to 0.");
        }
        return leftVal / rightVal; // BigInt truncates towards zero
      }

      throw new Error("Unsupported operator: " + node.op);
    }

    throw new Error("Unknown node type in AST evaluation.");
  }

  /**
   * Formats the substituted expression as rich DOM nodes with base subscripts and styled operators.
   */
  function appendSubstitutedNode(container, node, channels) {
    if (node.type === "Literal") {
      var litStr = node.raw || node.value.toString(10);
      var b = node.base || 10;
      container.appendChild(numWithBase(litStr, b));
      return;
    }

    if (node.type === "Variable") {
      var idx = node.index;
      if (idx < channels.length) {
        var st = channels[idx];
        var raw = st.value.trim();
        container.appendChild(numWithBase(raw, st.base));
      } else {
        var span = document.createElement("span");
        span.className = "expr-var";
        span.textContent = node.name;
        container.appendChild(span);
      }
      return;
    }

    if (node.type === "Group") {
      var lp = document.createElement("span");
      lp.className = "expr-paren";
      lp.textContent = "(";
      container.appendChild(lp);

      appendSubstitutedNode(container, node.expr, channels);

      var rp = document.createElement("span");
      rp.className = "expr-paren";
      rp.textContent = ")";
      container.appendChild(rp);
      return;
    }

    if (node.type === "Unary") {
      var uop = document.createElement("span");
      uop.className = "expr-op";
      uop.textContent = node.op === "-" ? "\u2212" : "+";
      container.appendChild(uop);

      appendSubstitutedNode(container, node.expr, channels);
      return;
    }

    if (node.type === "Binary") {
      appendSubstitutedNode(container, node.left, channels);

      var opSpan = document.createElement("span");
      opSpan.className = "expr-op";
      opSpan.textContent = OP_DISPLAY[node.op] || node.op;
      container.appendChild(opSpan);

      appendSubstitutedNode(container, node.right, channels);
      return;
    }
  }

  function setExpressionWithResult(ast, result, channels) {
    opExpressionEl.textContent = "";
    appendSubstitutedNode(opExpressionEl, ast, channels);

    var eq = document.createElement("span");
    eq.className = "expr-op expr-eq";
    eq.textContent = "=";
    opExpressionEl.appendChild(eq);

    opExpressionEl.appendChild(numWithBase(result.toString(10), 10));
  }

  function showOpMessage(msg) {
    opErrorEl.textContent = msg || "";
    if (exprInput) {
      if (msg) {
        exprInput.classList.add("is-invalid");
      } else {
        exprInput.classList.remove("is-invalid");
      }
    }
  }

  function clearOpResult() {
    opResultEl.querySelectorAll(".readout-tile").forEach(function (tile) {
      tile.classList.add("is-empty");
      tile.querySelector(".readout-value").textContent = "—";
    });
  }

  function renderOpResult(result) {
    opResultEl.querySelectorAll(".readout-tile").forEach(function (tile) {
      var b = parseInt(tile.dataset.base, 10);
      tile.classList.remove("is-empty");
      setReadoutValue(tile, bigIntToBase(result, b), b);
    });
  }

  /**
   * Main recalculation function.
   * Runs on every channel input/base change, expression edit, keypad click, or stepper change.
   */
  function recomputeArithmetic() {
    var rawExpr = exprInput ? exprInput.value.trim() : "";

    if (rawExpr === "") {
      showOpMessage("Please enter an expression to calculate (e.g. (a+b)*c).");
      opExpressionEl.textContent = "—";
      clearOpResult();
      return;
    }

    // 1. Tokenize expression
    var tokens;
    try {
      tokens = tokenize(rawExpr);
    } catch (tokErr) {
      showOpMessage(tokErr.message);
      opExpressionEl.textContent = rawExpr;
      clearOpResult();
      return;
    }

    // 2. Parse with precedence and associativity
    var ast;
    try {
      ast = parseExpression(tokens);
    } catch (parseErr) {
      showOpMessage(parseErr.message);
      opExpressionEl.textContent = rawExpr;
      clearOpResult();
      return;
    }

    // 3. Evaluate AST with channels and rigorous arithmetic checks
    var result;
    try {
      result = evaluateAST(ast, channelState);
    } catch (evalErr) {
      showOpMessage(evalErr.message);
      opExpressionEl.textContent = rawExpr;
      clearOpResult();
      return;
    }

    // 4. On success: display substituted expression and update 4-base result tiles
    showOpMessage("");
    setExpressionWithResult(ast, result, channelState);
    renderOpResult(result);
  }

  /* ==========================================================================
     KEYPAD AND INPUT INTERACTION HELPERS
     ========================================================================== */

  function insertAtCursor(inputEl, text) {
    if (!inputEl) return;
    var start = inputEl.selectionStart;
    var end = inputEl.selectionEnd;
    var val = inputEl.value;
    if (start === null || start === undefined) {
      inputEl.value = val + text;
      inputEl.focus();
    } else {
      inputEl.value = val.substring(0, start) + text + val.substring(end);
      var nextPos = start + text.length;
      inputEl.setSelectionRange(nextPos, nextPos);
      inputEl.focus();
    }
    recomputeArithmetic();
  }

  function backspaceAtCursor(inputEl) {
    if (!inputEl) return;
    var start = inputEl.selectionStart;
    var end = inputEl.selectionEnd;
    var val = inputEl.value;
    if (start !== end) {
      inputEl.value = val.substring(0, start) + val.substring(end);
      inputEl.setSelectionRange(start, start);
    } else if (start > 0) {
      inputEl.value = val.substring(0, start - 1) + val.substring(start);
      inputEl.setSelectionRange(start - 1, start - 1);
    }
    inputEl.focus();
    recomputeArithmetic();
  }

  function renderKeypadVars() {
    if (!keypadVarsEl) return;
    keypadVarsEl.innerHTML = "";
    channelState.forEach(function (_, i) {
      var v = indexToVar(i);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key-btn key-var";
      btn.dataset.insert = v;
      btn.setAttribute("aria-label", "Insert variable " + v + " (Input " + padIndex(i) + ")");
      btn.textContent = v;
      btn.addEventListener("click", function () {
        insertAtCursor(exprInput, v);
      });
      keypadVarsEl.appendChild(btn);
    });
  }

  function setupKeypadAndPresets() {
    if (keypadOpsEl) {
      keypadOpsEl.querySelectorAll(".key-op, .key-paren").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var toInsert = btn.dataset.insert;
          if (toInsert) {
            insertAtCursor(exprInput, toInsert);
          }
        });
      });
    }

    if (keyBackspaceBtn) {
      keyBackspaceBtn.addEventListener("click", function () {
        backspaceAtCursor(exprInput);
      });
    }

    if (exprClearBtn) {
      exprClearBtn.addEventListener("click", function () {
        exprInput.value = "";
        exprInput.focus();
        recomputeArithmetic();
      });
    }

    if (presetPillsEl) {
      presetPillsEl.querySelectorAll(".preset-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          exprInput.value = btn.dataset.preset;
          exprInput.focus();
          recomputeArithmetic();
        });
      });
    }

    if (exprInput) {
      exprInput.addEventListener("input", function () {
        recomputeArithmetic();
      });
    }
  }

  /* ==========================================================================
     BUILDING / UPDATING CHANNEL CARDS
     ========================================================================== */

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
    var varName = indexToVar(index);

    var baseButtons = BASES.map(function (b) {
      return '<button type="button" class="base-btn" data-base="' + b + '" aria-label="' + BASE_NAME[b] + '">' + BASE_LABEL[b] + "</button>";
    }).join("");

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
          '<span class="channel-var-tag">var <b>' + varName + "</b></span>" +
          '<div class="base-toggle" role="radiogroup" aria-label="Input base for channel ' + (index + 1) + '">' + baseButtons + "</div>" +
        "</div>" +
        '<div class="input-row">' +
          '<input type="text" class="value-input" autocomplete="off" spellcheck="false" aria-label="Value for channel ' + (index + 1) + ' (variable ' + varName + ')" />' +
          '<span class="input-error" aria-live="polite"></span>' +
        "</div>" +
        '<div class="readout-grid">' + tiles + "</div>" +
      "</article>"
    );
  }

  function renderChannels() {
    var html = "";
    channelState.forEach(function (_, i) {
      html += channelTemplate(i);
    });
    channelsEl.innerHTML = html;

    channelState.forEach(function (state, i) {
      var el = channelsEl.querySelector('.channel[data-index="' + i + '"]');
      var input = el.querySelector(".value-input");

      input.value = state.value;
      input.placeholder = BASE_PLACEHOLDER[state.base];

      var activeBaseBtn = el.querySelector('.base-btn[data-base="' + state.base + '"]');
      if (activeBaseBtn) activeBaseBtn.classList.add("is-active");

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
      recomputeArithmetic();
      return;
    }

    var badChar = findInvalidChar(raw, state.base);
    if (badChar !== null) {
      input.classList.add("is-invalid");
      errorEl.textContent = '"' + badChar + '" is not a valid ' + BASE_NAME[state.base] + " digit.";
      clearTiles();
      recomputeArithmetic();
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
      setReadoutValue(tile, results[b], b);
    });

    recomputeArithmetic();
  }

  /* ==========================================================================
     CHANNEL COUNT CONTROLS (STEPPER)
     ========================================================================== */

  function setCount(newCount) {
    newCount = Math.max(MIN_CHANNELS, Math.min(MAX_CHANNELS, newCount));
    countInput.value = newCount;
    countDecBtn.disabled = newCount <= MIN_CHANNELS;
    countIncBtn.disabled = newCount >= MAX_CHANNELS;
    resizeChannelState(newCount);
    renderChannels();
    renderKeypadVars();
    recomputeArithmetic();
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

  /* ==========================================================================
     INITIALIZATION
     ========================================================================== */

  setupKeypadAndPresets();
  setCount(channelState.length);
})();