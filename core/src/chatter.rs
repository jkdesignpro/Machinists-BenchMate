//! Chatter finder (parity batch A7): spectrum of a sound recording, the dominant
//! peak that is not a spindle (runout / tooth-passing) harmonic, and the spindle
//! speeds that put a whole number of chatter waves into one tooth period.
//!
//! This is the rule-of-thumb lobe estimate, not a stability lobe diagram: it needs
//! no tool tap test, but it only says where the lobes are, not how deep you can cut.
//!
//! Sources (docs/sources.md, section "Chatter"):
//! * [SMITH10] S. Smith, "Finding harmony in stable cutting", Cutting Tool Engineering,
//!   Dec. 2010: choose a spindle speed whose tooth passing frequency equals the chatter
//!   frequency (n = 60 fc / z for the first lobe); chatter frequency is close to, but
//!   not equal to, a natural frequency; use the running, not the commanded, speed.
//! * [ST92] S. Smith, J. Tlusty, "Stabilizing chatter by automatic spindle speed
//!   regulation", CIRP Annals 41(1), 1992 (speed selection from the measured chatter
//!   frequency, applied repeatedly; pages to be verified).
//! * [ALT] Y. Altintas, Manufacturing Automation, 2nd ed. 2012, Ch. 3 (regenerative
//!   chatter, stability lobes: lobe k spindle speeds below fc 60 / (z k)).
//! * [CT65] J. W. Cooley, J. W. Tukey, "An algorithm for the machine calculation of
//!   complex Fourier series", Math. Comp. 19 (1965) 297-301 (radix-2 FFT);
//!   [NR] Press et al., Numerical Recipes 2nd ed., 12.2 and 13.4 (FFT, Hann window).

use std::f64::consts::PI;

/// Tooth passing frequency (Hz): n z / 60.
pub fn tooth_pass_hz(rpm: f64, z: f64) -> f64 { rpm * z / 60.0 }

/// Spindle speed (rpm) for lobe `n_lobe` (0, 1, 2, ...), where N + 1 whole chatter
/// waves fit in one tooth period: n = 60 fc / (z (N + 1)). N = 0 is the highest speed (tooth passing = chatter
/// frequency). [SMITH10][ST92][ALT]
pub fn stable_rpm(fc: f64, z: f64, n_lobe: f64) -> f64 {
    if !(fc > 0.0 && z >= 1.0 && n_lobe >= 0.0) { return f64::NAN; }
    60.0 * fc / (z * (n_lobe.floor() + 1.0))
}

/// Ratio of chatter frequency to tooth passing frequency at the running speed;
/// its whole part is the lobe the cut is in (0 = above the first stable speed).
pub fn chatter_ratio(fc: f64, rpm: f64, z: f64) -> f64 { fc / tooth_pass_hz(rpm, z) }

/// In-place radix-2 FFT (Cooley-Tukey, decimation in time). Length must be a power of two.
pub fn fft(re: &mut [f64], im: &mut [f64]) {
    let n = re.len();
    assert!(n.is_power_of_two() && im.len() == n);
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 { j ^= bit; bit >>= 1; }
        j |= bit;
        if i < j { re.swap(i, j); im.swap(i, j); }
    }
    let mut len = 2;
    while len <= n {
        let ang = -2.0 * PI / len as f64;
        let (wr, wi) = (ang.cos(), ang.sin());
        for start in (0..n).step_by(len) {
            let (mut cr, mut ci) = (1.0, 0.0);
            for k in 0..len / 2 {
                let (a, b) = (start + k, start + k + len / 2);
                let tr = re[b] * cr - im[b] * ci;
                let ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr; im[b] = im[a] - ti;
                re[a] += tr; im[a] += ti;
                let nc = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nc;
            }
        }
        len <<= 1;
    }
}

/// Largest power of two not above n.
pub fn pow2_floor(n: usize) -> usize { if n == 0 { 0 } else { 1 << (usize::BITS - 1 - n.leading_zeros()) } }

/// Single-sided amplitude spectrum of real samples with a Hann window: the first
/// power-of-two count of samples is used; the mean is removed; bin k is at
/// k fs / n Hz; a pure sine of amplitude A reads A at its bin (window gain corrected).
pub fn amplitude_spectrum(x: &[f64]) -> Vec<f64> {
    let n = pow2_floor(x.len());
    if n < 4 { return vec![]; }
    let mean = x[..n].iter().sum::<f64>() / n as f64;
    let w: Vec<f64> = (0..n).map(|i| 0.5 - 0.5 * (2.0 * PI * i as f64 / n as f64).cos()).collect();
    let gain: f64 = w.iter().sum::<f64>();
    let mut re: Vec<f64> = (0..n).map(|i| (x[i] - mean) * w[i]).collect();
    let mut im = vec![0.0; n];
    fft(&mut re, &mut im);
    (0..n / 2).map(|k| 2.0 * (re[k] * re[k] + im[k] * im[k]).sqrt() / gain).collect()
}

