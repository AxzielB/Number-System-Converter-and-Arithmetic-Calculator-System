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

  // Initial channels: 3 channels (a, b, c) matching (a+b)*c
  var channelState = [
    { base: 2, value: "", bitWidth: "auto" },
    { base: 2, value: "", bitWidth: "auto" },
    { base: 10, value: "", bitWidth: "auto" }
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

  /* COMPLEMENT SUBTRACTION ENGINE STATE & DOM ELEMENTS */
  var compState = {
    mBase: 2,
    mValue: "10101",
    nBase: 2,
    nValue: "01100",
    bitWidth: "auto"
  };

  var compMInput = document.getElementById("comp-m-input");
  var compNInput = document.getElementById("comp-n-input");
  var compMError = document.getElementById("comp-m-error");
  var compNError = document.getElementById("comp-n-error");
  var mBaseToggle = document.getElementById("m-base-toggle");
  var nBaseToggle = document.getElementById("n-base-toggle");
  var compBitwidthSelector = document.getElementById("comp-bitwidth-selector");
  var autoWidthDisplay = document.getElementById("auto-width-display");
  var onesCompSteps = document.getElementById("ones-comp-steps");
  var twosCompSteps = document.getElementById("twos-comp-steps");
  var compOperandsBreakdown = document.getElementById("comp-operands-breakdown");
  var mSyncPills = document.getElementById("m-sync-pills");
  var nSyncPills = document.getElementById("n-sync-pills");
  var compCalcBtn = document.getElementById("comp-calc-btn");

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

  /* 1'S & 2'S COMPLEMENT AND SUBTRACTION CALCULATION HELPERS */

  // Calculates 1's and 2's complements for a non-negative BigInt at the requested bit-width 
  // Returns representations in Binary, Hex, Octal, and Decimal (signed & unsigned).

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

  // Simulates columnar binary addition of two equal-length binary strings.
  // Tracks per-column carries, sum bits, and carry-out of the MSB.
  function performColumnarAddition(binA, binB) {
    var len = binA.length;
    var carries = new Array(len + 1).fill(0);
    var sumBits = new Array(len).fill(0);

    for (var i = 0; i < len; i++) {
      var bitPos = len - 1 - i;
      var a = parseInt(binA[bitPos], 10);
      var b = parseInt(binB[bitPos], 10);
      var cin = carries[i];
      var s = a + b + cin;
      sumBits[bitPos] = s % 2;
      carries[i + 1] = Math.floor(s / 2);
    }

    // Carry-in digits for columns from MSB to LSB:
    var carryInDigits = [];
    for (var k = 0; k < len; k++) {
      carryInDigits.push(carries[len - 1 - k]);
    }

    return {
      binA: binA,
      binB: binB,
      carries: carries,
      carryOut: carries[len],
      carryInDigits: carryInDigits,
      sumBits: sumBits.join("")
    };
  }

  // Solves subtraction M - N using both 1's and 2's complement methods step-by-step.
  function solveComplementSubtraction(mVal, nVal, mBase, nBase, mRaw, nRaw, bitWidthChoice) {
    var mBinRaw = mVal === 0n ? "0" : mVal.toString(2);
    var nBinRaw = nVal === 0n ? "0" : nVal.toString(2);
    var width;

    if (bitWidthChoice === "auto") {
      var inputLenM = (mBase === 2) ? mRaw.replace(/\s+/g, "").length : mBinRaw.length;
      var inputLenN = (nBase === 2) ? nRaw.replace(/\s+/g, "").length : nBinRaw.length;
      var maxDigits = Math.max(mBinRaw.length, nBinRaw.length, inputLenM, inputLenN);
      width = Math.max(maxDigits, 1);
    } else {
      width = parseInt(bitWidthChoice, 10);
    }

    var mBin = mBinRaw.padStart(width, "0");
    var nBin = nBinRaw.padStart(width, "0");
    if (mBin.length > width) mBin = mBin.slice(-width);
    if (nBin.length > width) nBin = nBin.slice(-width);

    var mod = 1n << BigInt(width);

    // 1's and 2's Complement of M
    var onesM = "";
    for (var i = 0; i < mBin.length; i++) {
      onesM += (mBin[i] === "0" ? "1" : "0");
    }
    var onesMBigInt = stringToBigIntBase(onesM, 2);
    var twosMBigInt = (onesMBigInt + 1n) % mod;
    var twosM = twosMBigInt.toString(2).padStart(width, "0");

    var mComplements = {
      bin: mBin,
      ones: {
        binary: onesM,
        hex: bigIntToBase(onesMBigInt, 16),
        octal: bigIntToBase(onesMBigInt, 8),
        dec: onesMBigInt.toString(10)
      },
      twos: {
        binary: twosM,
        hex: bigIntToBase(twosMBigInt, 16),
        octal: bigIntToBase(twosMBigInt, 8),
        unsignedDec: twosMBigInt.toString(10),
        signedDec: mVal === 0n ? "0" : "-" + mVal.toString(10)
      }
    };

    // 1's Complement of N
    var onesN = "";
    for (var j = 0; j < nBin.length; j++) {
      onesN += (nBin[j] === "0" ? "1" : "0");
    }

    // 2's Complement of N = 1's comp + 1
    var onesNBigInt = stringToBigIntBase(onesN, 2);
    var twosNBigInt = (onesNBigInt + 1n) % mod;
    var twosN = twosNBigInt.toString(2).padStart(width, "0");

    var nComplements = {
      bin: nBin,
      ones: {
        binary: onesN,
        hex: bigIntToBase(onesNBigInt, 16),
        octal: bigIntToBase(onesNBigInt, 8),
        dec: onesNBigInt.toString(10)
      },
      twos: {
        binary: twosN,
        hex: bigIntToBase(twosNBigInt, 16),
        octal: bigIntToBase(twosNBigInt, 8),
        unsignedDec: twosNBigInt.toString(10),
        signedDec: nVal === 0n ? "0" : "-" + nVal.toString(10)
      }
    };

    // Perform Columnar Additions
    var addOnes = performColumnarAddition(mBin, onesN);
    var addTwos = performColumnarAddition(mBin, twosN);

    // 1's Complement Analysis
    var onesResult = {};
    if (addOnes.carryOut === 1) {
      var rawSumStr = addOnes.sumBits;
      var rawSumVal = stringToBigIntBase(rawSumStr, 2);
      var finalVal = rawSumVal + 1n;
      var finalBin = finalVal.toString(2).padStart(width, "0");
      onesResult = {
        isPositive: true,
        hasEndAroundCarry: true,
        rawSum: rawSumStr,
        finalVal: finalVal,
        finalBin: finalBin,
        explanation: "End-around carry = 1 is generated (M \u2265 N, positive result). Add the end-around carry (+1) to the least significant bit (LSB)."
      };
    } else {
      var sumStr = addOnes.sumBits;
      var invSumStr = "";
      for (var k = 0; k < sumStr.length; k++) {
        invSumStr += (sumStr[k] === "0" ? "1" : "0");
      }
      var finalVal = stringToBigIntBase(invSumStr, 2);
      var finalBin = finalVal.toString(2).padStart(width, "0");
      onesResult = {
        isPositive: false,
        hasEndAroundCarry: false,
        rawSum: sumStr,
        invertedSum: invSumStr,
        finalVal: finalVal,
        finalBin: finalBin,
        explanation: "No end-around carry is generated (Carry = 0, M < N, negative result). Take the 1's complement of the sum and attach a negative sign (\u2212)."
      };
    }

    // 2's Complement Analysis
    var twosResult = {};
    if (addTwos.carryOut === 1) {
      var rawSumStr = addTwos.sumBits;
      var finalVal = stringToBigIntBase(rawSumStr, 2);
      var finalBin = finalVal.toString(2).padStart(width, "0");
      twosResult = {
        isPositive: true,
        hasEndCarry: true,
        rawSum: rawSumStr,
        finalVal: finalVal,
        finalBin: finalBin,
        explanation: "Carry out of MSB = 1 is generated (M \u2265 N, positive result). Discard the end carry to get the final difference."
      };
    } else {
      var sumStr = addTwos.sumBits;
      var invSumStr = "";
      for (var k = 0; k < sumStr.length; k++) {
        invSumStr += (sumStr[k] === "0" ? "1" : "0");
      }
      var invVal = stringToBigIntBase(invSumStr, 2);
      var finalVal = (invVal + 1n) % mod;
      var finalBin = finalVal.toString(2).padStart(width, "0");
      twosResult = {
        isPositive: false,
        hasEndCarry: false,
        rawSum: sumStr,
        invertedSum: invSumStr,
        finalVal: finalVal,
        finalBin: finalBin,
        explanation: "No carry out of MSB is generated (Carry = 0, M < N, negative result). Take the 2's complement of the sum (invert bits and add 1) and attach a negative sign (\u2212)."
      };
    }

    var trueDiff = mVal - nVal;

    return {
      width: width,
      mVal: mVal,
      nVal: nVal,
      mBin: mBin,
      nBin: nBin,
      onesM: onesM,
      twosM: twosM,
      mComplements: mComplements,
      onesN: onesN,
      twosN: twosN,
      nComplements: nComplements,
      addOnes: addOnes,
      addTwos: addTwos,
      onesResult: onesResult,
      twosResult: twosResult,
      trueDiff: trueDiff
    };
  }

  function renderColumnarMathHtml(binA, binB, addData, width, opLabel) {
    var carryCells = addData.carryInDigits.map(function (c) {
      return '<span class="digit-carry' + (c ? ' has-carry' : '') + '">' + c + '</span>';
    }).join("");

    var aCells = binA.split("").map(function (d) {
      return '<span class="digit-cell">' + d + '</span>';
    }).join("");

    var bCells = binB.split("").map(function (d) {
      return '<span class="digit-cell">' + d + '</span>';
    }).join("");

    var sumCells = addData.sumBits.split("").map(function (d) {
      return '<span class="digit-cell">' + d + '</span>';
    }).join("");

    var endCarryCell = '<span class="digit-carry is-end-carry' + (addData.carryOut ? ' has-carry' : '') + '">' + addData.carryOut + '</span>';
    var endSumCarryCell = '<span class="digit-cell end-carry-cell' + (addData.carryOut ? ' has-carry' : '') + '">' + addData.carryOut + '</span>';

    return (
      '<div class="columnar-math">' +
      '<div class="math-row carry-row">' +
      '<span class="math-label">Carries:</span>' +
      '<span class="math-digits">' + endCarryCell + carryCells + '</span>' +
      '</div>' +
      '<div class="math-row operand-row">' +
      '<span class="math-label">M:</span>' +
      '<span class="math-digits"><span class="digit-spacer">&nbsp;</span>' + aCells + '</span>' +
      '</div>' +
      '<div class="math-row operand-row op-plus">' +
      '<span class="math-label">+ ' + opLabel + ':</span>' +
      '<span class="math-digits"><span class="digit-spacer">&nbsp;</span>' + bCells + '</span>' +
      '</div>' +
      '<div class="math-line"></div>' +
      '<div class="math-row sum-row">' +
      '<span class="math-label">Sum:</span>' +
      '<span class="math-digits">' + endSumCarryCell + sumCells + '</span>' +
      '</div>' +
      '</div>'
    );
  }

  function renderResultTilesHtml(finalVal, isPositive) {
    var sign = isPositive ? "" : "\u2212";
    var bases = [2, 8, 10, 16];
    var results = {
      2: sign + bigIntToBase(finalVal, 2),
      8: sign + bigIntToBase(finalVal, 8),
      10: sign + finalVal.toString(10),
      16: sign + bigIntToBase(finalVal, 16)
    };

    return (
      '<div class="readout-grid comp-step-result-grid">' +
      bases.map(function (b) {
        return (
          '<div class="readout-tile" data-base="' + b + '" aria-label="' + BASE_NAME[b] + ' difference">' +
          '<span class="readout-label">' + BASE_LABEL[b] + '</span>' +
          '<span class="readout-value"><span class="num-with-base num-base-' + b + '">' + results[b] + '<sub class="base-sub">' + b + '</sub></span></span>' +
          '</div>'
        );
      }).join("") +
      '</div>'
    );
  }

  // EXPRESSION LEXER, PARSER (PRECEDENCE & ASSOCIATIVITY) & EVALUATOR

  // Tokenizer
  // Produces tokens: NUMBER, VAR, OP (+, -, *, /, %, ^), LPAREN, RPAREN
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

  // Recursive Descent Parser
  // Enforces:
  // 1. Parentheses: ()
  // 2. Unary operators: +, - (right-associative)
  // 3. Power operator: ^ (right-associative)
  // 4. Multiplicative operators: *, /, % (left-associative)
  // 5. Additive operators: +, - (left-associative)
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

  // Evaluates the parsed AST against active channels.
  // Performs rigorous error checking for:
  // - Undefined variables
  // - Unfilled or invalid channel values
  // - Division by zero
  // - Modulo by zero
  // - Negative exponents
  // - Dangerous exponent overflows
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

  // Formats the substituted expression as rich DOM nodes with base subscripts and styled operators.
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

  // Main recalculation function.
  // Runs on every channel input/base change, expression edit, keypad click, or stepper change.
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

  // Keypad and input interaction helpers

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

  // Building / updating channel cards

  function resizeChannelState(count) {
    if (count > channelState.length) {
      while (channelState.length < count) {
        channelState.push({ base: 10, value: "", bitWidth: "auto" });
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

    var currentBase = channelState[index] ? channelState[index].base : 2;
    var baseNameStr = BASE_NAME[currentBase] + " (" + currentBase + ")";

    return (
      '<article class="channel" data-index="' + index + '">' +
      '<div class="channel-head">' +
      '<div class="channel-head-left">' +
      '<span class="channel-tag">IN <b>' + num + "</b></span>" +
      '<span class="channel-var-tag">var <b>' + varName + "</b></span>" +
      '<span class="channel-base-tag">Base: <b class="ch-base-name">' + baseNameStr + "</b></span>" +
      '</div>' +
      '<div class="base-toggle" role="radiogroup" aria-label="Input base for channel ' + (index + 1) + '">' + baseButtons + "</div>" +
      "</div>" +
      '<div class="input-row">' +
      '<input type="text" class="value-input" autocomplete="off" spellcheck="false" aria-label="Value for channel ' + (index + 1) + ' (variable ' + varName + ')" />' +
      '<span class="input-error" aria-live="polite"></span>' +
      "</div>" +
      '<div class="readout-grid">' + tiles + "</div>" +
      '<div class="channel-complements">' +
      '<div class="comp-tray-head">' +
      '<span class="comp-tray-label">1\'s & 2\'s Complements</span>' +
      '<div class="ch-width-selector" role="radiogroup" aria-label="Bit width for channel ' + (index + 1) + '">' +
      '<button type="button" class="ch-width-btn is-active" data-width="auto">Auto</button>' +
      '<button type="button" class="ch-width-btn" data-width="8">8-bit</button>' +
      '<button type="button" class="ch-width-btn" data-width="16">16-bit</button>' +
      '<button type="button" class="ch-width-btn" data-width="32">32-bit</button>' +
      '</div>' +
      '</div>' +
      '<div class="comp-tray-grid">' +
      '<div class="comp-tile comp-tile-ones is-empty">' +
      '<div class="comp-tile-head">' +
      '<span class="comp-badge-pill badge-ones">1\'s Comp</span>' +
      '<span class="comp-tile-sub">Invert bits (0 &harr; 1)</span>' +
      '</div>' +
      '<div class="comp-val-bin">—</div>' +
      '<div class="comp-subreadouts">' +
      '<div class="comp-subtile"><span class="sub-label">Hex</span><span class="sub-val sub-hex">—</span></div>' +
      '<div class="comp-subtile"><span class="sub-label">Oct</span><span class="sub-val sub-oct">—</span></div>' +
      '<div class="comp-subtile"><span class="sub-label">Dec</span><span class="sub-val sub-dec">—</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="comp-tile comp-tile-twos is-empty">' +
      '<div class="comp-tile-head">' +
      '<span class="comp-badge-pill badge-twos">2\'s Comp</span>' +
      '<span class="comp-tile-sub">1\'s Comp + 1 (Negation)</span>' +
      '</div>' +
      '<div class="comp-val-bin">—</div>' +
      '<div class="comp-subreadouts">' +
      '<div class="comp-subtile"><span class="sub-label">Hex</span><span class="sub-val sub-hex">—</span></div>' +
      '<div class="comp-subtile"><span class="sub-label">Oct</span><span class="sub-val sub-oct">—</span></div>' +
      '<div class="comp-subtile"><span class="sub-label">Signed</span><span class="sub-val sub-signed">—</span></div>' +
      '<div class="comp-subtile"><span class="sub-label">Unsigned</span><span class="sub-val sub-dec">—</span></div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
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
          var baseTagEl = el.querySelector(".ch-base-name");
          if (baseTagEl) baseTagEl.textContent = BASE_NAME[newBase] + " (" + newBase + ")";
          input.placeholder = BASE_PLACEHOLDER[newBase];
          updateChannel(el, i);
        });
      });

      // Bit-width toggle in channel
      el.querySelectorAll(".ch-width-btn").forEach(function (btn) {
        if (btn.dataset.width === state.bitWidth) {
          btn.classList.add("is-active");
        } else {
          btn.classList.remove("is-active");
        }
        btn.addEventListener("click", function () {
          el.querySelectorAll(".ch-width-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          channelState[i].bitWidth = btn.dataset.width;
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
    var compOnesTile = el.querySelector(".comp-tile-ones");
    var compTwosTile = el.querySelector(".comp-tile-twos");
    var raw = state.value.trim();

    function clearTiles() {
      tiles.forEach(function (tile) {
        tile.classList.add("is-empty");
        tile.classList.remove("is-source");
        tile.querySelector(".readout-value").textContent = "—";
      });
      if (compOnesTile) {
        compOnesTile.classList.add("is-empty");
        compOnesTile.querySelector(".comp-val-bin").textContent = "—";
        compOnesTile.querySelector(".sub-hex").textContent = "—";
        compOnesTile.querySelector(".sub-oct").textContent = "—";
        compOnesTile.querySelector(".sub-dec").textContent = "—";
      }
      if (compTwosTile) {
        compTwosTile.classList.add("is-empty");
        compTwosTile.querySelector(".comp-val-bin").textContent = "—";
        compTwosTile.querySelector(".sub-hex").textContent = "—";
        compTwosTile.querySelector(".sub-oct").textContent = "—";
        compTwosTile.querySelector(".sub-signed").textContent = "—";
        compTwosTile.querySelector(".sub-dec").textContent = "—";
      }
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

    // 1's and 2's Complements computation for channel
    var compData = calculateOnesAndTwosComplements(value, state.bitWidth, raw, state.base);
    if (compOnesTile) {
      compOnesTile.classList.remove("is-empty");
      var binEl = compOnesTile.querySelector(".comp-val-bin");
      binEl.textContent = "";
      binEl.appendChild(numWithBase(compData.ones.binary, 2));

      var hexEl = compOnesTile.querySelector(".sub-hex");
      hexEl.textContent = "";
      hexEl.appendChild(numWithBase(compData.ones.hex, 16));

      var octEl = compOnesTile.querySelector(".sub-oct");
      octEl.textContent = "";
      octEl.appendChild(numWithBase(compData.ones.octal, 8));

      var decEl = compOnesTile.querySelector(".sub-dec");
      decEl.textContent = "";
      decEl.appendChild(numWithBase(compData.ones.dec, 10));
    }

    if (compTwosTile) {
      compTwosTile.classList.remove("is-empty");
      var binEl2 = compTwosTile.querySelector(".comp-val-bin");
      binEl2.textContent = "";
      binEl2.appendChild(numWithBase(compData.twos.binary, 2));

      var hexEl2 = compTwosTile.querySelector(".sub-hex");
      hexEl2.textContent = "";
      hexEl2.appendChild(numWithBase(compData.twos.hex, 16));

      var octEl2 = compTwosTile.querySelector(".sub-oct");
      octEl2.textContent = "";
      octEl2.appendChild(numWithBase(compData.twos.octal, 8));

      var signedEl2 = compTwosTile.querySelector(".sub-signed");
      signedEl2.textContent = "";
      signedEl2.appendChild(numWithBase(compData.twos.signedDec, 10));

      var decEl2 = compTwosTile.querySelector(".sub-dec");
      decEl2.textContent = "";
      decEl2.appendChild(numWithBase(compData.twos.unsignedDec, 10));
    }

    recomputeArithmetic();
  }

  // COMPLEMENT SUBTRACTION ENGINE SOLVER & CONTROLLER

  // Render Operands Complements breakdown (Minuend M and Subtrahend N)
  function renderOperandsBreakdownHtml(data, mBase, nBase) {
    return (
      '<div class="comp-breakdown-card">' +
      '<div class="comp-card-head">' +
      '<div class="ans-status-row">' +
      '<span class="comp-method-badge badge-operands">Step 1: Complements of Operands</span>' +
      '<span class="ans-precision-tag">' + data.width + '-bit word</span>' +
      '</div>' +
      '<h3 class="comp-card-title">1\'s & 2\'s Complements of Minuend (M) and Subtrahend (N)</h3>' +
      '<p class="comp-card-desc">Computed at the working word length (' + data.width + '-bit) before performing complement subtraction.</p>' +
      '</div>' +
      '<div class="comp-operands-breakdown-grid">' +

      // Minuend M Card
      '<div class="comp-operand-breakdown-box">' +
      '<div class="op-breakdown-header">' +
      '<span class="comp-operand-tag">Minuend <b>M</b> (' + BASE_NAME[mBase] + ')</span>' +
      '<span class="op-orig-val">M = <b>' + data.mBin + '</b><sub>2</sub> <span class="calc-dec">(' + data.mVal.toString(10) + '<sub>10</sub>)</span></span>' +
      '</div>' +
      '<div class="comp-tray-grid comp-operands-tray">' +
      '<div class="comp-tile comp-tile-ones">' +
      '<div class="comp-tile-head">' +
      '<span class="comp-badge-pill badge-ones">1\'s Comp of M</span>' +
      '</div>' +
      '<div class="comp-val-bin">' + data.mComplements.ones.binary + '<sub class="base-sub">2</sub></div>' +
      '</div>' +
      '<div class="comp-tile comp-tile-twos">' +
      '<div class="comp-tile-head">' +
      '<span class="comp-badge-pill badge-twos">2\'s Comp of M</span>' +
      '</div>' +
      '<div class="comp-val-bin">' + data.mComplements.twos.binary + '<sub class="base-sub">2</sub></div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Subtrahend N Card
      '<div class="comp-operand-breakdown-box">' +
      '<div class="op-breakdown-header">' +
      '<span class="comp-operand-tag">Subtrahend <b>N</b> (' + BASE_NAME[nBase] + ')</span>' +
      '<span class="op-orig-val">N = <b>' + data.nBin + '</b><sub>2</sub> <span class="calc-dec">(' + data.nVal.toString(10) + '<sub>10</sub>)</span></span>' +
      '</div>' +
      '<div class="comp-tray-grid comp-operands-tray">' +
      '<div class="comp-tile comp-tile-ones">' +
      '<div class="comp-tile-head">' +
      '<span class="comp-badge-pill badge-ones">1\'s Comp of N</span>' +
      '</div>' +
      '<div class="comp-val-bin">' + data.nComplements.ones.binary + '<sub class="base-sub">2</sub></div>' +
      '</div>' +
      '<div class="comp-tile comp-tile-twos">' +
      '<div class="comp-tile-head">' +
      '<span class="comp-badge-pill badge-twos">2\'s Comp of N</span>' +
      '</div>' +
      '<div class="comp-val-bin">' + data.nComplements.twos.binary + '<sub class="base-sub">2</sub></div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '</div>' +
      '</div>'
    );
  }

  function renderComplementAnswerHtml(method, data) {
    var isMethodOnes = method === "ones";
    var compResult = isMethodOnes ? data.onesResult : data.twosResult;
    var signChar = compResult.isPositive ? "+" : "\u2212";

    var statusBadge;
    var summaryRule;

    if (isMethodOnes) {
      if (compResult.hasEndAroundCarry) {
        statusBadge = '<span class="badge-status badge-success">End-Around Carry = 1 (Positive)</span>';
        summaryRule = 'Carry out of MSB = 1 &rarr; Added carry (+1) to LSB (End-Around Carry). Result is positive.';
      } else {
        statusBadge = '<span class="badge-status badge-neg">Carry = 0 (Negative)</span>';
        summaryRule = 'No carry out of MSB &rarr; Magnitude obtained by inverting sum bits (1\'s complement). Result is negative.';
      }
    } else {
      if (compResult.hasEndCarry) {
        statusBadge = '<span class="badge-status badge-success">MSB Carry = 1 (Positive)</span>';
        summaryRule = 'Carry out of MSB = 1 &rarr; End carry discarded. Result is positive.';
      } else {
        statusBadge = '<span class="badge-status badge-neg">Carry = 0 (Negative)</span>';
        summaryRule = 'No carry out of MSB &rarr; Magnitude obtained by taking 2\'s complement of sum. Result is negative.';
      }
    }

    var stepTitle = isMethodOnes ? "Step 2: Add M + (1's Comp of N)" : "Step 2: Add M + (2's Comp of N)";
    var stepFormula = isMethodOnes
      ? data.mBin + '<sub>2</sub> + ' + data.onesN + '<sub>2</sub>'
      : data.mBin + '<sub>2</sub> + ' + data.twosN + '<sub>2</sub>';
    var compOperandBin = isMethodOnes ? data.onesN : data.twosN;
    var opLabel = isMethodOnes ? "1's Comp N" : "2's Comp N";
    var addData = isMethodOnes ? data.addOnes : data.addTwos;

    return (
      '<div class="comp-answer-content">' +
      '<div class="ans-status-row">' +
      statusBadge +
      '<span class="ans-precision-tag">' + data.width + '-bit word</span>' +
      '</div>' +

      // Addition math display
      '<div class="comp-step-calc-box">' +
      '<div class="step-math-intro">' +
      '<span class="step-math-title">' + stepTitle + '</span>' +
      '<div class="step-math-expr">' + stepFormula + '</div>' +
      '</div>' +
      renderColumnarMathHtml(data.mBin, compOperandBin, addData, data.width, opLabel) +
      '</div>' +

      // Binary difference primary readout
      '<div class="ans-primary-box">' +
      '<div class="ans-primary-label">Binary Difference</div>' +
      '<div class="ans-primary-val ' + (compResult.isPositive ? 'is-pos' : 'is-neg') + '">' +
      signChar + compResult.finalBin + '<sub>2</sub>' +
      '</div>' +
      '<div class="ans-summary-text">' + summaryRule + '</div>' +
      '</div>' +

      // Answer in all number systems
      '<div class="ans-grid-title">Answer in All Number Systems</div>' +
      renderResultTilesHtml(compResult.finalVal, compResult.isPositive) +
      '</div>'
    );
  }

  function recomputeComplementSubtraction() {
    if (!compMInput || !compNInput) return;

    var mRaw = compMInput.value.trim();
    var nRaw = compNInput.value.trim();
    compState.mValue = mRaw;
    compState.nValue = nRaw;

    var mHasErr = false;
    var nHasErr = false;

    if (mRaw === "") {
      compMError.textContent = "Please enter Minuend M.";
      compMInput.classList.add("is-invalid");
      mHasErr = true;
    } else {
      var mBadChar = findInvalidChar(mRaw, compState.mBase);
      if (mBadChar !== null) {
        compMError.textContent = '"' + mBadChar + '" is not a valid ' + BASE_NAME[compState.mBase] + " digit.";
        compMInput.classList.add("is-invalid");
        mHasErr = true;
      } else {
        compMError.textContent = "";
        compMInput.classList.remove("is-invalid");
      }
    }

    if (nRaw === "") {
      compNError.textContent = "Please enter Subtrahend N.";
      compNInput.classList.add("is-invalid");
      nHasErr = true;
    } else {
      var nBadChar = findInvalidChar(nRaw, compState.nBase);
      if (nBadChar !== null) {
        compNError.textContent = '"' + nBadChar + '" is not a valid ' + BASE_NAME[compState.nBase] + " digit.";
        compNInput.classList.add("is-invalid");
        nHasErr = true;
      } else {
        compNError.textContent = "";
        compNInput.classList.remove("is-invalid");
      }
    }

    if (mHasErr || nHasErr) {
      if (compOperandsBreakdown) compOperandsBreakdown.innerHTML = "";
      onesCompSteps.innerHTML = '<div class="comp-empty-msg">Enter valid values for Minuend M and Subtrahend N, then click "Calculate Subtraction".</div>';
      twosCompSteps.innerHTML = '<div class="comp-empty-msg">Enter valid values for Minuend M and Subtrahend N, then click "Calculate Subtraction".</div>';
      return;
    }

    var mVal = stringToBigIntBase(mRaw, compState.mBase);
    var nVal = stringToBigIntBase(nRaw, compState.nBase);

    var solverData = solveComplementSubtraction(mVal, nVal, compState.mBase, compState.nBase, mRaw, nRaw, compState.bitWidth);

    if (autoWidthDisplay) {
      autoWidthDisplay.textContent = String(solverData.width);
    }

    if (compOperandsBreakdown) {
      compOperandsBreakdown.innerHTML = renderOperandsBreakdownHtml(solverData, compState.mBase, compState.nBase);
    }

    onesCompSteps.innerHTML = renderComplementAnswerHtml("ones", solverData);
    twosCompSteps.innerHTML = renderComplementAnswerHtml("twos", solverData);
  }

  function renderComplementSyncPills() {
    if (!mSyncPills || !nSyncPills) return;
    mSyncPills.innerHTML = "";
    nSyncPills.innerHTML = "";

    channelState.forEach(function (st, idx) {
      var vName = indexToVar(idx);
      var numLabel = padIndex(idx);

      var btnM = document.createElement("button");
      btnM.type = "button";
      btnM.className = "sync-pill-btn";
      btnM.textContent = vName + " (" + numLabel + ")";
      btnM.title = "Copy channel " + vName + " into Minuend M";
      btnM.addEventListener("click", function () {
        compState.mBase = st.base;
        compState.mValue = st.value;
        compMInput.value = st.value;
        compMInput.placeholder = BASE_PLACEHOLDER[st.base];
        mBaseToggle.querySelectorAll(".base-btn").forEach(function (b) {
          b.classList.toggle("is-active", parseInt(b.dataset.base, 10) === st.base);
        });
      });
      mSyncPills.appendChild(btnM);

      var btnN = document.createElement("button");
      btnN.type = "button";
      btnN.className = "sync-pill-btn";
      btnN.textContent = vName + " (" + numLabel + ")";
      btnN.title = "Copy channel " + vName + " into Subtrahend N";
      btnN.addEventListener("click", function () {
        compState.nBase = st.base;
        compState.nValue = st.value;
        compNInput.value = st.value;
        compNInput.placeholder = BASE_PLACEHOLDER[st.base];
        nBaseToggle.querySelectorAll(".base-btn").forEach(function (b) {
          b.classList.toggle("is-active", parseInt(b.dataset.base, 10) === st.base);
        });
      });
      nSyncPills.appendChild(btnN);
    });
  }

  function setupComplementEngine() {
    if (mBaseToggle) {
      mBaseToggle.querySelectorAll(".base-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          mBaseToggle.querySelectorAll(".base-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          compState.mBase = parseInt(btn.dataset.base, 10);
          compMInput.placeholder = BASE_PLACEHOLDER[compState.mBase];
        });
      });
    }

    if (nBaseToggle) {
      nBaseToggle.querySelectorAll(".base-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          nBaseToggle.querySelectorAll(".base-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          compState.nBase = parseInt(btn.dataset.base, 10);
          compNInput.placeholder = BASE_PLACEHOLDER[compState.nBase];
        });
      });
    }

    if (compCalcBtn) {
      compCalcBtn.addEventListener("click", function () {
        recomputeComplementSubtraction();
      });
    }

    if (compMInput) {
      compMInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          recomputeComplementSubtraction();
        }
      });
    }
    if (compNInput) {
      compNInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          recomputeComplementSubtraction();
        }
      });
    }


    if (compBitwidthSelector) {
      compBitwidthSelector.querySelectorAll(".bitwidth-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          compBitwidthSelector.querySelectorAll(".bitwidth-btn").forEach(function (b) { b.classList.remove("is-active"); });
          btn.classList.add("is-active");
          compState.bitWidth = btn.dataset.width;
          recomputeComplementSubtraction();
        });
      });
    }

    renderComplementSyncPills();
    recomputeComplementSubtraction();
  }

  // Channel count controls (stepper)

  function setCount(newCount) {
    newCount = Math.max(MIN_CHANNELS, Math.min(MAX_CHANNELS, newCount));
    countInput.value = newCount;
    countDecBtn.disabled = newCount <= MIN_CHANNELS;
    countIncBtn.disabled = newCount >= MAX_CHANNELS;
    resizeChannelState(newCount);
    renderChannels();
    renderKeypadVars();
    renderComplementSyncPills();
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

  // Initialization

  setupKeypadAndPresets();
  setupComplementEngine();
  setCount(channelState.length);
})();