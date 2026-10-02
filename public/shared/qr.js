'use strict';

// Generatore di QR code minimale (modalità byte, correzione d'errore M, versioni 1–40).
// Segue lo standard ISO/IEC 18004; struttura ispirata al generatore di Project Nayuki.
// Uso: QR.toSvg('https://esempio') -> stringa <svg>.

(function (global) {
  const ECC_CODEWORDS_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const NUM_ERROR_CORRECTION_BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const FORMAT_BITS_M = 0; // L=1, M=0, Q=3, H=2

  function getBit(x, i) {
    return ((x >>> i) & 1) !== 0;
  }

  function numRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function numDataCodewords(ver) {
    return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK_M[ver] * NUM_ERROR_CORRECTION_BLOCKS_M[ver];
  }

  // Aritmetica su GF(2^8) con polinomio 0x11D.
  function gfMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < result.length; j++) {
        result[j] = gfMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMultiply(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => {
        result[i] ^= gfMultiply(coef, factor);
      });
    }
    return result;
  }

  function utf8Bytes(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function encodeData(bytes) {
    for (let ver = 1; ver <= 40; ver++) {
      const capacityBits = numDataCodewords(ver) * 8;
      const countBits = ver <= 9 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 > capacityBits) continue;

      const bits = [];
      const append = (val, len) => {
        for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
      };
      append(0x4, 4); // modalità byte
      append(bytes.length, countBits);
      bytes.forEach((b) => append(b, 8));
      append(0, Math.min(4, capacityBits - bits.length));
      append(0, (8 - (bits.length % 8)) % 8);
      for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) append(pad, 8);

      const codewords = [];
      for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
        codewords.push(byte);
      }
      return { ver, codewords };
    }
    throw new Error('Testo troppo lungo per un QR code');
  }

  function addEccAndInterleave(data, ver) {
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS_M[ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK_M[ver];
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(blockEccLen);

    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0);
      blocks.push(dat.concat(ecc));
    }

    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
      });
    }
    return result;
  }

  function alignmentPositions(ver, size) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  function buildMatrix(ver, allCodewords) {
    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFunction = (x, y, dark) => {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    };

    // Pattern di temporizzazione.
    for (let i = 0; i < size; i++) {
      setFunction(6, i, i % 2 === 0);
      setFunction(i, 6, i % 2 === 0);
    }

    // Pattern di localizzazione (con separatori).
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, dist !== 2 && dist !== 4);
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);

    // Pattern di allineamento.
    const align = alignmentPositions(ver, size);
    const n = align.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            setFunction(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }

    const drawFormatBits = (mask) => {
      const data = (FORMAT_BITS_M << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;

      for (let i = 0; i <= 5; i++) setFunction(8, i, getBit(bits, i));
      setFunction(8, 7, getBit(bits, 6));
      setFunction(8, 8, getBit(bits, 7));
      setFunction(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++) setFunction(14 - i, 8, getBit(bits, i));

      for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, getBit(bits, i));
      setFunction(8, size - 8, true); // modulo scuro fisso
    };

    // Riserva le aree del formato (verranno riscritte con la maschera scelta).
    drawFormatBits(0);

    // Informazioni di versione (dalla 7 in su).
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = getBit(bits, i);
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunction(a, b, bit);
        setFunction(b, a, bit);
      }
    }

    // Posizionamento dei dati a zig-zag.
    let bitIndex = 0;
    const totalBits = allCodewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIndex < totalBits) {
            modules[y][x] = getBit(allCodewords[bitIndex >>> 3], 7 - (bitIndex & 7));
            bitIndex++;
          }
        }
      }
    }

    const applyMask = (mask) => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (isFunction[y][x]) continue;
          let invert;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          }
          if (invert) modules[y][x] = !modules[y][x];
        }
      }
    };

    const penalty = () => {
      let result = 0;
      const addHistory = (run, history) => {
        if (history[0] === 0) run += size;
        history.pop();
        history.unshift(run);
      };
      const countFinder = (h) => {
        const k = h[1];
        const core = k > 0 && h[2] === k && h[3] === k * 3 && h[4] === k && h[5] === k;
        return (core && h[0] >= k * 4 && h[6] >= k ? 1 : 0) + (core && h[6] >= k * 4 && h[0] >= k ? 1 : 0);
      };
      const terminate = (color, run, history) => {
        if (color) {
          addHistory(run, history);
          run = 0;
        }
        run += size;
        addHistory(run, history);
        return countFinder(history);
      };
      const scanLine = (get) => {
        let color = false;
        let run = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < size; i++) {
          if (get(i) === color) {
            run++;
            if (run === 5) result += 3;
            else if (run > 5) result++;
          } else {
            addHistory(run, history);
            if (!color) result += countFinder(history) * 40;
            color = get(i);
            run = 1;
          }
        }
        result += terminate(color, run, history) * 40;
      };
      for (let y = 0; y < size; y++) scanLine((x) => modules[y][x]);
      for (let x = 0; x < size; x++) scanLine((y) => modules[y][x]);

      let dark = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (modules[y][x]) dark++;
          if (
            y < size - 1 &&
            x < size - 1 &&
            modules[y][x] === modules[y][x + 1] &&
            modules[y][x] === modules[y + 1][x] &&
            modules[y][x] === modules[y + 1][x + 1]
          ) {
            result += 3;
          }
        }
      }
      const total = size * size;
      result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return result;
    };

    let bestMask = 0;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask);
      drawFormatBits(mask);
      const score = penalty();
      if (score < bestScore) {
        bestScore = score;
        bestMask = mask;
      }
      applyMask(mask); // XOR: annulla la maschera
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);
    return modules;
  }

  function encode(text) {
    const { ver, codewords } = encodeData(utf8Bytes(text));
    return buildMatrix(ver, addEccAndInterleave(codewords, ver));
  }

  function toSvg(text, { border = 4, dark = '#000', light = '#fff' } = {}) {
    const modules = encode(text);
    const size = modules.length;
    const dim = size + border * 2;
    let d = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) d += `M${x + border},${y + border}h1v1h-1z`;
      }
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
      `<rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`
    );
  }

  const api = { encode, toSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.QR = api;
})(typeof window !== 'undefined' ? window : globalThis);
