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
   * 產生內建程序 BGM（WAV ArrayBuffer）— 無二進位進 git
   */
  function synthesizeBgm(presetId, durationSec) {
    var sampleRate = 44100;
    var n = Math.max(1, Math.floor(sampleRate * durationSec));
    var ctx = new (global.OfflineAudioContext || global.webkitOfflineAudioContext)(2, n, sampleRate);
    var t0 = ctx.currentTime;
    var master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);

    function tone(freq, type, start, len, gain) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(gain, t0 + start + 0.08);
      g.gain.linearRampToValueAtTime(gain * 0.7, t0 + start + len * 0.7);
      g.gain.linearRampToValueAtTime(0, t0 + start + len);
      o.connect(g);
      g.connect(master);
      o.start(t0 + start);
      o.stop(t0 + start + len + 0.05);
    }

    var i;
    if (presetId === 'warm') {
      for (i = 0; i < durationSec; i += 2) {
        tone(220, 'triangle', i, 1.8, 0.35);
        tone(277.2, 'sine', i + 0.2, 1.6, 0.22);
        tone(329.6, 'sine', i + 0.4, 1.4, 0.18);
      }
    } else if (presetId === 'bright') {
      for (i = 0; i < durationSec; i += 1) {
        tone(392, 'sine', i, 0.35, 0.25);
        tone(493.9, 'triangle', i + 0.35, 0.35, 0.2);
        tone(587.3, 'sine', i + 0.7, 0.25, 0.18);
      }
    } else {
      // soft
      for (i = 0; i < durationSec; i += 3) {
        tone(174.6, 'sine', i, 2.8, 0.3);
        tone(261.6, 'sine', i + 0.3, 2.5, 0.2);
        tone(349.2, 'triangle', i + 0.6, 2.2, 0.15);
      }
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

  function blobFromArrayBuffer(ab, mime) {
    return new Blob([ab], { type: mime || 'application/octet-stream' });
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
      var musicOff = !!opts.musicOff || opts.bgmPreset === 'off';
      var audioReady;

      if (musicOff) {
        audioReady = Promise.resolve(null);
      } else if (opts.audioBlob) {
        audioReady = opts.audioBlob.arrayBuffer().then(function (ab) {
          return { ab: ab, blob: opts.audioBlob };
        }).catch(function () {
          return null;
        });
      } else {
        var preset = opts.bgmPreset || 'soft';
        if (preset === 'off') {
          audioReady = Promise.resolve(null);
        } else {
          audioReady = synthesizeBgm(preset, totalSec + 0.5).then(function (ab) {
            return { ab: ab, blob: blobFromArrayBuffer(ab, 'audio/wav') };
          });
        }
      }

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
    synthesizeBgm: synthesizeBgm
  };
})(window);