/// Hann window main-lobe half width in bins: a single tone spreads over +-2 bins.
pub const HANN_MAIN_LOBE_BINS: f64 = 2.0;
/// Peaks more than this far (dB) below the largest peak in range are not listed.
pub const PEAK_FLOOR_DB: f64 = 40.0;
/// Margin (dB) above the Hann side-lobe envelope that a nearby weaker peak needs
/// to count as a tone of its own (covers leakage raised by drift and averaging).
pub const SIDELOBE_MARGIN_DB: f64 = 15.0;

/// Hann window side-lobe level (dB, below the main peak) at `d` bins from it:
/// the first side lobe is -31.5 dB at about 2.5 bins and the lobes then fall at
/// 18 dB per octave (1/d^3). [HARRIS] F. J. Harris, Proc. IEEE 66(1), 1978.
pub fn hann_sidelobe_db(d: f64) -> f64 { -31.5 - 60.0 * (d.max(2.5) / 2.5).log10() }

/// Real peaks of a Hann-windowed amplitude spectrum `mag` (bin spacing `df` Hz)
/// between fmin and fmax, at most `k`, largest first, as (frequency Hz, amplitude).
///
/// * Only local maxima are candidates; each is refined by a parabola through the log
///   magnitudes of the peak bin and its neighbours (frequency to a small part of a bin,
///   amplitude within a few per cent).
/// * Going from the largest down, a candidate is dropped when it lies inside the main
///   lobe (2 bins) of a stronger accepted peak, or when it is not at least
///   `SIDELOBE_MARGIN_DB` above that peak's side-lobe envelope: a single tone then
///   gives a single peak, not a comb of side lobes.
/// * Candidates more than `PEAK_FLOOR_DB` below the largest peak in range are dropped.
pub fn spectrum_peaks(mag: &[f64], df: f64, fmin: f64, fmax: f64, k: usize) -> Vec<(f64, f64)> {
    if k == 0 { return vec![]; }
    let l = |v: f64| v.max(1e-300).ln();
    // (bin position, amplitude)
    let mut cand: Vec<(f64, f64)> = vec![];
    for i in 1..mag.len().saturating_sub(1) {
        if mag[i] > mag[i - 1] && mag[i] >= mag[i + 1] && mag[i] > 0.0 {
            let (a, b, c) = (l(mag[i - 1]), l(mag[i]), l(mag[i + 1]));
            let den = a - 2.0 * b + c;
            let d = if den.abs() > 1e-300 { (0.5 * (a - c) / den).clamp(-0.5, 0.5) } else { 0.0 };
            cand.push((i as f64 + d, (b - 0.25 * (a - c) * d).exp()));
        }
    }
    cand.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap_or(std::cmp::Ordering::Equal));
    let in_range = |p: f64| { let f = p * df; f >= fmin && f <= fmax };
    let top = cand.iter().find(|c| in_range(c.0)).map(|c| c.1).unwrap_or(0.0);
    let floor = top * 10f64.powf(-PEAK_FLOOR_DB / 20.0);
    // Accepted peaks, in and out of range (a strong tone just outside still hides its side lobes).
    let mut acc: Vec<(f64, f64)> = vec![];
    let mut out = vec![];
    for (p, a) in cand {
        if a < floor { break; }
        let hidden = acc.iter().any(|&(q, b)| {
            let d = (p - q).abs();
            d <= HANN_MAIN_LOBE_BINS || a <= b * 10f64.powf((hann_sidelobe_db(d) + SIDELOBE_MARGIN_DB) / 20.0)
        });
        if hidden { continue; }
        acc.push((p, a));
        if in_range(p) { out.push((p * df, a)); if out.len() >= k { break; } }
    }
    out
}

