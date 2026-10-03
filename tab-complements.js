/**
 * tab-complements.js - Tab 2: 1's & 2's Complement Subtraction Engine
 * Handles operand complement breakdowns, columnar binary addition simulation,
 * end-around carry and carry-discard evaluation, and channel sync pills.
 */

(function () {
  "use strict";

  var app = window.NumberApp;
  if (!app) {
    console.error("NumberApp common.js must be loaded before tab-complements.js");
    return;
  }

  var BASE_LABEL = app.BASE_LABEL;
  var BASE_NAME = app.BASE_NAME;
  var BASE_PLACEHOLDER = app.BASE_PLACEHOLDER;
  var indexToVar = app.indexToVar;
  var padIndex = app.padIndex;
  var stringToBigIntBase = app.stringToBigIntBase;
  var bigIntToBase = app.bigIntToBase;
  var findInvalidChar = app.findInvalidChar;

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
      if (onesCompSteps) onesCompSteps.innerHTML = '<div class="comp-empty-msg">Enter valid values for Minuend M and Subtrahend N, then click "Calculate Subtraction".</div>';
      if (twosCompSteps) twosCompSteps.innerHTML = '<div class="comp-empty-msg">Enter valid values for Minuend M and Subtrahend N, then click "Calculate Subtraction".</div>';
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

    if (onesCompSteps) onesCompSteps.innerHTML = renderComplementAnswerHtml("ones", solverData);
    if (twosCompSteps) twosCompSteps.innerHTML = renderComplementAnswerHtml("twos", solverData);
  }

  function renderComplementSyncPills() {
    if (!mSyncPills || !nSyncPills) return;
    mSyncPills.innerHTML = "";
    nSyncPills.innerHTML = "";

    var channels = app.getChannels();
    if (!channels || !channels.length) return;

    channels.forEach(function (st, idx) {
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

    // Subscribe to channel updates from Tab 1
    document.addEventListener("channels:updated", function () {
      renderComplementSyncPills();
    });

    renderComplementSyncPills();
    recomputeComplementSubtraction();
  }

  setupComplementEngine();
})();
