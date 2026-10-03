// tab-bcd.js - Tab 3: Binary-Coded Decimal (BCD) Arithmetic Engine

(function () {
  "use strict";

  // BCD ARITHMETIC ENGINE (ADDITION, 9'S & 10'S COMPLEMENT SUBTRACTION)

  var bcdState = {
    a: "",
    b: ""
  };

  var bcdAInput = document.getElementById("bcd-a-input");
  var bcdBInput = document.getElementById("bcd-b-input");
  var bcdAError = document.getElementById("bcd-a-error");
  var bcdBError = document.getElementById("bcd-b-error");
  var bcdCalcBtn = document.getElementById("bcd-calc-btn");

  var bcdConversionBox = document.getElementById("bcd-conversion-box");
  var bcdAdditionBox = document.getElementById("bcd-addition-box");
  var bcdSubtractionBox = document.getElementById("bcd-subtraction-box");

  function digitToBCD(d) {
    var n = parseInt(d, 10);
    return isNaN(n) ? "0000" : n.toString(2).padStart(4, "0");
  }

  function numberStringToBCD(str) {
    var digits = str.split("");
    var nibbles = digits.map(function (d) { return digitToBCD(d); });
    return {
      digits: digits,
      nibbles: nibbles,
      formatted: nibbles.join(" ")
    };
  }

  function getDigitPositionName(idx, total) {
    var names = ["Units (10⁰)", "Tens (10¹)", "Hundreds (10²)", "Thousands (10³)", "Ten Thousands (10⁴)", "Hundred Thousands (10⁵)"];
    if (idx < names.length) return names[idx];
    return "10^" + idx + " place";
  }

  // Core BCD Addition for an array of single-digit numbers (from LSB to MSB)
  function computeBCDAddition(digitsA, digitsB, initialCarry) {
    var len = Math.max(digitsA.length, digitsB.length);
    var carry = initialCarry ? 1 : 0;
    var steps = [];
    var sumDigits = [];

    for (var i = 0; i < len; i++) {
      var da = i < digitsA.length ? digitsA[i] : 0;
      var db = i < digitsB.length ? digitsB[i] : 0;
      var cin = carry;
      var rawSum = da + db + cin;
      var needsCorrection = rawSum > 9;
      var correctedVal = needsCorrection ? (rawSum + 6) % 16 : rawSum;
      var cout = needsCorrection ? 1 : 0;

      var daBin = digitToBCD(da);
      var dbBin = digitToBCD(db);
      var rawSumBin = rawSum.toString(2).padStart(4, "0");
      var finalBin = digitToBCD(correctedVal);

      steps.push({
        position: i,
        posName: getDigitPositionName(i, len),
        da: da,
        db: db,
        daBin: daBin,
        dbBin: dbBin,
        cin: cin,
        rawSum: rawSum,
        rawSumBin: rawSumBin,
        needsCorrection: needsCorrection,
        correctionVal: needsCorrection ? 6 : 0,
        correctionBin: needsCorrection ? "0110" : "0000",
        finalDigit: correctedVal,
        finalBin: finalBin,
        cout: cout
      });

      sumDigits.push(correctedVal);
      carry = cout;
    }

    var extraCarry = carry;
    var finalResultDigits = sumDigits.slice();
    if (extraCarry === 1) {
      finalResultDigits.push(1);
    }

    return {
      len: len,
      steps: steps,
      sumDigits: sumDigits,
      finalDigits: finalResultDigits,
      finalCarry: extraCarry
    };
  }

  // Renders a unified multi-digit BCD columnar addition operation
  function renderMultiDigitBCDStackHtml(aNibbles, bNibbles, addResult, opLabelA, opLabelB) {
    var stepsMsbToLsb = addResult.steps.slice().reverse();
    var hasCorrection = stepsMsbToLsb.some(function (st) { return st.needsCorrection; });

    var aStr = aNibbles.join("&nbsp; ");
    var bStr = "+ " + bNibbles.join("&nbsp; ");

    var rawSumsStr = stepsMsbToLsb.map(function (st) {
      return st.rawSumBin;
    }).join("&nbsp; ");

    var corrSpans = stepsMsbToLsb.map(function (st) {
      if (st.needsCorrection) {
        return '<span class="bcd-corr-nibble is-corr">0110</span>';
      }
      return '<span class="bcd-corr-nibble no-corr">0000</span>';
    }).join("&nbsp; ");

    var finalNibbles = stepsMsbToLsb.map(function (st) {
      return st.finalBin;
    });

    var finalStr = "";
    if (addResult.finalCarry === 1) {
      finalStr = '<span class="bcd-carry-msb">0001</span>&nbsp; ' + finalNibbles.join("&nbsp; ");
    } else {
      finalStr = finalNibbles.join("&nbsp; ");
    }

    var html = '<div class="bcd-multi-calc">';
    html += '<div class="bcd-stack-row"><span class="bcd-stack-label">' + opLabelA + ':</span><span class="bcd-stack-val">' + aStr + '</span></div>';
    html += '<div class="bcd-stack-row"><span class="bcd-stack-label">' + opLabelB + ':</span><span class="bcd-stack-val">' + bStr + '</span></div>';
    html += '<div class="bcd-stack-divider"></div>';

    if (hasCorrection) {
      html += '<div class="bcd-stack-row bcd-row-raw"><span class="bcd-stack-label">Binary Sum:</span><span class="bcd-stack-val">' + rawSumsStr + '</span></div>';
      html += '<div class="bcd-stack-row bcd-row-corr"><span class="bcd-stack-label">+ BCD Correction:</span><span class="bcd-stack-val">+ ' + corrSpans + '</span></div>';
      html += '<div class="bcd-stack-divider"></div>';
    }

    html += '<div class="bcd-stack-row bcd-row-final"><span class="bcd-stack-label">BCD Sum:</span><span class="bcd-stack-val">' + finalStr + '</span></div>';
    html += '</div>';

    return html;
  }

  // Renders Box 2: Decimal to BCD Conversion
  function renderBCDRepresentationsHtml(aStr, bStr, padLen) {
    var paddedA = aStr.padStart(padLen, "0");
    var paddedB = bStr.padStart(padLen, "0");

    var aData = numberStringToBCD(paddedA);
    var bData = numberStringToBCD(paddedB);

    function renderNibbleCards(data) {
      return (
        '<div class="bcd-rep-digits">' +
        data.digits.map(function (d, i) {
          return (
            '<div class="bcd-nibble-card">' +
            '<span class="bcd-nibble-label">Digit ' + (data.digits.length - i - 1) + '</span>' +
            '<span class="bcd-nibble-dec">' + d + '</span>' +
            '<span class="bcd-nibble-bin">' + data.nibbles[i] + '<sub class="base-sub">2</sub></span>' +
            '</div>'
          );
        }).join("") +
        '</div>'
      );
    }

    return (
      '<div class="bcd-box-head">' +
      '<span class="bcd-box-badge bcd-badge-rep">Decimal to BCD Conversion</span>' +
      '<h3 class="bcd-box-title">Decimal &rarr; BCD Conversion</h3>' +
      '<p class="bcd-box-desc">Each decimal digit is converted independently into its corresponding 4-bit 8421 Binary-Coded Decimal nibble (aligned to ' + padLen + ' digit' + (padLen > 1 ? 's' : '') + ').</p>' +
      '</div>' +
      '<div class="bcd-rep-grid">' +
      '<div class="bcd-rep-box">' +
      '<div class="bcd-rep-header">' +
      '<span class="bcd-operand-tag">Number <b>A</b> = ' + aStr + '<sub>10</sub></span>' +
      '</div>' +
      renderNibbleCards(aData) +
      '<div class="bcd-full-string"><span>Full BCD of A:</span> <code>' + aData.formatted + '<sub class="base-sub">BCD</sub></code></div>' +
      '</div>' +
      '<div class="bcd-rep-box">' +
      '<div class="bcd-rep-header">' +
      '<span class="bcd-operand-tag">Number <b>B</b> = ' + bStr + '<sub>10</sub></span>' +
      '</div>' +
      renderNibbleCards(bData) +
      '<div class="bcd-full-string"><span>Full BCD of B:</span> <code>' + bData.formatted + '<sub class="base-sub">BCD</sub></code></div>' +
      '</div>' +
      '</div>'
    );
  }

  // Renders BCD Addition
  function renderBCDAdditionBoxHtml(aStr, bStr, padLen) {
    var paddedA = aStr.padStart(padLen, "0");
    var paddedB = bStr.padStart(padLen, "0");

    var digitsA = paddedA.split("").map(Number).reverse();
    var digitsB = paddedB.split("").map(Number).reverse();

    var aData = numberStringToBCD(paddedA);
    var bData = numberStringToBCD(paddedB);

    var addResult = computeBCDAddition(digitsA, digitsB, false);
    var finalDec = (BigInt(aStr) + BigInt(bStr)).toString(10);
    var finalBcdNibbles = addResult.finalDigits.slice().reverse().map(digitToBCD);
    var finalBcdStr = finalBcdNibbles.join(" ");

    var multiStackHtml = renderMultiDigitBCDStackHtml(aData.nibbles, bData.nibbles, addResult, "A in BCD", "+ B in BCD");

    return (
      '<div class="bcd-box-head">' +
      '<span class="bcd-box-badge bcd-badge-add">BCD Addition</span>' +
      '<h3 class="bcd-box-title">BCD Addition (A + B)</h3>' +
      '</div>' +
      multiStackHtml +
      '<div class="bcd-results-wrap">' +
      '<div class="bcd-result-tile">' +
      '<span class="bcd-result-label">Final BCD Sum</span>' +
      '<span class="bcd-result-val">' + finalBcdStr + '<sub class="base-sub">BCD</sub></span>' +
      '</div>' +
      '<div class="bcd-result-tile">' +
      '<span class="bcd-result-label">Final Decimal Sum</span>' +
      '<span class="bcd-result-val">' + finalDec + '<sub class="base-sub">10</sub></span>' +
      '</div>' +
      '</div>'
    );
  }

  // Renders Step 3 of BCD Subtraction: Columnar multi-digit BCD Addition of A + Complement(B)
  function renderComplementBCDAdditionStepHtml(aNibbles, compNibbles, addResult, opLabelB, methodType) {
    var stepsMsbToLsb = addResult.steps.slice().reverse();
    var hasCorrection = stepsMsbToLsb.some(function (st) { return st.needsCorrection; });

    var aStr = aNibbles.join("&nbsp; ");
    var bStr = "+ " + compNibbles.join("&nbsp; ");

    var rawSumsStr = stepsMsbToLsb.map(function (st) {
      return st.rawSumBin;
    }).join("&nbsp; ");

    var corrSpans = stepsMsbToLsb.map(function (st) {
      if (st.needsCorrection) {
        return '<span class="bcd-corr-nibble is-corr">0110</span>';
      }
      return '<span class="bcd-corr-nibble no-corr">0000</span>';
    }).join("&nbsp; ");

    var interNibbles = addResult.sumDigits.slice().reverse().map(digitToBCD);

    var isNine = methodType === "9s";
    var carryVal = addResult.finalCarry;
    var carryBadge = isNine
      ? '<span class="bcd-carry-flag ' + (carryVal === 1 ? 'is-pos' : 'is-neg') + '">End-Around Carry (C<sub>end</sub>) = ' + carryVal + '</span>'
      : '<span class="bcd-carry-flag ' + (carryVal === 1 ? 'is-pos' : 'is-neg') + '">Final Carry (End Carry) = ' + carryVal + '</span>';

    var stepTitle = isNine
      ? "Add Minuend A + 9's Complement of B"
      : "Add Minuend A + 10's Complement of B";

    var calcHtml = '<div class="bcd-multi-calc">';
    calcHtml += '<div class="bcd-stack-row"><span class="bcd-stack-label">A in BCD:</span><span class="bcd-stack-val">' + aStr + '</span></div>';
    calcHtml += '<div class="bcd-stack-row"><span class="bcd-stack-label">' + opLabelB + ':</span><span class="bcd-stack-val">' + bStr + '</span></div>';
    calcHtml += '<div class="bcd-stack-divider"></div>';

    if (hasCorrection) {
      calcHtml += '<div class="bcd-stack-row bcd-row-raw"><span class="bcd-stack-label">Binary Sum:</span><span class="bcd-stack-val">' + rawSumsStr + '</span></div>';
      calcHtml += '<div class="bcd-stack-row bcd-row-corr"><span class="bcd-stack-label">+ BCD Correction:</span><span class="bcd-stack-val">+ ' + corrSpans + '</span></div>';
      calcHtml += '<div class="bcd-stack-divider"></div>';
    }

    var interValStr = "";
    if (carryVal === 1) {
      interValStr = '<span class="bcd-carry-msb">1</span>&nbsp; ' + interNibbles.join("&nbsp; ");
    } else {
      interValStr = interNibbles.join("&nbsp; ");
    }

    calcHtml += '<div class="bcd-stack-row bcd-row-inter"><span class="bcd-stack-label">Intermediate Sum:</span><span class="bcd-stack-val">' + interValStr + '</span></div>';
    calcHtml += '</div>';

    return (
      '<div class="bcd-sub-step-card">' +
      '<div class="bcd-sub-step-header">' +
      '<div class="bcd-sub-step-title-wrap">' +
      '<span class="bcd-step-pill">Step 2</span>' +
      '<h5 class="bcd-sub-step-title">' + stepTitle + '</h5>' +
      '</div>' +
      carryBadge +
      '</div>' +
      calcHtml +
      '</div>'
    );
  }

  // Method 1: BCD Subtraction Using 9's Complement
  function renderBCDSub9sMethodHtml(aStr, bStr, padLen) {
    var paddedA = aStr.padStart(padLen, "0");
    var paddedB = bStr.padStart(padLen, "0");

    var valA = BigInt(aStr);
    var valB = BigInt(bStr);

    var digitsA = paddedA.split("").map(Number).reverse();
    var digitsB = paddedB.split("").map(Number).reverse();

    var aData = numberStringToBCD(paddedA);
    var ninesNines = "9".repeat(padLen);

    // Step 1: 9's complement of B
    var comp9Digits = digitsB.map(function (d) { return 9 - d; });
    var comp9Str = comp9Digits.slice().reverse().join("");
    var comp9Data = numberStringToBCD(comp9Str);

    // Step 2: Multi-digit BCD Addition of A + 9's complement of B
    var addResult9 = computeBCDAddition(digitsA, comp9Digits, false);
    var hasEndAroundCarry = addResult9.finalCarry === 1;
    var interNibbles = addResult9.sumDigits.slice().reverse().map(digitToBCD);
    var interDecStr = addResult9.sumDigits.slice().reverse().join("");

    // Step 1 HTML (Calculate 9's Complement of Subtrahend B)
    var step1Html =
      '<div class="bcd-sub-step-card">' +
      '<div class="bcd-sub-step-header">' +
      '<div class="bcd-sub-step-title-wrap">' +
      '<span class="bcd-step-pill">Step 1</span>' +
      '<h5 class="bcd-sub-step-title">Calculate 9\'s Complement of Subtrahend B</h5>' +
      '</div>' +
      '</div>' +
      '<div class="bcd-deriv-box">' +
      '<div class="bcd-deriv-step">Subtract each digit from 9: <code>' + ninesNines + '₁₀ &minus; ' + paddedB + '₁₀ = <b>' + comp9Str + '₁₀</b></code></div>' +
      '<div class="bcd-deriv-step">9\'s Complement of B in BCD: <code><b>' + comp9Data.formatted + '</b><sub class="base-sub">BCD</sub></code></div>' +
      '</div>' +
      '</div>';

    // Step 2 HTML (Add Minuend A + 9's Complement of B)
    var step2Html = renderComplementBCDAdditionStepHtml(aData.nibbles, comp9Data.nibbles, addResult9, "+ 9's Comp of B", "9s");

    // Step 3 HTML & Final Results
    var step3Html = '';
    var finalDec9 = '';
    var finalBcdStr9 = '';

    if (hasEndAroundCarry) {
      var cleanDiff9 = (valA - valB).toString(10);
      finalDec9 = "+" + cleanDiff9;
      finalBcdStr9 = "+" + numberStringToBCD(cleanDiff9.padStart(padLen, "0")).formatted;

      var eacNibbles = [];
      for (var k = 0; k < padLen; k++) {
        eacNibbles.push(k === padLen - 1 ? "0001" : "0000");
      }
      var finalBcdNibbles = numberStringToBCD(cleanDiff9.padStart(padLen, "0")).nibbles;

      step3Html =
        '<div class="bcd-sub-step-card">' +
        '<div class="bcd-sub-step-header">' +
        '<div class="bcd-sub-step-title-wrap">' +
        '<span class="bcd-step-pill">Step 3</span>' +
        '<h5 class="bcd-sub-step-title">Handle End-Around Carry (C<sub>end</sub> = 1)</h5>' +
        '</div>' +
        '<span class="bcd-carry-pill is-one">End-Around Carry = 1 &rarr; Positive Result (A &ge; B)</span>' +
        '</div>' +
        '<div class="bcd-comp-math-box">' +
        '<div class="bcd-stack-row">' +
        '<span class="bcd-stack-label">Intermediate Sum:</span>' +
        '<span class="bcd-stack-val">' + interNibbles.join("&nbsp; ") + '</span>' +
        '</div>' +
        '<div class="bcd-stack-row">' +
        '<span class="bcd-stack-label">+ End-Around Carry:</span>' +
        '<span class="bcd-stack-val">+ ' + eacNibbles.join("&nbsp; ") + '</span>' +
        '</div>' +
        '<div class="bcd-stack-divider"></div>' +
        '<div class="bcd-stack-row bcd-row-final">' +
        '<span class="bcd-stack-label">Final BCD Difference:</span>' +
        '<span class="bcd-stack-val">' + finalBcdNibbles.join("&nbsp; ") + '</span>' +
        '</div>' +
        '</div>' +
        '</div>';
    } else {
      var negComp9Digits = addResult9.sumDigits.map(function (d) { return 9 - d; });
      var negComp9Str = negComp9Digits.slice().reverse().join("");

      if (valA === valB) {
        finalDec9 = "+0";
        finalBcdStr9 = "+" + "0000 ".repeat(padLen).trim();
      } else {
        var cleanDiffNeg = (valB - valA).toString(10);
        finalDec9 = "−" + cleanDiffNeg;
        finalBcdStr9 = "−" + numberStringToBCD(cleanDiffNeg.padStart(padLen, "0")).formatted;
      }

      step3Html =
        '<div class="bcd-sub-step-card">' +
        '<div class="bcd-sub-step-header">' +
        '<div class="bcd-sub-step-title-wrap">' +
        '<span class="bcd-step-pill">Step 3</span>' +
        '<h5 class="bcd-sub-step-title">' + (valA === valB ? 'Evaluate Result (A = B)' : 'Evaluate End-Around Carry (C<sub>end</sub> = 0)') + '</h5>' +
        '</div>' +
        '<span class="bcd-carry-pill is-zero">' + (valA === valB ? 'Result = 0' : 'No Carry (C<sub>end</sub> = 0) &rarr; Negative Result (A < B)') + '</span>' +
        '</div>' +
        '<div class="bcd-comp-math-box">' +
        '<div class="calc-row">' +
        '<span class="calc-tag">Intermediate BCD Sum:</span>' +
        '<code>' + interNibbles.join(" ") + '</code>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-tag">9\'s Complement of Sum:</span>' +
        '<code>' + ninesNines + '₁₀ &minus; ' + interDecStr + '₁₀ = <b>' + negComp9Str + '₁₀</b></code>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-tag">Attach Negative Sign:</span>' +
        '<code class="highlight-val">&minus; ' + negComp9Str + '₁₀ &rarr; <b>' + finalBcdStr9 + '<sub class="base-sub">BCD</sub></b></code>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    // Results HTML
    var resultsHtml =
      '<div class="bcd-results-wrap">' +
      '<div class="bcd-result-tile">' +
      '<span class="bcd-result-label">Final BCD Result (9\'s Comp)</span>' +
      '<span class="bcd-result-val ' + (valA >= valB ? '' : 'is-neg') + '">' + finalBcdStr9 + '<sub class="base-sub">BCD</sub></span>' +
      '</div>' +
      '<div class="bcd-result-tile">' +
      '<span class="bcd-result-label">Final Decimal Result (9\'s Comp)</span>' +
      '<span class="bcd-result-val ' + (valA >= valB ? '' : 'is-neg') + '">' + finalDec9 + '<sub class="base-sub">10</sub></span>' +
      '</div>' +
      '</div>';

    return (
      '<div class="bcd-sub-section" id="bcd-sub-9s-section">' +
      '<div class="bcd-sub-section-head">' +
      '<span class="bcd-card-badge bcd-badge-sub9">Method 1</span>' +
      '<h4 class="bcd-sub-section-title">BCD Subtraction — Using 9\'s Complement</h4>' +
      '</div>' +
      step1Html +
      step2Html +
      step3Html +
      resultsHtml +
      '</div>'
    );
  }

  // Method 2: BCD Subtraction Using 10's Complement
  function renderBCDSub10sMethodHtml(aStr, bStr, padLen) {
    var paddedA = aStr.padStart(padLen, "0");
    var paddedB = bStr.padStart(padLen, "0");

    var valA = BigInt(aStr);
    var valB = BigInt(bStr);

    var digitsA = paddedA.split("").map(Number).reverse();
    var digitsB = paddedB.split("").map(Number).reverse();

    var aData = numberStringToBCD(paddedA);
    var ninesNines = "9".repeat(padLen);

    // Step 1: 10's complement of B (9's comp + 1)
    var comp9Digits = digitsB.map(function (d) { return 9 - d; });
    var comp9Str = comp9Digits.slice().reverse().join("");

    var comp10Add = computeBCDAddition(comp9Digits, [1], false);
    var comp10Digits = comp10Add.finalDigits.slice(0, padLen);
    var comp10Str = comp10Digits.slice().reverse().join("");
    var comp10Data = numberStringToBCD(comp10Str);

    // Step 2: Multi-digit BCD Addition of A + 10's complement of B
    var addResult10 = computeBCDAddition(digitsA, comp10Digits, false);
    var hasEndCarry = addResult10.finalCarry === 1;
    var interNibbles = addResult10.sumDigits.slice().reverse().map(digitToBCD);
    var interDecStr = addResult10.sumDigits.slice().reverse().join("");

    // Step 1 HTML (Calculate 10's Complement of Subtrahend B)
    var step1Html =
      '<div class="bcd-sub-step-card">' +
      '<div class="bcd-sub-step-header">' +
      '<div class="bcd-sub-step-title-wrap">' +
      '<span class="bcd-step-pill">Step 1</span>' +
      '<h5 class="bcd-sub-step-title">Calculate 10\'s Complement of Subtrahend B</h5>' +
      '</div>' +
      '</div>' +
      '<div class="bcd-deriv-box">' +
      '<div class="bcd-deriv-step">Step 1.1: Compute 9\'s complement: <code>' + ninesNines + '₁₀ &minus; ' + paddedB + '₁₀ = <b>' + comp9Str + '₁₀</b></code></div>' +
      '<div class="bcd-deriv-step">Step 1.2: Add 1 for 10\'s complement: <code>' + comp9Str + '₁₀ + 1 = <b>' + comp10Str + '₁₀</b></code></div>' +
      '<div class="bcd-deriv-step">10\'s Complement of B in BCD: <code><b>' + comp10Data.formatted + '</b><sub class="base-sub">BCD</sub></code></div>' +
      '</div>' +
      '</div>';

    // Step 2 HTML (Add Minuend A + 10's Complement of B)
    var step2Html = renderComplementBCDAdditionStepHtml(aData.nibbles, comp10Data.nibbles, addResult10, "+ 10's Comp of B", "10s");

    // Step 3 HTML & Final Results
    var step3Html = '';
    var finalDec10 = '';
    var finalBcdStr10 = '';

    if (hasEndCarry) {
      var cleanDiff10 = (valA - valB).toString(10);
      finalDec10 = "+" + cleanDiff10;
      finalBcdStr10 = "+" + numberStringToBCD(cleanDiff10.padStart(padLen, "0")).formatted;
      var finalBcdNibbles = numberStringToBCD(cleanDiff10.padStart(padLen, "0")).nibbles;

      step3Html =
        '<div class="bcd-sub-step-card">' +
        '<div class="bcd-sub-step-header">' +
        '<div class="bcd-sub-step-title-wrap">' +
        '<span class="bcd-step-pill">Step 3</span>' +
        '<h5 class="bcd-sub-step-title">Handle Final Carry (End Carry = 1)</h5>' +
        '</div>' +
        '<span class="bcd-carry-pill is-one">Final Carry = 1 &rarr; Discard Carry (Positive Result)</span>' +
        '</div>' +
        '<div class="bcd-comp-math-box">' +
        '<div class="bcd-stack-row">' +
        '<span class="bcd-stack-label">Sum with End Carry:</span>' +
        '<span class="bcd-stack-val"><span class="bcd-carry-msb">1</span>&nbsp; ' + interNibbles.join("&nbsp; ") + '</span>' +
        '</div>' +
        '<div class="bcd-stack-row">' +
        '<span class="bcd-stack-label">Discard End Carry:</span>' +
        '<span class="bcd-stack-val"><span class="discard-carry">1</span>&nbsp; ' + interNibbles.join("&nbsp; ") + '</span>' +
        '</div>' +
        '<div class="bcd-stack-divider"></div>' +
        '<div class="bcd-stack-row bcd-row-final">' +
        '<span class="bcd-stack-label">Final BCD Difference:</span>' +
        '<span class="bcd-stack-val">' + finalBcdNibbles.join("&nbsp; ") + '</span>' +
        '</div>' +
        '</div>' +
        '</div>';
    } else {
      if (valA === valB) {
        finalDec10 = "+0";
        finalBcdStr10 = "+" + "0000 ".repeat(padLen).trim();
      } else {
        var cleanDiffNeg10 = (valB - valA).toString(10);
        finalDec10 = "−" + cleanDiffNeg10;
        finalBcdStr10 = "−" + numberStringToBCD(cleanDiffNeg10.padStart(padLen, "0")).formatted;
      }

      var negComp10Add = computeBCDAddition(addResult10.sumDigits.map(function (d) { return 9 - d; }), [1], false);
      var negComp10Digits = negComp10Add.finalDigits.slice(0, padLen);
      var negComp10Str = negComp10Digits.slice().reverse().join("");
      var negComp9Digits = addResult10.sumDigits.map(function (d) { return 9 - d; });
      var negComp9Str = negComp9Digits.slice().reverse().join("");

      step3Html =
        '<div class="bcd-sub-step-card">' +
        '<div class="bcd-sub-step-header">' +
        '<div class="bcd-sub-step-title-wrap">' +
        '<span class="bcd-step-pill">Step 3</span>' +
        '<h5 class="bcd-sub-step-title">' + (valA === valB ? 'Evaluate Result (A = B)' : 'Evaluate Final Carry (End Carry = 0)') + '</h5>' +
        '</div>' +
        '<span class="bcd-carry-pill is-zero">' + (valA === valB ? 'Result = 0' : 'No Carry (Carry = 0) &rarr; Negative Result (A < B)') + '</span>' +
        '</div>' +
        '<div class="bcd-comp-math-box">' +
        '<div class="calc-row">' +
        '<span class="calc-tag">Intermediate BCD Sum:</span>' +
        '<code>' + interNibbles.join(" ") + '</code>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-tag">Step 3.1: 9\'s Comp of Sum:</span>' +
        '<code>' + ninesNines + '₁₀ &minus; ' + interDecStr + '₁₀ = <b>' + negComp9Str + '₁₀</b></code>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-tag">Step 3.2: Add 1 for 10\'s Comp:</span>' +
        '<code>' + negComp9Str + '₁₀ + 1 = <b>' + negComp10Str + '₁₀</b></code>' +
        '</div>' +
        '<div class="calc-row">' +
        '<span class="calc-tag">Attach Negative Sign:</span>' +
        '<code class="highlight-val">&minus; ' + negComp10Str + '₁₀ &rarr; <b>' + finalBcdStr10 + '<sub class="base-sub">BCD</sub></b></code>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    // Results HTML
    var resultsHtml =
      '<div class="bcd-results-wrap">' +
      '<div class="bcd-result-tile">' +
      '<span class="bcd-result-label">Final BCD Result (10\'s Comp)</span>' +
      '<span class="bcd-result-val ' + (valA >= valB ? '' : 'is-neg') + '">' + finalBcdStr10 + '<sub class="base-sub">BCD</sub></span>' +
      '</div>' +
      '<div class="bcd-result-tile">' +
      '<span class="bcd-result-label">Final Decimal Result (10\'s Comp)</span>' +
      '<span class="bcd-result-val ' + (valA >= valB ? '' : 'is-neg') + '">' + finalDec10 + '<sub class="base-sub">10</sub></span>' +
      '</div>' +
      '</div>';

    return (
      '<div class="bcd-sub-section" id="bcd-sub-10s-section">' +
      '<div class="bcd-sub-section-head">' +
      '<span class="bcd-card-badge bcd-badge-sub10">Method 2</span>' +
      '<h4 class="bcd-sub-section-title">BCD Subtraction — Using 10\'s Complement</h4>' +
      '</div>' +
      step1Html +
      step2Html +
      step3Html +
      resultsHtml +
      '</div>'
    );
  }

  // Renders BCD Subtraction (9's Complement & 10's Complement)
  function renderBCDSubtractionBoxHtml(aStr, bStr, padLen) {
    return (
      '<div class="bcd-box-head">' +
      '<span class="bcd-box-badge bcd-badge-sub">BCD Subtraction</span>' +
      '<h3 class="bcd-box-title">BCD Subtraction (A &minus; B)</h3>' +
      '</div>' +
      '<div class="bcd-sub-methods-grid">' +
      renderBCDSub9sMethodHtml(aStr, bStr, padLen) +
      renderBCDSub10sMethodHtml(aStr, bStr, padLen) +
      '</div>'
    );
  }

  // Master recomputation function for BCD Arithmetic
  function recomputeBCDOperations(isExplicitSubmit) {
    if (!bcdAInput || !bcdBInput) return;

    var rawA = bcdAInput.value.trim();
    var rawB = bcdBInput.value.trim();
    bcdState.a = rawA;
    bcdState.b = rawB;

    if (rawA === "" && rawB === "" && !isExplicitSubmit) {
      if (bcdAError) bcdAError.textContent = "";
      if (bcdBError) bcdBError.textContent = "";
      if (bcdAInput) bcdAInput.classList.remove("is-invalid");
      if (bcdBInput) bcdBInput.classList.remove("is-invalid");
      if (bcdConversionBox) bcdConversionBox.innerHTML = '<div class="bcd-empty-msg">Enter decimal numbers for A and B to view BCD conversions and calculations.</div>';
      if (bcdAdditionBox) bcdAdditionBox.innerHTML = '';
      if (bcdSubtractionBox) bcdSubtractionBox.innerHTML = '';
      return;
    }

    var aHasErr = false;
    var bHasErr = false;

    if (rawA === "") {
      if (bcdAError) bcdAError.textContent = "Please enter Number A.";
      bcdAInput.classList.add("is-invalid");
      aHasErr = true;
    } else if (!/^\d+$/.test(rawA)) {
      if (bcdAError) bcdAError.textContent = "Only non-negative whole decimal digits (0–9) are allowed.";
      bcdAInput.classList.add("is-invalid");
      aHasErr = true;
    } else {
      if (bcdAError) bcdAError.textContent = "";
      bcdAInput.classList.remove("is-invalid");
    }

    if (rawB === "") {
      if (bcdBError) bcdBError.textContent = "Please enter Number B.";
      bcdBInput.classList.add("is-invalid");
      bHasErr = true;
    } else if (!/^\d+$/.test(rawB)) {
      if (bcdBError) bcdBError.textContent = "Only non-negative whole decimal digits (0–9) are allowed.";
      bcdBInput.classList.add("is-invalid");
      bHasErr = true;
    } else {
      if (bcdBError) bcdBError.textContent = "";
      bcdBInput.classList.remove("is-invalid");
    }

    if (aHasErr || bHasErr) {
      if (bcdConversionBox) bcdConversionBox.innerHTML = '<div class="bcd-empty-msg">Please enter valid decimal numbers for A and B.</div>';
      if (bcdAdditionBox) bcdAdditionBox.innerHTML = '';
      if (bcdSubtractionBox) bcdSubtractionBox.innerHTML = '';
      return;
    }

    var cleanA = rawA.replace(/^0+(?=\d)/, "") || "0";
    var cleanB = rawB.replace(/^0+(?=\d)/, "") || "0";
    var padLen = Math.max(cleanA.length, cleanB.length);

    if (bcdConversionBox) bcdConversionBox.innerHTML = renderBCDRepresentationsHtml(cleanA, cleanB, padLen);
    if (bcdAdditionBox) bcdAdditionBox.innerHTML = renderBCDAdditionBoxHtml(cleanA, cleanB, padLen);
    if (bcdSubtractionBox) bcdSubtractionBox.innerHTML = renderBCDSubtractionBoxHtml(cleanA, cleanB, padLen);
  }

  function setupBCDEngine() {
    if (bcdCalcBtn) {
      bcdCalcBtn.addEventListener("click", function () {
        recomputeBCDOperations(true);
      });
    }

    if (bcdAInput) {
      bcdAInput.addEventListener("input", function () {
        recomputeBCDOperations();
      });
      bcdAInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") recomputeBCDOperations(true);
      });
    }

    if (bcdBInput) {
      bcdBInput.addEventListener("input", function () {
        recomputeBCDOperations();
      });
      bcdBInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") recomputeBCDOperations(true);
      });
    }

    recomputeBCDOperations();
  }

  setupBCDEngine();
})();
