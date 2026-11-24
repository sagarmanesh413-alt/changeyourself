/* ChangeYourself — shared site JS (Home, About, Pricing only).
   The mock-tests app at /changexed/mock-tests/ is a standalone file and does not load this. */
(function () {
  "use strict";

  /* ---------- Guarded storage shim ----------
     Plain localStorage throws in some phone webviews (and in private
     mode), which used to break the whole script. Every access goes
     through this shim: localStorage when it works, an in-memory
     object when it doesn't. Never call localStorage directly. */
  var memStore = {};
  var storageOK = false;
  try {
    window.localStorage.setItem("__cy_probe__", "1");
    window.localStorage.removeItem("__cy_probe__");
    storageOK = true;
  } catch (e) { storageOK = false; }
  var store = {
    get: function (key) {
      if (storageOK) {
        try { return window.localStorage.getItem(key); } catch (e) { /* fall through */ }
      }
      return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null;
    },
    set: function (key, value) {
      if (storageOK) {
        try { window.localStorage.setItem(key, value); return; } catch (e) { /* fall through */ }
      }
      memStore[key] = value;
    }
  };

  /* ---------- Theme toggle ----------
     Default theme is dark. The saved choice ("cy-theme": "light" |
     "dark") is applied pre-paint by the inline script in <head>;
     this just wires the toggle button and keeps it in sync. */
  var THEME_KEY = "cy-theme";
  var SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var themeToggle = document.getElementById("themeToggle");
  function currentTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "light" ? "light" : "dark";
  }
  function paintToggle(theme) {
    if (!themeToggle) return;
    /* The icon shows the theme the button will switch TO. */
    themeToggle.innerHTML = theme === "dark" ? SUN_SVG : MOON_SVG;
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  function setTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    store.set(THEME_KEY, theme);
    paintToggle(theme);
  }
  if (themeToggle) {
    /* Sync with whatever the pre-paint script applied (or the default). */
    paintToggle(currentTheme());
    themeToggle.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  /* ---------- Toast ---------- */
  var toast = document.getElementById("toast");
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 4000);
  }

  /* ---------- Auth scripts (Supabase client + login modal) ----------
     Loaded dynamically so the 11 small pages share one wiring point.
     Guarded against duplicates: the dashboard and the mock-test app
     load the same files with explicit <script> tags. auth.js is only
     injected after supabase.js has parsed (it needs window.CYSupa). */
  function loadAuthScripts() {
    if (!document.querySelector('script[src="/supabase.js"]')) {
      var s1 = document.createElement("script");
      s1.src = "/supabase.js";
      s1.onload = function () {
        if (!document.querySelector('script[src="/auth.js"]')) {
          var s2 = document.createElement("script");
          s2.src = "/auth.js";
          document.head.appendChild(s2);
        }
      };
      document.head.appendChild(s1);
    } else if (!document.querySelector('script[src="/auth.js"]')) {
      var s2b = document.createElement("script");
      s2b.src = "/auth.js";
      document.head.appendChild(s2b);
    }
  }
  loadAuthScripts();

  /* The Login button is owned by /auth.js now (real sign-in with Google
     or email code). No toast handler here any more. */

  /* Any element marked data-soon shows a toast instead of navigating. */
  var soonEls = document.querySelectorAll("[data-soon]");
  for (var i = 0; i < soonEls.length; i++) {
    soonEls[i].addEventListener("click", function (ev) {
      ev.preventDefault();
      showToast(this.getAttribute("data-soon") || "Coming soon.");
    });
  }

  /* ---------- Rotating hero word ---------- */
  var rot = document.getElementById("rotWord");
  if (rot) {
    var words = ["empowering", "transformative", "innovative", "life-changing", "career-defining"];
    var idx = 0;
    setInterval(function () {
      rot.classList.add("fading");
      setTimeout(function () {
        idx = (idx + 1) % words.length;
        rot.textContent = words[idx];
        rot.classList.remove("fading");
      }, 350);
    }, 2400);
  }

  /* ---------- Motion: scroll reveal, hero parallax ----------
     Transform/opacity only. All of it is skipped when the user
     prefers reduced motion. The "js" class gates the reveal hidden
     state in CSS, so content is never stuck invisible if this
     script fails to load. */
  document.documentElement.classList.add("js");
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var finePointer = false;
  try { finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) {}
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); };
  }

  /* Reveal-on-scroll: fade + rise, staggered within a grid. */
  var revealTargets = document.querySelectorAll(
    ".card-dark, .tier, .addon, .mock-band, .stat," +
    " .section > .container > h2, .section > .container > .section-sub," +
    " .section > .container > p, .section > .container > .btn," +
    " .mission, .faq-item, .faq h2, .tl-item, .page-head h1, .page-head p," +
    " .page-head .by-changexed, .quiz-note"
  );
  function revealNow(el) {
    el.classList.add("visible");
    el.style.transitionDelay = "";
  }
  if (reduceMotion || !("IntersectionObserver" in window)) {
    for (var ri = 0; ri < revealTargets.length; ri++) {
      revealTargets[ri].classList.add("reveal");
      revealNow(revealTargets[ri]);
    }
  } else {
    var io = new IntersectionObserver(function (entries) {
      for (var ei = 0; ei < entries.length; ei++) {
        var entry = entries[ei];
        if (!entry.isIntersecting) continue;
        var el = entry.target;
        io.unobserve(el);
        var sibs = el.parentNode ? el.parentNode.children : [];
        var idx = 0;
        for (var k = 0; k < sibs.length; k++) { if (sibs[k] === el) { idx = k; break; } }
        var delay = Math.min(idx, 5) * 80;
        if (delay) {
          el.style.transitionDelay = delay + "ms";
          (function (elm) {
            setTimeout(function () { elm.style.transitionDelay = ""; }, 900);
          })(el);
        }
        el.classList.add("visible");
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    for (var oi = 0; oi < revealTargets.length; oi++) {
      revealTargets[oi].classList.add("reveal");
      io.observe(revealTargets[oi]);
    }
  }

  /* Hero parallax: background layers move slower than the content.
     Passive scroll listener + rAF, transform only, clamped so the
     content moves at most ~33px. Only runs while a hero is on
     screen, so it costs nothing elsewhere. */
  var heroes = document.querySelectorAll(".hero");
  if (heroes.length && !reduceMotion) {
    var ticking = false;
    function updateParallax() {
      ticking = false;
      for (var hi = 0; hi < heroes.length; hi++) {
        var h = heroes[hi];
        var rect = h.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          if (h.style.getPropertyValue("--hero-px")) h.style.setProperty("--hero-px", "0px");
          continue;
        }
        var px = Math.max(0, Math.min(220, -rect.top));
        h.style.setProperty("--hero-px", Math.round(px) + "px");
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateParallax); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateParallax();
  }

  /* ---------- Liquid glass navs (Nimbus "Waterline") ----------
     A vanilla port of the LiquidNavbar React component. The site is
     a static site — no React, no shadcn, no Tailwind, no build step
     — so the component is ported to plain JS/CSS instead of being
     installed. It runs on two pills: the floating dock (icons-only,
     compact) and the header (text links, labels visible). The menus
     are the site's own links, read from the page; the active drop
     sits on the link for the page you are on (from the URL), and on
     pages with no matching link there is no active drop, just the
     glass pill. Tone follows the site theme. Sound is off (the
     demo's plip is not wired up). */
  var liquidToneTargets = [];
  function initLiquidNav(dock, itemDefs, compact) {
    if (!dock || !itemDefs.length) return;
    var links = itemDefs.map(function (d) { return d.el; });

    var PAD = 14;
    var FX = itemDefs.map(function (d) { return d.fx || "none"; });
    var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
    var FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,h.y);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,uPill.w*.36)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=vec3(0.,.14,.36)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.95,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=mix(vec3(0.,.42,.78),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

    /* The active menu is the one whose href matches the page. */
    var path = window.location.pathname || "/";
    var current = -1;
    links.forEach(function (a, i) {
      if (current !== -1) return;
      var href = a.getAttribute("href") || "";
      if (!href) return;
      if (href === path) current = i;
      else if (href !== "/" && href.length > 1 && path.indexOf(href) === 0) current = i;
    });

    /* Build the pill: the refraction filter, the glass, the water
       canvas and the CSS-drop fallback, then the icon + label
       structure inside each link. */
    dock.classList.add("nimbus-nav");
    dock.setAttribute("data-compact", compact ? "true" : "false");
    dock.setAttribute("aria-label", "Main");
    var firstLink = links[0];
    var filterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    filterSvg.setAttribute("width", "0");
    filterSvg.setAttribute("height", "0");
    filterSvg.setAttribute("aria-hidden", "true");
    filterSvg.style.position = "absolute";
    filterSvg.innerHTML = '<filter id="nimbus-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="7" result="noise" /><feGaussianBlur in="noise" stdDeviation="2" result="soft" /><feDisplacementMap in="SourceGraphic" in2="soft" scale="60" xChannelSelector="R" yChannelSelector="G" /></filter>';
    var glass = document.createElement("span");
    glass.className = "nimbus-glass";
    glass.setAttribute("aria-hidden", "true");
    var canvas = document.createElement("canvas");
    canvas.className = "nimbus-water";
    canvas.setAttribute("aria-hidden", "true");
    var drop = document.createElement("span");
    drop.className = "nimbus-drop";
    drop.setAttribute("aria-hidden", "true");
    dock.insertBefore(filterSvg, firstLink);
    dock.insertBefore(glass, firstLink);
    dock.insertBefore(canvas, firstLink);
    dock.insertBefore(drop, firstLink);

    var iconEls = [];
    itemDefs.forEach(function (def, i) {
      var a = def.el;
      var label = def.label || "";
      var svg = a.querySelector("svg");
      var img = a.querySelector("img");
      a.classList.add("nimbus-item");
      a.setAttribute("aria-label", label);
      var ico = null;
      if (svg || img) {
        ico = document.createElement("span");
        ico.className = "nv-ico";
        if (svg) {
          if (def.door) {
            var door = svg.querySelector("polyline");
            if (door) door.setAttribute("class", "nv-door");
          }
          ico.appendChild(svg);
        } else {
          ico.appendChild(img);
        }
        a.insertBefore(ico, a.firstChild);
      }
      iconEls.push(ico);
      if (def.hideLabel) {
        /* Icons-only item: the label lives in the DOM, hidden. */
        var lab = document.createElement("span");
        lab.className = "nimbus-label";
        lab.textContent = label;
        a.appendChild(lab);
      } else if (!svg && !img) {
        /* Text link: wrap its own text in the visible label. */
        var text = a.textContent;
        a.textContent = "";
        var lab2 = document.createElement("span");
        lab2.className = "nimbus-label";
        lab2.textContent = String(text || "").trim();
        a.appendChild(lab2);
      }
      if (i === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    /* Water state (the component's makeState, as a plain object). */
    var dark = 0;
    var st = {
      a: { x: 0, v: 0 }, b: { x: 0, v: 0 },
      sy: { s: 1, v: 0 },
      lead: 0, lagFrom: 0,
      sats: [], rips: [],
      t: { x: 0, cy: 0, q: 0, r: 21 },
      q: 0,
      mouse: { x: 0, y: 0, s: 0, on: false },
      moving: false, split: false, ready: false,
      w: 0, h: 0, visible: true, reduce: false,
      raf: 0, last: 0, time: 0,
      glc: null
    };

    function initGL(cv) {
      var gl = null;
      try { gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }); } catch (e) { gl = null; }
      if (!gl) return null;
      var sh = function (type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
      };
      var vs = sh(gl.VERTEX_SHADER, VERT);
      var fs = sh(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      gl.useProgram(p);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(p, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var u = {};
      var names = ["uRes", "uDpr", "uTime", "uPill", "uBlob", "uSy", "uRip", "uMouse", "uDark", "uAmb"];
      for (var ni = 0; ni < names.length; ni++) u[names[ni]] = gl.getUniformLocation(p, names[ni]);
      return { gl: gl, u: u };
    }

    function supportsRefraction() {
      if (typeof window === "undefined" || typeof CSS === "undefined") return false;
      var ua = navigator.userAgent || "";
      return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua) && !!(CSS.supports && CSS.supports("backdrop-filter", "url(#a)"));
    }

    function draw() {
      var T = st.t;
      var sep = Math.abs(st.a.x - st.b.x);
      var thin = Math.min(sep / (2 * (st.q + T.r) || 1), 1);
      var r = T.r * (1 - 0.3 * thin);
      if (st.glc) {
        var g = st.glc.gl, u = st.glc.u;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
        g.uniform2f(u.uRes, st.w + PAD * 2, st.h + PAD * 2);
        g.uniform1f(u.uDpr, dpr);
        g.uniform1f(u.uTime, st.time);
        g.uniform4f(u.uPill, PAD, PAD, st.w, st.h);
        var blobs = new Float32Array(24);
        var sy = new Float32Array(6).fill(1);
        if (current >= 0) {
          var head = st.lead === 0 ? st.a : st.b, tail = st.lead === 0 ? st.b : st.a;
          blobs.set([head.x, T.cy, st.q * (1 - 0.25 * thin), T.r * (1 - 0.12 * thin), tail.x, T.cy, st.q * (1 - 0.8 * thin), T.r * (1 - 0.5 * thin)], 0);
          sy[0] = sy[1] = st.sy.s;
          st.sats.slice(0, 4).forEach(function (d, i) { blobs.set([d.x, d.y, 0, d.r], 8 + i * 4); });
        }
        g.uniform4fv(u.uBlob, blobs);
        g.uniform1fv(u.uSy, sy);
        var rips = new Float32Array(24);
        st.rips.slice(-6).forEach(function (p, i) { rips.set([p.x, p.y, p.age, p.amp], i * 4); });
        g.uniform4fv(u.uRip, rips);
        g.uniform3f(u.uMouse, st.mouse.x, st.mouse.y, st.mouse.s);
        g.uniform1f(u.uDark, dark);
        g.uniform1f(u.uAmb, st.reduce ? 0 : 1);
        g.clearColor(0, 0, 0, 0);
        g.clear(g.COLOR_BUFFER_BIT);
        g.drawArrays(g.TRIANGLES, 0, 3);
      } else {
        if (current < 0) { drop.style.display = "none"; return; }
        drop.style.display = "";
        var left = Math.min(st.a.x, st.b.x) - st.q - r - PAD;
        var width = sep + 2 * (st.q + r);
        drop.style.width = width + "px";
        drop.style.transform = "translateX(" + left + "px) scaleY(" + st.sy.s + ")";
      }
    }

    function step(dt, now) {
      var T = st.t;
      st.time += dt;
      st.q += (T.q - st.q) * Math.min(1, dt * 12);
      var bodies = [st.a, st.b];
      var still = true;
      if (st.reduce) {
        st.a.x = st.b.x = T.x; st.a.v = st.b.v = 0; st.sy.s = 1; st.sats = [];
      } else {
        bodies.forEach(function (B, i) {
          var lead = i === st.lead;
          var k = lead ? 210 : 72;
          var c = lead ? 25 : 13;
          var f = !lead && now < st.lagFrom ? 0.08 : 1;
          B.v += (k * (T.x - B.x) - c * B.v) * dt * f;
          B.x += B.v * dt;
          var lo = PAD + 6 + st.q + T.r - 3, hi = PAD + st.w - 6 - st.q - T.r + 3;
          if (B.x < lo || B.x > hi) {
            st.sy.v -= Math.min(Math.abs(B.v), 900) * 0.0016;
            B.x = Math.max(lo, Math.min(hi, B.x));
            B.v *= -0.25;
          }
          if (Math.abs(T.x - B.x) > 0.3 || Math.abs(B.v) > 3) still = false;
        });
        var L = bodies[st.lead];
        var syT = 1 - 0.2 * Math.min(Math.abs(L.v) / 1500, 1);
        st.sy.v += (280 * (syT - st.sy.s) - 9 * st.sy.v) * dt;
        st.sy.s += st.sy.v * dt;
        if (Math.abs(st.sy.s - 1) > 0.002 || Math.abs(st.sy.v) > 0.02) still = false;
        var sep = Math.abs(st.a.x - st.b.x);
        var r = T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1));
        if (!st.split && st.moving && sep - 2 * T.q - 2 * r > -6) {
          st.split = true;
          var loB = bodies[1 - st.lead], hiB = bodies[st.lead];
          [0.3, 0.5, 0.72].forEach(function (t, j) {
            st.sats.push({
              x: loB.x + (hiB.x - loB.x) * t + (Math.random() - 0.5) * 6,
              y: T.cy + (Math.random() - 0.5) * 10,
              vx: (loB.v + hiB.v) * 0.45,
              vy: (Math.random() - 0.5) * 60,
              r: 5 + Math.random() * 3 - j * 0.5,
              k: 70 + Math.random() * 90
            });
          });
        }
        st.sats = st.sats.filter(function (d) {
          d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt;
          d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.x = Math.max(PAD + 8 + d.r, Math.min(PAD + st.w - 8 - d.r, d.x));
          d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y));
          if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26;
          return d.r > 0.6;
        });
        if (st.sats.length) still = false;
      }
      if (st.moving && still) {
        st.moving = false;
        if (st.split || !st.reduce) st.rips.push({ x: T.x, y: T.cy, age: 0, amp: st.split ? 1.2 : 0.7 });
      }
      st.rips.forEach(function (p) { p.age += dt; });
      st.rips = st.rips.filter(function (p) { return p.age < 2.4; });
      var target = st.mouse.on ? 1 : 0;
      st.mouse.s += (target - st.mouse.s) * Math.min(1, dt * 7);
    }

    function loop() {
      if (st.raf) return;
      st.last = performance.now();
      var tick = function (now) {
        var dt = Math.min((now - st.last) / 1000, 1 / 30);
        st.last = now;
        step(dt, now);
        draw();
        var busy = st.moving || st.rips.length || st.sats.length || st.mouse.s > 0.01;
        if (st.visible && (!st.reduce || busy)) st.raf = requestAnimationFrame(tick);
        else st.raf = 0;
      };
      st.raf = requestAnimationFrame(tick);
    }

    function measure() {
      var el = current >= 0 ? links[current] : null;
      if (!el) return;
      st.w = dock.offsetWidth;
      st.h = dock.offsetHeight;
      var T = st.t;
      T.r = el.offsetHeight / 2;
      T.q = Math.max(0, el.offsetWidth / 2 - T.r);
      T.cy = PAD + el.offsetTop + el.offsetHeight / 2;
      var nx = PAD + el.offsetLeft + el.offsetWidth / 2;
      if (!st.ready) {
        st.a.x = st.b.x = nx;
        st.q = T.q;
        st.ready = true;
      } else if (Math.abs(nx - T.x) > 0.5) {
        st.lead = Math.abs(nx - st.a.x) <= Math.abs(nx - st.b.x) ? 0 : 1;
        st.lagFrom = performance.now() + 70;
        st.moving = true;
        st.split = false;
      }
      T.x = nx;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = st.w + PAD * 2, Hh = st.h + PAD * 2;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(Hh * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(Hh * dpr);
        canvas.style.width = W + "px";
        canvas.style.height = Hh + "px";
      }
      loop();
    }

    /* Tone follows the site theme, live, when the toggle changes.
       Each pill registers its own applyTone; one observer below
       calls them all. */
    function applyTone() {
      var t = currentTheme();
      dark = t === "dark" ? 1 : 0;
      dock.setAttribute("data-tone", t);
      loop();
    }
    applyTone();
    liquidToneTargets.push(applyTone);

    /* Init: GL (or the CSS drop), visibility + resize observers. */
    dock.setAttribute("data-refract", supportsRefraction() ? "on" : "off");
    try { st.reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { st.reduce = false; }
    st.glc = initGL(canvas);
    dock.setAttribute("data-gl", st.glc ? "on" : "off");
    canvas.addEventListener("webglcontextlost", function (e) {
      if (e) e.preventDefault();
      st.glc = null;
      dock.setAttribute("data-gl", "off");
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        st.visible = entries[0].isIntersecting;
        if (st.visible) loop();
      });
      io.observe(dock);
    }
    document.addEventListener("visibilitychange", function () {
      st.visible = document.visibilityState === "visible";
      if (st.visible) loop();
    });
    measure();
    if ("ResizeObserver" in window) {
      var lastW = -1;
      var ro = new ResizeObserver(function () {
        var w = dock.offsetWidth || 0;
        if (w !== lastW) { lastW = w; st.ready = false; measure(); }
      });
      ro.observe(dock);
    }

    /* Interaction: the cursor lifts a meniscus, a tap sends a wave
       and plays the item's icon scene, then the link navigates. */
    function localPoint(clientX, clientY) {
      var r = dock.getBoundingClientRect();
      return { x: clientX - r.left + PAD, y: clientY - r.top + PAD };
    }
    function ripple(x, y, amp) {
      if (st.reduce) return;
      st.rips.push({ x: x, y: y, age: 0, amp: amp });
      loop();
    }
    function iconCenter(i) {
      var el = iconEls[i];
      if (!el) return null;
      var b = el.getBoundingClientRect();
      return localPoint(b.left + b.width / 2, b.top + b.height / 2);
    }
    function playFx(i) {
      var kind = FX[i];
      var icon = iconEls[i];
      if (!kind || kind === "none" || !icon) return;
      icon.removeAttribute("data-fx");
      void icon.offsetWidth;
      icon.setAttribute("data-fx", kind);
      setTimeout(function () { icon.removeAttribute("data-fx"); }, 1400);
    }
    function select(i) {
      playFx(i);
      var c = iconCenter(i);
      if (c && FX[i] === "drop") setTimeout(function () { ripple(c.x, st.t.cy, 1.4); }, 430);
      if (c && FX[i] === "plane") ripple(c.x, c.y, 0.6);
      if (i !== current) {
        current = i;
        links.forEach(function (a, j) {
          if (j === i) a.setAttribute("aria-current", "page");
          else a.removeAttribute("aria-current");
        });
        measure();
      }
    }
    dock.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var n = (current + (e.key === "ArrowRight" ? 1 : -1) + links.length) % links.length;
      select(n);
      if (links[n]) links[n].focus();
    });
    dock.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var p = localPoint(e.clientX, e.clientY);
      st.mouse.x = p.x;
      st.mouse.y = p.y;
      st.mouse.on = true;
      loop();
    });
    dock.addEventListener("pointerleave", function () { st.mouse.on = false; loop(); });
    dock.addEventListener("pointerdown", function (e) {
      var p = localPoint(e.clientX, e.clientY);
      ripple(p.x, p.y, 0.8);
    });
    links.forEach(function (a, i) {
      a.addEventListener("click", function () { select(i); });
    });
  }

  /* The two pills: the floating dock (icons-only) and the header
     (text links, labels visible). The header's Login button and
     theme toggle are actions, not items — they sit in the pill and
     get its ripple, but they never move the drop. */
  var dockEl = document.querySelector(".dock");
  if (dockEl) {
    initLiquidNav(dockEl, Array.prototype.slice.call(dockEl.querySelectorAll("a")).map(function (a, i) {
      return {
        el: a,
        label: a.getAttribute("aria-label") || a.getAttribute("title") || "",
        fx: ["glow", "spin", "pop", "wave", "drop", "spin", "pop"][i] || "pop",
        hideLabel: true,
        door: i === 0
      };
    }), true);
  }
  var navEl = document.querySelector(".nav");
  if (navEl) {
    var navLinks = Array.prototype.slice.call(navEl.querySelectorAll("a.nav-link, a.logo"));
    initLiquidNav(navEl, navLinks.map(function (a) {
      var isLogo = a.classList.contains("logo");
      return {
        el: a,
        label: isLogo ? "Home" : (a.textContent || "").trim(),
        fx: isLogo ? "glow" : "none",
        hideLabel: isLogo
      };
    }), false);
  }
  /* One theme observer for both pills. */
  if (window.MutationObserver) {
    var liquidMo = new MutationObserver(function (muts) {
      for (var mi = 0; mi < muts.length; mi++) {
        if (muts[mi].attributeName === "data-theme") {
          liquidToneTargets.forEach(function (fn) { fn(); });
          break;
        }
      }
    });
    liquidMo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
})();
