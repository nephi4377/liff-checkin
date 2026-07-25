/**
 * 短影音 S1：9:16 淡入淡出＋Ken Burns＋BGM → MP4（ffmpeg.wasm CDN）／降級 WebM
 */
(function (global) {
  'use strict';

  var CFG = (global.FB_POST_STUDIO_CONFIG && global.FB_POST_STUDIO_CONFIG.REEL) || {};
  var W = CFG.WIDTH || 720;
  var H = CFG.HEIGHT || 1280;
  var FPS = CFG.FPS || 24;
  var MAX_TOTAL = CFG.MAX_TOTAL_SEC || 28;

  var ffmpegLoadPromise = null;
  var ffmpegInstance = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-fb-reel="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-fb-reel', src);
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('腳本載入失敗：' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureFfmpeg() {
    if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
    if (ffmpegLoadPromise) return ffmpegLoadPromise;
    var jsUrl = CFG.FFMPEG_JS || 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
    var utilUrl = CFG.FFMPEG_UTIL || 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js';
    var coreBase = CFG.FFMPEG_CORE_BASE || 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    ffmpegLoadPromise = loadScript(utilUrl).then(function () {
      return loadScript(jsUrl);
    }).then(function () {
      var FFmpegNS = global.FFmpegWASM || global.FFmpeg;
      var UtilNS = global.FFmpegUtil;
      if (!FFmpegNS || !FFmpegNS.FFmpeg) {
        throw new Error('ffmpeg.wasm UMD 未就緒（CDN 可能被擋）');
      }
      var ffmpeg = new FFmpegNS.FFmpeg();
      var toBlobURL = UtilNS && UtilNS.toBlobURL;
      if (!toBlobURL) throw new Error('缺少 @ffmpeg/util');
      return Promise.all([
        toBlobURL(coreBase + '/ffmpeg-core.js', 'text/javascript'),
        toBlobURL(coreBase + '/ffmpeg-core.wasm', 'application/wasm')
      ]).then(function (urls) {
        return ffmpeg.load({ coreURL: urls[0], wasmURL: urls[1] }).then(function () {
          ffmpegInstance = ffmpeg;
          return ffmpeg;
        });
      });
    }).catch(function (e) {
      ffmpegLoadPromise = null;
      throw e;
    });
    return ffmpegLoadPromise;
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('影音素材圖載入失敗')); };
      img.src = url;
    });
  }

  function coverDraw(ctx, img, dx, dy, dw, dh, zoom, panX, panY) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var scale = Math.max(dw / iw, dh / ih) * (zoom || 1);
    var sw = dw / scale;
    var sh = dh / scale;
    var sx = (iw - sw) / 2 + (panX || 0) * iw * 0.08;
    var sy = (ih - sh) / 2 + (panY || 0) * ih * 0.08;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  /**
   * 產生內建程序 BGM（WAV ArrayBuffer）— 柔和氛圍，避免刺耳電子音
   */
  function synthesizeBgm(presetId, durationSec) {
    var sampleRate = 44100;
    var n = Math.max(1, Math.floor(sampleRate * durationSec));
    var ctx = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(2, n, sampleRate);
    var t0 = ctx.currentTime;
    var end = durationSec;

    var master = ctx.createGain();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(0.09, t0 + 1.2);
    master.gain.setValueAtTime(0.09, t0 + Math.max(1.5, end - 1.5));
    master.gain.linearRampToValueAtTime(0, t0 + end);

    var lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = presetId === 'bright' ? 2200 : 1600;
    lowpass.Q.value = 0.6;
    lowpass.connect(master);
    master.connect(ctx.destination);

    function padChord(freqs, start, len, gain) {
      freqs.forEach(function (freq, idx) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = idx === 0 ? 'sine' : 'triangle';
        o.frequency.value = freq;
        var atk = 0.35 + idx * 0.08;
        g.gain.setValueAtTime(0, t0 + start);
        g.gain.linearRampToValueAtTime(gain * (idx === 0 ? 1 : 0.55), t0 + start + atk);
        g.gain.linearRampToValueAtTime(gain * 0.45, t0 + start + len * 0.75);
        g.gain.linearRampToValueAtTime(0, t0 + start + len);
        o.connect(g);
        g.connect(lowpass);
        o.start(t0 + start);
        o.stop(t0 + start + len + 0.05);
      });
    }

    function pluck(freq, start, len, gain) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(gain, t0 + start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + len);
      o.connect(g);
      g.connect(lowpass);
      o.start(t0 + start);
      o.stop(t0 + start + len + 0.05);
    }

    var chords;
    if (presetId === 'warm') {
      chords = [[174.6, 220, 261.6], [196, 246.9, 293.7], [220, 277.2, 329.6], [196, 246.9, 293.7]];
    } else if (presetId === 'bright') {
      chords = [[261.6, 329.6, 392], [293.7, 369.9, 440], [329.6, 415.3, 493.9], [293.7, 369.9, 440]];
    } else if (presetId === 'soft') {
      chords = [[196, 246.9, 293.7], [174.6, 220, 261.6], [220, 277.2, 329.6], [196, 246.9, 293.7]];
    } else {
      // ambient（預設）：慢和弦＋輕琶音
      chords = [[130.8, 164.8, 196], [146.8, 185, 220], [164.8, 207.7, 246.9], [146.8, 185, 220]];
    }

    var bar = presetId === 'bright' ? 2.2 : 3.4;
    var t = 0;
    var ci = 0;
    while (t < end - 0.5) {
      var len = Math.min(bar, end - t);
      padChord(chords[ci % chords.length], t, len, presetId === 'bright' ? 0.22 : 0.18);
      if (presetId === 'ambient' || presetId === 'soft') {
        var chord = chords[ci % chords.length];
        pluck(chord[1] * 2, t + bar * 0.35, 1.6, 0.06);
        pluck(chord[2] * 1.5, t + bar * 0.62, 1.4, 0.05);
      }
      t += bar;
      ci += 1;
    }

    return ctx.startRendering().then(function (buffer) {
      return audioBufferToWav(buffer);
    });
  }

  function audioBufferToWav(buffer) {
    var numCh = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var samples = buffer.length;
    var bytesPerSample = 2;
    var blockAlign = numCh * bytesPerSample;
    var dataSize = samples * blockAlign;
    var ab = new ArrayBuffer(44 + dataSize);
    var view = new DataView(ab);
    function writeStr(offset, str) {
      for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    var offset = 44;
    var ch0 = buffer.getChannelData(0);
    var ch1 = numCh > 1 ? buffer.getChannelData(1) : ch0;
    for (var i = 0; i < samples; i++) {
      var l = Math.max(-1, Math.min(1, ch0[i]));
      var r = Math.max(-1, Math.min(1, ch1[i]));
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      offset += 2;
    }
    return ab;
  }

  function findBgmTrack(presetId) {
    var tracks = (CFG && CFG.BGM_TRACKS) || [];
    var i;
    for (i = 0; i < tracks.length; i++) {
      if (tracks[i].id === presetId) return tracks[i];
    }
    return null;
  }

  function resolveTrackUrl(track) {
    if (!track) return '';
    if (track.path) {
      if (typeof global.location !== 'undefined' && global.location.href) {
        var base = global.location.href.replace(/[#?].*$/, '').replace(/[^/]+$/, '');
        return base + String(track.path).replace(/^\//, '');
      }
      return track.path;
    }
    return track.url || '';
  }

  /**
   * 載入免版權 MP3 → 循環／裁切到影片長度 → WAV
   */
  function loadBgmTrack(trackOrUrl, durationSec, onProgress) {
    var url = typeof trackOrUrl === 'string' ? trackOrUrl : resolveTrackUrl(trackOrUrl);
    if (!url) return Promise.reject(new Error('沒有音樂網址'));
    if (onProgress) onProgress(0, 1, '載入免版權音樂…');
    return fetch(url, { mode: 'cors' }).then(function (res) {
      if (!res.ok) throw new Error('音樂載入失敗 HTTP ' + res.status);
      return res.arrayBuffer();
    }).then(function (ab) {
      var sampleRate = 44100;
      var scratch = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(2, 8, sampleRate);
      return scratch.decodeAudioData(ab.slice(0)).then(function (decoded) {
        var channels = Math.min(2, decoded.numberOfChannels || 1);
        var frames = Math.max(1, Math.ceil(sampleRate * durationSec));
        var ctx = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(channels, frames, sampleRate);
        var master = ctx.createGain();
        master.gain.setValueAtTime(0, 0);
        master.gain.linearRampToValueAtTime(0.85, 1.0);
        master.gain.setValueAtTime(0.85, Math.max(1.1, durationSec - 1.2));
        master.gain.linearRampToValueAtTime(0, durationSec);
        master.connect(ctx.destination);

        var t = 0;
        while (t < durationSec) {
          var src = ctx.createBufferSource();
          src.buffer = decoded;
          src.connect(master);
          src.start(t);
          t += decoded.duration;
        }
        if (onProgress) onProgress(1, 1, '音樂就緒');
        return ctx.startRendering();
      });
    }).then(function (buffer) {
      return audioBufferToWav(buffer);
    });
  }

  function resolveBgmAudio(opts, totalSec, onProgress) {
    var musicOff = !!opts.musicOff || opts.bgmPreset === 'off';
    if (musicOff) return Promise.resolve(null);
    if (opts.audioBlob) {
      return opts.audioBlob.arrayBuffer().then(function (ab) {
        return { ab: ab, blob: opts.audioBlob };
      }).catch(function () {
        return null;
      });
    }

    var preset = opts.bgmPreset || CFG.BGM_DEFAULT || 'track_serene';
    if (preset === 'off') return Promise.resolve(null);

    var track = findBgmTrack(preset);
    if (track && (track.path || track.url)) {
      return loadBgmTrack(track, totalSec + 0.5, onProgress).then(function (ab) {
        return { ab: ab, blob: blobFromArrayBuffer(ab, 'audio/wav') };
      }).catch(function (err) {
        if (onProgress) {
          onProgress(0, 1, '曲庫檔案未找到，改走 AI 氛圍作曲：' + (err && err.message ? err.message : ''));
        }
        return synthesizeBgm('ambient', totalSec + 0.5).then(function (ab) {
          return { ab: ab, blob: blobFromArrayBuffer(ab, 'audio/wav') };
        });
      });
    }

    return synthesizeBgm(preset, totalSec + 0.5).then(function (ab) {
      return { ab: ab, blob: blobFromArrayBuffer(ab, 'audio/wav') };
    });
  }

  function blobFromArrayBuffer(ab, mime) {
    return new Blob([ab], { type: mime || 'application/octet-stream' });
  }

  function playPreviewBlob(blob, maxSec) {
    return new Promise(function (resolve, reject) {
      if (!blob || !blob.size) {
        reject(new Error('沒有可播放的音訊'));
        return;
      }
      var url = URL.createObjectURL(blob);
      var audio = new Audio(url);
      var cleaned = false;
      var cap = parseFloat(maxSec);
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        try { URL.revokeObjectURL(url); } catch (e0) {}
      }
      function finish() {
        cleanup();
        resolve({ audio: audio, stop: function () {} });
      }
      if (cap > 0) {
        audio.addEventListener('timeupdate', function onTime() {
          if (audio.currentTime >= cap) {
            audio.removeEventListener('timeupdate', onTime);
            try { audio.pause(); } catch (eCap) {}
            finish();
          }
        });
      }
      audio.addEventListener('ended', function () {
        cleanup();
        resolve({ audio: audio, stop: function () {} });
      });
      audio.addEventListener('error', function () {
        cleanup();
        reject(new Error('播放失敗'));
      });
      var playPromise = audio.play();
      if (playPromise && playPromise.then) {
        playPromise.then(function () {
          resolve({
            audio: audio,
            url: url,
            stop: function () {
              try { audio.pause(); } catch (e1) {}
              cleanup();
            }
          });
        }).catch(function (e2) {
          cleanup();
          reject(e2);
        });
      } else {
        resolve({
          audio: audio,
          url: url,
          stop: function () {
            try { audio.pause(); } catch (e3) {}
            cleanup();
          }
        });
      }
    });
  }

  /**
   * 試播背景音樂（約 12～14 秒；不影響合成）
   * @param {string} preset 曲庫 id 或 AI 氛圍 preset
   * @param {object} opts { audioBlob, previewSec }
   */
  function previewBgm(preset, opts) {
    opts = opts || {};
    var previewSec = parseFloat(opts.previewSec);
    if (!(previewSec > 0)) previewSec = 14;

    if (opts.audioBlob) {
      return playPreviewBlob(opts.audioBlob, previewSec);
    }
    if (!preset || preset === 'off') {
      return Promise.reject(new Error('請先選一首音樂，或上傳音檔'));
    }

    var track = findBgmTrack(preset);
    if (track && (track.path || track.url)) {
      var url = resolveTrackUrl(track);
      return fetch(url, { mode: 'cors' }).then(function (res) {
        if (!res.ok) throw new Error('找不到音樂檔（HTTP ' + res.status + '）。請依 assets/bgm/README.md 放置 MP3');
        return res.blob();
      }).then(function (blob) {
        return playPreviewBlob(blob, previewSec);
      });
    }

    return synthesizeBgm(preset, previewSec).then(function (wavAb) {
      return playPreviewBlob(blobFromArrayBuffer(wavAb, 'audio/wav'));
    });
  }

  /**
   * 逐幀渲染 → JPEG 序列（給 ffmpeg）或 MediaRecorder
   */
  function renderFrames(images, secPerSlide, onProgress) {
    var n = images.length;
    var fade = Math.min(0.45, secPerSlide * 0.2);
    var totalSec = Math.min(MAX_TOTAL, n * secPerSlide);
    var frames = Math.max(1, Math.round(totalSec * FPS));
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    var frameBlobs = [];
    var i = 0;

    function frameAt(t) {
      var slide = Math.min(n - 1, Math.floor(t / secPerSlide));
      var local = t - slide * secPerSlide;
      var next = Math.min(n - 1, slide + 1);
      var zoom = 1 + 0.06 * (local / secPerSlide);
      var panX = (slide % 2 === 0 ? 1 : -1) * (local / secPerSlide - 0.5);
      var panY = (slide % 3 === 0 ? 0.4 : -0.3) * (local / secPerSlide);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      coverDraw(ctx, images[slide], 0, 0, W, H, zoom, panX, panY);

      if (next !== slide && local > secPerSlide - fade) {
        var a = (local - (secPerSlide - fade)) / fade;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        var z2 = 1.02;
        coverDraw(ctx, images[next], 0, 0, W, H, z2, 0, 0);
        ctx.restore();
      }
      // 開場淡入
      if (t < fade) {
        ctx.fillStyle = 'rgba(0,0,0,' + (1 - t / fade) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    function nextFrame() {
      if (i >= frames) {
        return Promise.resolve({
          frameBlobs: frameBlobs,
          totalSec: totalSec,
          canvas: canvas,
          fps: FPS
        });
      }
      var t = i / FPS;
      frameAt(t);
      if (onProgress) onProgress(i + 1, frames, '渲染影格');
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          frameBlobs.push(blob);
          i += 1;
          // 讓 UI 喘口氣
          setTimeout(function () { resolve(nextFrame()); }, 0);
        }, 'image/jpeg', 0.82);
      });
    }

    return nextFrame();
  }

  function encodeWithMediaRecorder(images, secPerSlide, audioBlob, onProgress) {
    var n = images.length;
    var totalSec = Math.min(MAX_TOTAL, n * secPerSlide);
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    var stream = canvas.captureStream(FPS);
    var audioCtx = null;
    var dest = null;

    function attachAudio() {
      if (!audioBlob) return Promise.resolve();
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
      dest = audioCtx.createMediaStreamDestination();
      return audioBlob.arrayBuffer().then(function (ab) {
        return audioCtx.decodeAudioData(ab.slice(0));
      }).then(function (buf) {
        var src = audioCtx.createBufferSource();
        src.buffer = buf;
        var g = audioCtx.createGain();
        g.gain.value = 0.55;
        src.connect(g);
        g.connect(dest);
        src.start(0);
        dest.stream.getAudioTracks().forEach(function (t) {
          stream.addTrack(t);
        });
      }).catch(function () {
        /* 無音也可 */
      });
    }

    return attachAudio().then(function () {
      var mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
      if (!mime) throw new Error('此瀏覽器不支援 MediaRecorder WebM');

      var chunks = [];
      var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size) chunks.push(e.data);
      };

      var fade = Math.min(0.45, secPerSlide * 0.2);
      var start = performance.now();
      var stopped = false;

      function draw() {
        if (stopped) return;
        var t = (performance.now() - start) / 1000;
        if (t >= totalSec) {
          stopped = true;
          try { rec.stop(); } catch (e0) {}
          return;
        }
        var slide = Math.min(n - 1, Math.floor(t / secPerSlide));
        var local = t - slide * secPerSlide;
        var next = Math.min(n - 1, slide + 1);
        var zoom = 1 + 0.06 * (local / secPerSlide);
        var panX = (slide % 2 === 0 ? 1 : -1) * (local / secPerSlide - 0.5);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        coverDraw(ctx, images[slide], 0, 0, W, H, zoom, panX, (slide % 3 === 0 ? 0.4 : -0.3) * (local / secPerSlide));
        if (next !== slide && local > secPerSlide - fade) {
          var a = (local - (secPerSlide - fade)) / fade;
          ctx.save();
          ctx.globalAlpha = a;
          coverDraw(ctx, images[next], 0, 0, W, H, 1.02, 0, 0);
          ctx.restore();
        }
        if (t < fade) {
          ctx.fillStyle = 'rgba(0,0,0,' + (1 - t / fade) + ')';
          ctx.fillRect(0, 0, W, H);
        }
        if (onProgress) onProgress(Math.min(99, Math.round((t / totalSec) * 100)), 100, '即時錄製');
        requestAnimationFrame(draw);
      }

      return new Promise(function (resolve, reject) {
        rec.onerror = function () { reject(new Error('MediaRecorder 失敗')); };
        rec.onstop = function () {
          if (audioCtx) try { audioCtx.close(); } catch (e1) {}
          resolve({
            blob: new Blob(chunks, { type: mime }),
            mime: mime,
            ext: 'webm',
            fallback: true,
            note: 'ffmpeg.wasm 不可用，已降級為 WebM（粉專有時較愛 MP4；可換瀏覽器或檢查 CDN）'
          });
        };
        rec.start(200);
        requestAnimationFrame(draw);
      });
    });
  }

  function encodeWithFfmpeg(frameBlobs, totalSec, audioAb, onProgress) {
    return ensureFfmpeg().then(function (ffmpeg) {
      var fetchFile = global.FFmpegUtil && global.FFmpegUtil.fetchFile;
      if (!fetchFile) throw new Error('缺少 fetchFile');
      var writes = [];
      var i;
      for (i = 0; i < frameBlobs.length; i++) {
        (function (idx, blob) {
          writes.push(fetchFile(blob).then(function (data) {
            var name = 'f' + String(idx).padStart(5, '0') + '.jpg';
            return ffmpeg.writeFile(name, data);
          }));
        })(i, frameBlobs[i]);
      }
      return Promise.all(writes).then(function () {
        if (onProgress) onProgress(1, 3, 'ffmpeg 編碼');
        var args = [
          '-framerate', String(FPS),
          '-i', 'f%05d.jpg',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-r', String(FPS),
          '-movflags', '+faststart'
        ];
        var hasAudio = !!(audioAb && audioAb.byteLength);
        if (hasAudio) {
          return ffmpeg.writeFile('bgm.wav', new Uint8Array(audioAb)).then(function () {
            args = args.concat(['-i', 'bgm.wav', '-c:a', 'aac', '-shortest']);
            args.push('out.mp4');
            return ffmpeg.exec(args);
          });
        }
        args.push('out.mp4');
        return ffmpeg.exec(args);
      }).then(function () {
        if (onProgress) onProgress(2, 3, '讀取成品');
        return ffmpeg.readFile('out.mp4');
      }).then(function (data) {
        var blob = new Blob([data.buffer], { type: 'video/mp4' });
        if (onProgress) onProgress(3, 3, '匯出完成');
        return {
          blob: blob,
          mime: 'video/mp4',
          ext: 'mp4',
          fallback: false,
          note: '已用 ffmpeg.wasm 匯出 MP4'
        };
      });
    });
  }

  /**
   * @param {object} opts
   * @param {string[]} opts.imageUrls
   * @param {number} opts.secPerSlide
   * @param {string} opts.bgmPreset  soft|warm|bright|off
   * @param {Blob|null} opts.audioBlob 使用者上傳
   * @param {boolean} opts.musicOff
   * @param {function} opts.onProgress
   */
  function composeReel(opts) {
    opts = opts || {};
    var urls = opts.imageUrls || [];
    var minSlides = CFG.MIN_SLIDES || 2;
    var maxSlides = CFG.MAX_SLIDES || 10;
    if (urls.length < minSlides) {
      return Promise.reject(new Error('短影音至少需要 ' + minSlides + ' 張圖（已採用／最新版）'));
    }
    if (urls.length > maxSlides) urls = urls.slice(0, maxSlides);

    var sec = parseFloat(opts.secPerSlide);
    if (!(sec > 0)) sec = CFG.SEC_PER_SLIDE || 2.4;
    sec = Math.max(1.2, Math.min(4, sec));

    var onProgress = opts.onProgress || function () {};
    onProgress(1, 4, '載入引擎準備中');

    return Promise.all(urls.map(loadImage)).then(function (images) {
      onProgress(1, 4, '拼片素材就緒');
      var totalSec = Math.min(MAX_TOTAL, images.length * sec);
      var audioReady = resolveBgmAudio({
        musicOff: !!opts.musicOff,
        bgmPreset: opts.bgmPreset,
        audioBlob: opts.audioBlob
      }, totalSec, onProgress);

      return audioReady.then(function (audioPack) {
        onProgress(0, 1, '渲染影格（拼片）');
        return renderFrames(images, sec, onProgress).then(function (rendered) {
          var audioAb = audioPack && audioPack.ab;
          var audioBlob = audioPack && audioPack.blob;
          onProgress(0, 1, '載入引擎／準備編碼');
          return encodeWithFfmpeg(rendered.frameBlobs, rendered.totalSec, audioAb, onProgress)
            .catch(function (err) {
              onProgress(0, 1, '改走降級 WebM：' + (err && err.message ? err.message : String(err)));
              return encodeWithMediaRecorder(images, sec, audioBlob, onProgress);
            });
        });
      });
    });
  }

  global.FbPostReel = {
    composeReel: composeReel,
    ensureFfmpeg: ensureFfmpeg,
    synthesizeBgm: synthesizeBgm,
    loadBgmTrack: loadBgmTrack,
    findBgmTrack: findBgmTrack,
    previewBgm: previewBgm,
    resolveTrackUrl: resolveTrackUrl
  };
})(window);