/// Order of the spindle harmonic `f` is near (f = order x base within `tol` Hz), or 0.
pub fn harmonic_order(f: f64, base: f64, tol: f64) -> f64 {
    if !(base > 0.0) { return 0.0; }
    let m = (f / base).round();
    if m >= 1.0 && (f - m * base).abs() <= tol { m } else { 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn close(a: f64, b: f64, tol: f64) -> bool { (a - b).abs() <= tol }

    #[test]
    fn smith_example() {
        // [SMITH10]: chatter at 427 Hz with a 2-tooth cutter -> 427 x 60 / 2 = 12 810 rpm.
        assert!(close(stable_rpm(427.0, 2.0, 0.0), 12810.0, 1e-9));
        // The same article: 15 000 rpm, 2 teeth -> 500 teeth per second.
        assert!(close(tooth_pass_hz(15000.0, 2.0), 500.0, 1e-12));
        // Lower lobes: half, a third ...
        assert!(close(stable_rpm(427.0, 2.0, 1.0), 6405.0, 1e-9));
        assert!(close(stable_rpm(427.0, 2.0, 2.0), 4270.0, 1e-9));
        // Lathe (one regeneration per rev): 120 Hz chatter -> 7200, 3600, 2400 rpm
        assert!(close(stable_rpm(120.0, 1.0, 2.0), 2400.0, 1e-9));
        assert!(close(chatter_ratio(427.0, 15000.0, 2.0), 0.854, 1e-12));
    }

    #[test]
    fn fft_matches_dft() {
        let n = 64;
        let x: Vec<f64> = (0..n).map(|i| ((i * 37 % 11) as f64 - 5.0) * 0.3 + (i as f64 * 0.7).sin()).collect();
        let (mut re, mut im) = (x.clone(), vec![0.0; n]);
        fft(&mut re, &mut im);
        for k in 0..n {
            let (mut sr, mut si) = (0.0, 0.0);
            for (t, v) in x.iter().enumerate() { let a = -2.0 * PI * (k * t) as f64 / n as f64; sr += v * a.cos(); si += v * a.sin(); }
            assert!(close(re[k], sr, 1e-9) && close(im[k], si, 1e-9), "bin {k}");
        }
        // Parseval
        let e1: f64 = x.iter().map(|v| v * v).sum();
        let e2: f64 = re.iter().zip(&im).map(|(a, b)| a * a + b * b).sum::<f64>() / n as f64;
        assert!(close(e1, e2, 1e-9));
    }

    #[test]
    fn finds_tone_and_skips_harmonics() {
        // 48 kHz, 16384 samples: tooth passing of 6000 rpm x 4 teeth = 400 Hz and
        // its harmonics, plus a 1234.5 Hz chatter tone that is not a harmonic.
        let fs = 48000.0; let n = 16384;
        let x: Vec<f64> = (0..n).map(|i| { let t = i as f64 / fs;
            0.8 * (2.0 * PI * 400.0 * t).sin() + 0.5 * (2.0 * PI * 800.0 * t).sin() + 0.3 * (2.0 * PI * 1234.5 * t + 0.3).sin() }).collect();
        let m = amplitude_spectrum(&x);
        assert_eq!(m.len(), n / 2);
        let df = fs / n as f64;
        let pk = spectrum_peaks(&m, df, 50.0, 5000.0, 5);
        assert_eq!(pk.len(), 3, "only the three tones, no side lobes: {pk:?}");
        assert!(close(pk[0].0, 400.0, 0.3));
        assert!(close(pk[0].1, 0.8, 0.04)); // window gain corrected amplitude (400 Hz sits half-way between bins)
        let base = 6000.0 / 60.0;
        let chat: Vec<_> = pk.iter().filter(|p| harmonic_order(p.0, base, 2.0) == 0.0).collect();
        assert!(close(chat[0].0, 1234.5, 0.3), "{:?}", pk);
        assert!(close(chat[0].1, 0.3, 0.015));
        assert_eq!(harmonic_order(800.2, base, 2.0), 8.0);
    }

    /// Deterministic noise in -1..1 (LCG), so the tests do not depend on a crate.
    fn noise(n: usize, seed: u64) -> Vec<f64> {
        let mut s = seed;
        (0..n).map(|_| { s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); ((s >> 11) as f64 / (1u64 << 53) as f64) * 2.0 - 1.0 }).collect()
    }
    fn tones(fs: f64, n: usize, t: &[(f64, f64)], noise_amp: f64, seed: u64) -> Vec<f64> {
        let w = noise(n, seed);
        (0..n).map(|i| { let tt = i as f64 / fs; t.iter().map(|&(f, a)| a * (2.0 * PI * f * tt + 0.7).sin()).sum::<f64>() + noise_amp * w[i] }).collect()
    }
    /// Averaged spectrum of `frames` consecutive frames, as the microphone screen does.
    fn avg_spectrum(x: &[f64], n: usize, frames: usize) -> Vec<f64> {
        let mut avg = vec![0.0; n / 2];
        for f in 0..frames { let m = amplitude_spectrum(&x[f * n / 2..f * n / 2 + n]); for (a, v) in avg.iter_mut().zip(&m) { *a += v / frames as f64; } }
        avg
    }

    #[test]
    fn single_tone_gives_one_peak() {
        // The desktop report: one 1234 Hz tone listed with its side lobes (1226, 1219 Hz ...).
        for &fs in &[44100.0, 48000.0] {
            for &f0 in &[1234.0, 1234.5, 1236.7, 440.0, 3001.3] {
                let n = 16384;
                let x = tones(fs, n * 5, &[(f0, 0.5)], 1e-4, 7);
                let m = avg_spectrum(&x, n, 9);
                let df = fs / n as f64;
                let pk = spectrum_peaks(&m, df, 50.0, 5000.0, 6);
                assert_eq!(pk.len(), 1, "fs {fs} f0 {f0}: {pk:?}");
                assert!(close(pk[0].0, f0, 0.1 * df), "fs {fs} f0 {f0}: {pk:?}");
                assert!(close(pk[0].1, 0.5, 0.02), "{pk:?}");
            }
        }
    }

    #[test]
    fn drifting_tone_gives_one_peak() {
        // Tone wandering by +-1 Hz between frames (a real spindle): wider leakage, still one peak.
        let (fs, n) = (44100.0, 16384);
        let df = fs / n as f64;
        let mut avg = vec![0.0; n / 2];
        for fr in 0..9 {
            let f0 = 1234.0 + ((fr as f64) * 1.3).sin();
            let m = amplitude_spectrum(&tones(fs, n, &[(f0, 0.5)], 1e-3, fr as u64 + 1));
            for (a, v) in avg.iter_mut().zip(&m) { *a += v / 9.0; }
        }
        let pk = spectrum_peaks(&avg, df, 50.0, 5000.0, 6);
        assert_eq!(pk.len(), 1, "{pk:?}");
        assert!(close(pk[0].0, 1234.0, 1.5), "{pk:?}");
    }

    #[test]
    fn two_tones_give_two_peaks() {
        let (fs, n) = (48000.0, 16384);
        let df = fs / n as f64;
        // Far apart, 20 dB difference.
        let m = avg_spectrum(&tones(fs, n * 5, &[(1234.0, 1.0), (2817.3, 0.1)], 1e-4, 3), n, 9);
        let pk = spectrum_peaks(&m, df, 50.0, 5000.0, 6);
        assert_eq!(pk.len(), 2, "{pk:?}");
        assert!(close(pk[0].0, 1234.0, 0.3) && close(pk[1].0, 2817.3, 0.3), "{pk:?}");
        assert!(close(pk[1].1, 0.1, 0.005), "{pk:?}");
        // Close together: 1234 Hz and 1262 Hz (about 9.6 bins apart), 10 dB down.
        let m = avg_spectrum(&tones(fs, n * 5, &[(1234.0, 1.0), (1262.0, 0.316)], 1e-4, 4), n, 9);
        let pk = spectrum_peaks(&m, df, 50.0, 5000.0, 6);
        assert_eq!(pk.len(), 2, "{pk:?}");
        assert!(close(pk[0].0, 1234.0, 0.3) && close(pk[1].0, 1262.0, 0.3), "{pk:?}");
        // Out of range tone does not appear, and its side lobes do not leak in.
        let pk = spectrum_peaks(&m, df, 1250.0, 5000.0, 6);
        assert_eq!(pk.len(), 1, "{pk:?}");
        assert!(close(pk[0].0, 1262.0, 0.3), "{pk:?}");
        // k = 0 lists nothing.
        assert!(spectrum_peaks(&m, df, 50.0, 5000.0, 0).is_empty());
    }

    #[test]
    fn sidelobe_envelope() {
        assert!(close(hann_sidelobe_db(2.5), -31.5, 1e-12));
        assert!(close(hann_sidelobe_db(5.0), -31.5 - 18.06, 0.01)); // 18 dB per octave
        // Exact Hann side lobe heights stay under the envelope used for suppression.
        let n = 4096; let k0 = 300.0;
        let x: Vec<f64> = (0..n).map(|i| (2.0 * PI * k0 * i as f64 / n as f64).sin()).collect();
        let m = amplitude_spectrum(&x);
        // An on-bin tone has nulls elsewhere; use an off-bin tone to see the lobes.
        let x2: Vec<f64> = (0..n).map(|i| (2.0 * PI * (k0 + 0.5) * i as f64 / n as f64).sin()).collect();
        let m2 = amplitude_spectrum(&x2);
        let top = m2.iter().cloned().fold(0.0, f64::max);
        for d in 3..40usize {
            let v = m2[300 + d].max(m2[301 - d]);
            assert!(20.0 * (v / top).log10() <= hann_sidelobe_db(d as f64 - 0.5) + 1.0, "d {d}");
        }
        assert!(close(m[300], 1.0, 1e-9));
    }

    #[test]
    fn pow2() {
        assert_eq!(pow2_floor(16384), 16384);
        assert_eq!(pow2_floor(20000), 16384);
        assert_eq!(pow2_floor(1), 1);
        assert!(amplitude_spectrum(&[1.0, 2.0]).is_empty());
    }
}
