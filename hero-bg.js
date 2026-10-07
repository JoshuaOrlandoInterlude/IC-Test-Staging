/* Interlude Capital teaser: animated background.
   Draws soft vertical streaks of light that drift, fade and change tone,
   replacing the static hero-bg.png. If WebGL is unavailable, or the visitor
   prefers reduced motion, the static image is left in place. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;

  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 r;',   // canvas size in pixels
    'uniform float t;',  // seconds
    'const vec3 BASE=vec3(85.,112.,124.)/255.;',
    'const vec3 GREEN=vec3(113.,166.,156.)/255.;',
    'const vec3 TEAL=vec3(153.,198.,206.)/255.;',
    'float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    '  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    // One cluster of vertical streaks. c = centre, rad = half-size, s = seed.
    // Each streak is its own column with its own brightness, height and tone.
    'vec4 cluster(vec2 p,vec2 c,vec2 rad,float s){',
    '  vec2 q=p-c;',
    '  float N=18.;',
    '  float i0=floor(q.x*N);',
    '  float acc=0.,tone=0.;',
    '  for(int j=-2;j<=2;j++){',
    '    float id=i0+float(j);',
    '    float rnd=h(vec2(id,s));',
    '    float cx=(id+.5+(rnd-.5)*.6)/N;',
    '    float w=(.55+.6*h(vec2(id,s+1.)))/N;',
    '    float br=smoothstep(.1,.58,n(vec2(t*.24+rnd*20.,id*1.3+s)));',
    '    float yo=(n(vec2(t*.16+rnd*9.,id+s*2.))-.5)*rad.y*1.25;',
    '    float len=rad.y*(.5+.8*n(vec2(t*.19+rnd*5.,id+s*3.)));',
    '    float dx=(q.x-cx)/w,dy=(q.y+yo)/len;',
    '    float a=br*exp(-dx*dx*1.3)*exp(-dy*dy*1.3)*.9;',
    '    acc+=a;',
    '    tone+=a*n(vec2(t*.11+rnd*7.,id*.37+s));',
    '  }',
    '  float mx=q.x/rad.x;',
    '  float env=smoothstep(.2,.5,n(vec2(t*.27+s*5.,s)));',
    '  float k=smoothstep(.32,.68,tone/max(acc,.0001));',
    '  return vec4(mix(GREEN,TEAL,k),min(acc,1.15)*exp(-mx*mx*1.5)*env);',
    '}',
    'void main(){',
    '  float u=min(r.y,r.x*1.35);',
    '  vec2 p=(gl_FragCoord.xy-.5*r)/u;',
    '  p.y=-p.y;',
    '  vec4 A=cluster(p,vec2(.17,-.17),vec2(.25,.19),1.7);',
    '  vec4 B=cluster(p,vec2(-.2,.12),vec2(.19,.17),8.3);',
    '  vec3 c=BASE;',
    '  c+=(A.rgb-BASE)*A.a*1.2;',
    '  c+=(B.rgb-BASE)*B.a*1.2;',
    '  c+=(h(gl_FragCoord.xy+fract(t)*61.)-.5)*.022;', // film grain
    '  gl_FragColor=vec4(c,1.);',
    '}'
  ].join('\n');

  function start() {
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = shader(gl.VERTEX_SHADER, VERT);
    var fs = shader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(prog, 'r');
    var uT = gl.getUniformLocation(prog, 't');

    var style = document.createElement('style');
    style.textContent =
      '#ic-bg{position:fixed;inset:0;width:100%;height:100%;z-index:-1;display:block;' +
      'pointer-events:none;opacity:0;transition:opacity 1.2s ease}' +
      'html.ic-live #ic-bg{opacity:1}' +
      'html.ic-live{background-color:#55707c}' +
      'html.ic-live body{background-color:transparent}' +
      'html.ic-live main{background-color:transparent}' +
      'main>img[data-nimg]{transition:opacity 1.2s ease}' +
      'html.ic-live main>img[data-nimg]{opacity:0}';
    document.head.appendChild(style);
    canvas.id = 'ic-bg';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    // The picture is soft, so a modest pixel count is enough and keeps it light.
    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      var k = Math.min(1, 1100 / Math.max(w, h));
      var cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        gl.viewport(0, 0, cw, ch);
      }
    }
    resize();
    window.addEventListener('resize', resize);

    var t0 = performance.now(), last = 0, raf = 0, lost = false;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (lost || now - last < 30) return; // ~30 fps
      last = now;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, 40 + (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function live(on) { document.documentElement.classList.toggle('ic-live', on); }

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; live(false); });
    document.addEventListener('visibilitychange', function () {
      cancelAnimationFrame(raf);
      if (!document.hidden && !lost) raf = requestAnimationFrame(frame);
    });

    frame(performance.now());
    requestAnimationFrame(function () { if (!lost) live(true); });
  }

  // Wait until the page has finished loading so the canvas is added after
  // the framework has taken over the existing markup.
  if (document.readyState === 'complete') setTimeout(start, 0);
  else window.addEventListener('load', function () { setTimeout(start, 0); });
})();
