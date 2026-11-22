'use strict';

// Compara versiones tipo semver ("2.0.10" > "2.0.9"); un sufijo -beta cuenta como menor.
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = String(v || '').replace(/^v/i, '').split('-', 2);
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre };
  };
  const va = parse(a);
  const vb = parse(b);
  for (let i = 0; i < Math.max(va.nums.length, vb.nums.length); i += 1) {
    const diff = (va.nums[i] || 0) - (vb.nums[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  if (va.pre === vb.pre) return 0;
  if (!va.pre) return 1;
  if (!vb.pre) return -1;
  return va.pre.localeCompare(vb.pre, undefined, { numeric: true }) > 0 ? 1 : -1;
}

module.exports = { compareVersions };
