(() => {
  'use strict';

  const announcer = document.getElementById('live-announcer');
  let announceTimer = null;

  function announce(message) {
    if (!announcer) return;
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      announcer.textContent = '';
      window.requestAnimationFrame(() => {
        announcer.textContent = message;
      });
    }, 120);
  }

  /* ==================== 1. SCROLL PROGRESS FALLBACK ==================== */
  const progressBar = document.getElementById('reading-progress');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (progressBar && !CSS.supports('animation-timeline', 'scroll()')) {
    const updateScrollProgress = () => {
      if (prefersReducedMotion.matches) {
        progressBar.style.transform = 'scaleX(0)';
        return;
      }
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      progressBar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    window.addEventListener('resize', updateScrollProgress, { passive: true });
    updateScrollProgress();
  }

  /* ==================== 2. STEPPER & FOCUS MODE (1 TAHAP) ==================== */
  const stepSections = Array.from(document.querySelectorAll('.step-section'));
  const stepLinks = Array.from(document.querySelectorAll('.step-link'));
  const roadmapLinks = Array.from(document.querySelectorAll('.roadmap-card[data-step-jump]'));
  const focusBtn = document.getElementById('focus-mode-btn');
  const focusToolbarTop = document.getElementById('focus-toolbar-top');
  const focusToolbarBottom = document.getElementById('focus-toolbar-bottom');
  const focusStatusTop = document.getElementById('focus-status-top');
  const focusStatusBottom = document.getElementById('focus-status-bottom');

  let focusMode = false;
  let currentStep = 1;

  function setActiveStepIndicator(stepNum) {
    currentStep = Math.max(1, Math.min(7, stepNum));
    stepLinks.forEach((link) => {
      const linkStep = Number(link.dataset.step);
      if (linkStep === currentStep) {
        link.setAttribute('aria-current', 'step');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function applyFocusView(moveFocusToHeading = false) {
    stepSections.forEach((sec) => {
      const secStep = Number(sec.dataset.step);
      sec.hidden = focusMode && secStep !== currentStep;
    });

    [focusToolbarTop, focusToolbarBottom].forEach((bar) => {
      if (bar) bar.hidden = !focusMode;
    });

    const statusLabel = `Tahap ${currentStep} dari ${stepSections.length}`;
    if (focusStatusTop) focusStatusTop.textContent = statusLabel;
    if (focusStatusBottom) focusStatusBottom.textContent = statusLabel;

    document.querySelectorAll('[data-focus-nav="prev"]').forEach((btn) => {
      btn.disabled = currentStep <= 1;
    });
    document.querySelectorAll('[data-focus-nav="next"]').forEach((btn) => {
      btn.disabled = currentStep >= stepSections.length;
    });

    if (focusMode) {
      const activeSection = stepSections.find((s) => Number(s.dataset.step) === currentStep);
      if (activeSection) {
        if (currentStep === 3) resizeAndDrawField();
        if (moveFocusToHeading) {
          const h2 = activeSection.querySelector('h2');
          if (h2) {
            h2.setAttribute('tabindex', '-1');
            h2.focus({ preventScroll: false });
          }
        }
      }
    }
  }

  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      focusMode = !focusMode;
      focusBtn.setAttribute('aria-pressed', String(focusMode));
      focusBtn.textContent = focusMode ? 'Mode Gulir (Semua Tahap)' : 'Mode Fokus (1 Tahap)';
      applyFocusView(focusMode);
      announce(
        focusMode
          ? `Mode Fokus aktif, menampilkan Tahap ${currentStep} dari 7.`
          : 'Mode Gulir aktif, menampilkan seluruh 7 tahap pembelajaran.'
      );
    });
  }

  document.querySelectorAll('[data-focus-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.focusNav === 'next' ? 1 : -1;
      setActiveStepIndicator(currentStep + dir);
      applyFocusView(true);
      announce(`Menampilkan Tahap ${currentStep} dari 7.`);
    });
  });

  [...stepLinks, ...roadmapLinks].forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetStep = Number(link.dataset.step || link.dataset.stepJump);
      if (!targetStep) return;
      setActiveStepIndicator(targetStep);
      if (focusMode) {
        event.preventDefault();
        applyFocusView(true);
        announce(`Berpindah ke Tahap ${currentStep} dari 7.`);
      }
    });
  });

  if ('IntersectionObserver' in window) {
    const stepObserver = new IntersectionObserver(
      (entries) => {
        if (focusMode) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const stepNum = Number(entry.target.dataset.step);
            if (stepNum) setActiveStepIndicator(stepNum);
          }
        }
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: 0.01 }
    );
    stepSections.forEach((sec) => stepObserver.observe(sec));
    window.addEventListener(
      'scroll',
      () => {
        if (!focusMode && window.scrollY < 180) {
          setActiveStepIndicator(1);
        }
      },
      { passive: true }
    );
  }

  /* ==================== 3. ACCESSIBLE TABS & FIND-IN-PAGE SYNC ==================== */
  const hasNativeFocusGroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup');

  document.querySelectorAll('[data-tabs-widget]').forEach((widget) => {
    const tablist = widget.querySelector('[role="tablist"]');
    const tabs = Array.from(widget.querySelectorAll('[role="tab"]'));
    const panels = Array.from(widget.querySelectorAll('[role="tabpanel"]'));
    if (!tablist || !tabs.length || !panels.length) return;

    function selectTab(targetTab, focusTab = false) {
      const targetId = targetTab.id;
      tabs.forEach((tab) => {
        const isSelected = tab === targetTab;
        tab.setAttribute('aria-selected', String(isSelected));
        tab.toggleAttribute('focusgroupstart', isSelected);
        if (!hasNativeFocusGroup) {
          tab.tabIndex = isSelected ? 0 : -1;
        }
      });

      panels.forEach((panel) => {
        const match = panel.getAttribute('aria-labelledby') === targetId;
        if (match) {
          panel.removeAttribute('hidden');
          panel.tabIndex = 0;
        } else {
          panel.setAttribute('hidden', 'until-found');
          panel.removeAttribute('tabindex');
        }
      });

      targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (focusTab) targetTab.focus();
    }

    tabs.forEach((tab, index) => {
      if (!hasNativeFocusGroup) {
        tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      }

      tab.addEventListener('click', () => {
        selectTab(tab, false);
      });

      if (!hasNativeFocusGroup) {
        tab.addEventListener('keydown', (event) => {
          let nextIndex = -1;
          if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = tabs.length - 1;

          if (nextIndex !== -1) {
            event.preventDefault();
            selectTab(tabs[nextIndex], true);
          }
        });
      }
    });

    panels.forEach((panel) => {
      panel.addEventListener('beforematch', () => {
        const ownerId = panel.getAttribute('aria-labelledby');
        const ownerTab = tabs.find((t) => t.id === ownerId);
        if (ownerTab) selectTab(ownerTab, false);
      });
    });
  });

  /* ==================== 4. TAHAP 2: EXPLODED LAYER INSPECTOR ==================== */
  const layerData = {
    cover: {
      badge: 'Lapisan 1 · Isolator Dielektrik',
      title: 'Kaca Pelindung (Cover Glass)',
      material: 'Aluminosilikat diperkuat (contoh: Gorilla Glass), konstanta dielektrik εᵣ ≈ 5–7',
      conductivity: 'Isolator transparan — menahan arus DC, tetapi dapat ditembus medan listrik AC',
      role: 'Melindungi elektroda ITO dari goresan serta menjadi medium dielektrik tempat medan listrik tepi (fringing field) menjalar keluar menuju kulit jari.'
    },
    rx: {
      badge: 'Lapisan 2 · Konduktor Transparan',
      title: 'Elektroda Baris Rx (Receiver)',
      material: 'Indium Tin Oxide (ITO) tipis berskala nanometer (~20–50 nm)',
      conductivity: 'Konduktor transparan — menghantarkan sinyal listrik sekaligus meloloskan >90% cahaya tampak',
      role: 'Menerima garis medan listrik dan menampung muatan terinduksi (−Q). Ketika jari mencuri sebagian fluks medan, jumlah muatan di Rx berkurang dan terdeteksi chip sensor.'
    },
    dielectric: {
      badge: 'Lapisan 3 · Isolator Pemisah',
      title: 'Lapisan Isolator Dielektrik Tipis',
      material: 'Silikon dioksida (SiO₂) atau polimer optis jernih (OCA)',
      conductivity: 'Isolator murni — mencegah korsleting (short circuit) antara jalur Rx dan Tx',
      role: 'Memisahkan elektroda baris Rx dan kolom Tx dengan jarak tetap sangat tipis (d) sehingga setiap titik persilangan membentuk kapasitor mikro.'
    },
    tx: {
      badge: 'Lapisan 4 · Konduktor Transparan',
      title: 'Elektroda Kolom Tx (Transmitter)',
      material: 'Indium Tin Oxide (ITO) dalam pola jalur kolom berjajar',
      conductivity: 'Konduktor transparan beresistivitas rendah',
      role: 'Dipacu pulsa tegangan AC frekuensi tinggi (~100–300 kHz) secara bergantian untuk memancarkan medan listrik menuju elektroda Rx dan permukaan atas kaca.'
    },
    display: {
      badge: 'Lapisan 5 · Panel Visual',
      title: 'Panel Display (OLED / LCD)',
      material: 'Subpiksel dioda organik pemancar cahaya (OLED) atau kristal cair (LCD)',
      conductivity: 'Terpisah dari modul sensor sentuh dan dilengkapi lapisan pelindung interferensi elektromagnetik',
      role: 'Menghasilkan gambar, ikon, dan teks antarmuka tepat di bawah kisi sensor sentuh transparan.'
    }
  };

  const explodeSlider = document.getElementById('explode-slider');
  const explodeOut = document.getElementById('explode-out');
  const layerStack = document.getElementById('layer-stack');
  const layerButtons = Array.from(document.querySelectorAll('.layer-card'));

  const layerBadge = document.getElementById('layer-badge');
  const layerTitle = document.getElementById('layer-title');
  const layerMaterial = document.getElementById('layer-material');
  const layerConductivity = document.getElementById('layer-conductivity');
  const layerRole = document.getElementById('layer-role');

  if (explodeSlider && layerStack) {
    const syncExplode = () => {
      const val = Number(explodeSlider.value);
      if (explodeOut) explodeOut.value = String(val);
      const px = (val / 100) * 22;
      layerStack.style.setProperty('--explode-px', `${px.toFixed(1)}px`);
    };
    explodeSlider.addEventListener('input', syncExplode);
    syncExplode();
  }

  layerButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.layer;
      const info = layerData[key];
      if (!info) return;

      layerButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      if (layerBadge) layerBadge.textContent = info.badge;
      if (layerTitle) layerTitle.textContent = info.title;
      if (layerMaterial) layerMaterial.textContent = info.material;
      if (layerConductivity) layerConductivity.textContent = info.conductivity;
      if (layerRole) layerRole.textContent = info.role;
      announce(`Menampilkan detail ${info.title}.`);
    });
  });

  /* ==================== 5. TAHAP 3: CANVAS FRINGING FIELD SIMULATION ==================== */
  const canvas = document.getElementById('field-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const distSlider = document.getElementById('finger-distance');
  const distOut = document.getElementById('distance-out');
  const btnTouchZero = document.getElementById('btn-touch-zero');
  const btnLiftTen = document.getElementById('btn-lift-ten');
  const btnToggleAnim = document.getElementById('toggle-field-anim');
  const fieldCaption = document.getElementById('field-caption');

  const metricDist = document.getElementById('metric-distance');
  const metricEfield = document.getElementById('metric-efield');
  const metricShunt = document.getElementById('metric-shunt');
  const metricCm = document.getElementById('metric-cm');

  let fingerDistMm = distSlider ? Number(distSlider.value) : 8;
  let animRunning = !prefersReducedMotion.matches;
  let animPhase = 0;
  let rafId = null;

  function syncAnimButtonLabel() {
    if (!btnToggleAnim) return;
    btnToggleAnim.textContent = animRunning ? 'Jeda Animasi' : 'Putar Animasi';
  }

  function updateFieldTelemetry() {
    const closeness = Math.exp(-fingerDistMm / 3.2);
    const efieldPct = Math.round(6 + closeness * 94);
    const shuntPct = Math.round(closeness * 25);
    const cmVal = 2.0 - closeness * 0.44;

    if (distOut) distOut.value = fingerDistMm.toFixed(1);
    if (metricDist) metricDist.textContent = `${fingerDistMm.toFixed(1).replace('.', ',')} mm`;
    if (metricEfield) metricEfield.textContent = `${efieldPct}%`;
    if (metricShunt) metricShunt.textContent = `${shuntPct}%`;
    if (metricCm) metricCm.textContent = `${cmVal.toFixed(2).replace('.', ',')} pF`;

    if (fieldCaption) {
      if (fingerDistMm <= 0.5) {
        fieldCaption.textContent =
          'Saat jari menyentuh kaca (0,0 mm), gaya Coulomb menarik ion negatif ke permukaan kulit dan membelokkan ~25% fluks medan ke tubuh sehingga kapasitansi bersama Cₘ turun dari 2,00 pF ke 1,56 pF.';
      } else if (fingerDistMm <= 4.5) {
        fieldCaption.textContent =
          `Pada jarak ${fingerDistMm.toFixed(1).replace('.', ',')} mm, medan listrik tepi mulai mempolarisasi ujung jari dan membelokkan ${shuntPct}% garis medan menuju tubuh.`;
      } else {
        fieldCaption.textContent =
          `Pada jarak ${fingerDistMm.toFixed(1).replace('.', ',')} mm, hampir seluruh garis medan listrik melengkung utuh dari elektroda Tx (+) menuju elektroda Rx (−).`;
      }
    }
  }

  const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  function getCanvasTheme() {
    const styles = getComputedStyle(document.documentElement);
    const suffix = colorSchemeMedia.matches ? 'dark' : 'light';
    return {
      bg: styles.getPropertyValue(`--canvas-bg-${suffix}`).trim() || (colorSchemeMedia.matches ? '#0f172a' : '#f8fafc'),
      ink: styles.getPropertyValue(`--canvas-ink-${suffix}`).trim() || (colorSchemeMedia.matches ? '#f1f5f9' : '#0f172a'),
      glass: styles.getPropertyValue(`--canvas-glass-${suffix}`).trim() || (colorSchemeMedia.matches ? '#1e3a5f' : '#bae6fd'),
      tx: styles.getPropertyValue(`--canvas-tx-${suffix}`).trim() || (colorSchemeMedia.matches ? '#fb7185' : '#dc2626'),
      rx: styles.getPropertyValue(`--canvas-rx-${suffix}`).trim() || (colorSchemeMedia.matches ? '#38bdf8' : '#0284c7'),
      field: styles.getPropertyValue(`--canvas-field-${suffix}`).trim() || (colorSchemeMedia.matches ? '#7dd3fc' : '#0369a1'),
      shunt: styles.getPropertyValue(`--canvas-shunt-${suffix}`).trim() || (colorSchemeMedia.matches ? '#fbbf24' : '#d97706'),
      skin: styles.getPropertyValue(`--canvas-skin-${suffix}`).trim() || (colorSchemeMedia.matches ? '#9a5b38' : '#fed7aa')
    };
  }

  function drawArrowhead(context, x, y, angle, color) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.beginPath();
    context.moveTo(6, 0);
    context.lineTo(-5, -4);
    context.lineTo(-5, 4);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.restore();
  }

  function evalQuadratic(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      dx: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      dy: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    };
  }

  function drawFieldScene() {
    if (!canvas || !ctx) return;
    const width = 840;
    const height = 400;
    const palette = getCanvasTheme();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);

    const glassTop = 216;
    const glassHeight = 52;
    const rxY = 274;
    const txY = 326;

    // Cover Glass
    ctx.fillStyle = palette.glass;
    ctx.strokeStyle = palette.rx;
    ctx.lineWidth = 2;
    ctx.fillRect(60, glassTop, 720, glassHeight);
    ctx.strokeRect(60, glassTop, 720, glassHeight);

    ctx.fillStyle = palette.ink;
    ctx.font = '700 14px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Kaca Pelindung (Dielektrik)', 76, glassTop + 31);

    // Dielectric spacer band between Rx & Tx
    ctx.fillStyle = palette.bg;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1;
    ctx.fillRect(60, 304, 720, 18);
    ctx.strokeRect(60, 304, 720, 18);
    ctx.fillStyle = palette.ink;
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Isolator Pemisah Dielektrik', 76, 317);

    // Rx electrodes (negative)
    const rxBoxes = [
      { x: 120, w: 170 },
      { x: 550, w: 170 }
    ];
    rxBoxes.forEach((box) => {
      ctx.fillStyle = palette.rx;
      ctx.fillRect(box.x, rxY, box.w, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Rx (−Q)', box.x + box.w / 2, rxY + 17);
    });

    // Tx electrode (positive center transmitter)
    ctx.fillStyle = palette.tx;
    ctx.fillRect(320, txY, 200, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Tx (+Q) Pemancar', 420, txY + 20);

    // Finger geometry based on fingerDistMm (0 -> touches glassTop at 216, 10 -> sits at 78)
    const closeness = Math.exp(-fingerDistMm / 3.2);
    const tipY = glassTop - fingerDistMm * 13.5;
    const fingerTop = tipY - 120;

    // Electric field lines from Tx (+Q) to Rx (-Q) or shunted to finger
    const lines = [
      { sx: 345, sy: txY, cx: 265, cy: 148, ex: 245, ey: rxY, shunted: false },
      { sx: 375, sy: txY, cx: 295, cy: 112, ex: 268, ey: rxY, shunted: true },
      { sx: 465, sy: txY, cx: 545, cy: 112, ex: 572, ey: rxY, shunted: true },
      { sx: 495, sy: txY, cx: 575, cy: 148, ex: 595, ey: rxY, shunted: false },
      { sx: 420, sy: txY, cx: 345, cy: 132, ex: 220, ey: rxY, shunted: true }
    ];

    lines.forEach((ln, idx) => {
      const isShunted = ln.shunted && closeness > 0.35;
      const p0 = { x: ln.sx, y: ln.sy };
      let p1 = { x: ln.cx, y: ln.cy };
      let p2 = { x: ln.ex, y: ln.ey };
      let strokeColor = palette.field;

      if (isShunted) {
        const fingerTargetX = idx === 1 ? 395 : idx === 2 ? 445 : 420;
        const target = { x: fingerTargetX, y: Math.max(24, tipY - 4) };
        const ctrl = {
          x: (ln.sx + fingerTargetX) * 0.5 + (idx === 1 ? -40 : idx === 2 ? 40 : 0),
          y: (ln.sy + tipY) * 0.5
        };
        const blend = Math.min(1, (closeness - 0.35) / 0.55);
        p1 = {
          x: ln.cx + (ctrl.x - ln.cx) * blend,
          y: ln.cy + (ctrl.y - ln.cy) * blend
        };
        p2 = {
          x: ln.ex + (target.x - ln.ex) * blend,
          y: ln.ey + (target.y - ln.ey) * blend
        };
        if (blend > 0.4) strokeColor = palette.shunt;
      }

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isShunted ? 3 : 2.2;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -animPhase * 18;
      ctx.stroke();
      ctx.setLineDash([]);

      const mid = evalQuadratic(p0, p1, p2, 0.55);
      drawArrowhead(ctx, mid.x, mid.y, Math.atan2(mid.dy, mid.dx), strokeColor);
    });

    // Draw Finger above cover glass
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(366, Math.max(0, fingerTop));
    ctx.lineTo(366, tipY - 38);
    ctx.quadraticCurveTo(366, tipY, 420, tipY);
    ctx.quadraticCurveTo(474, tipY, 474, tipY - 38);
    ctx.lineTo(474, Math.max(0, fingerTop));
    ctx.closePath();
    ctx.fillStyle = palette.skin;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Polarized ions inside fingertip
    const ionSpread = 1 - closeness * 0.4;
    const negY = tipY - 14;
    const posY = tipY - 46 - ionSpread * 12;

    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    [-24, 0, 24].forEach((ox) => {
      ctx.fillStyle = palette.rx;
      ctx.fillText('−', 420 + ox, negY);
      ctx.fillStyle = palette.tx;
      ctx.fillText('+', 420 + ox, posY);
    });

    ctx.fillStyle = palette.ink;
    ctx.font = '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Jari Manusia', 420, Math.max(18, tipY - 96));
    ctx.fillText('(Ion Elektrolit)', 420, Math.max(34, tipY - 80));
    ctx.restore();

    // Ground connection indicator on top right of finger
    ctx.fillStyle = palette.ink;
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Panah Oranye = Fluks dibelokkan ke jari', 535, 36);
    ctx.fillText('Panah Biru = Fluks penuh Tx → Rx', 535, 56);
  }

  function resizeAndDrawField() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = 840 * dpr;
    const targetH = 400 * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFieldScene();
  }

  function stepAnimation(timestamp) {
    if (!animRunning) {
      rafId = null;
      return;
    }
    animPhase = (timestamp * 0.001) % 10;
    resizeAndDrawField();
    rafId = window.requestAnimationFrame(stepAnimation);
  }

  function startOrStopAnimation() {
    syncAnimButtonLabel();
    if (animRunning && rafId === null) {
      rafId = window.requestAnimationFrame(stepAnimation);
    } else if (!animRunning && rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
      resizeAndDrawField();
    } else {
      resizeAndDrawField();
    }
  }

  if (distSlider) {
    distSlider.addEventListener('input', () => {
      fingerDistMm = Number(distSlider.value);
      updateFieldTelemetry();
      resizeAndDrawField();
    });
  }

  if (btnTouchZero) {
    btnTouchZero.addEventListener('click', () => {
      fingerDistMm = 0;
      if (distSlider) distSlider.value = '0';
      updateFieldTelemetry();
      resizeAndDrawField();
      announce('Jari menyentuh kaca pada jarak 0 milimeter. Kapasitansi bersama turun menjadi 1,56 pikofarad.');
    });
  }

  if (btnLiftTen) {
    btnLiftTen.addEventListener('click', () => {
      fingerDistMm = 10;
      if (distSlider) distSlider.value = '10';
      updateFieldTelemetry();
      resizeAndDrawField();
      announce('Jari diangkat ke jarak 10 milimeter. Kapasitansi kembali ke nilai dasar 1,99 pikofarad.');
    });
  }

  if (btnToggleAnim) {
    btnToggleAnim.addEventListener('click', () => {
      animRunning = !animRunning;
      startOrStopAnimation();
      announce(animRunning ? 'Animasi medan listrik diputar.' : 'Animasi medan listrik dijeda.');
    });
  }

  colorSchemeMedia.addEventListener('change', () => {
    resizeAndDrawField();
  });

  prefersReducedMotion.addEventListener('change', (event) => {
    if (event.matches) {
      animRunning = false;
      startOrStopAnimation();
    }
  });

  updateFieldTelemetry();
  startOrStopAnimation();

  /* ==================== 6. TAHAP 5: 6x8 CAPACITIVE MATRIX LAB ==================== */
  const ROWS = 6;
  const COLS = 8;
  const BASELINE_PF = 2.0;
  const THRESHOLD_PF = 0.18;

  const materialProfiles = {
    finger: {
      peakDelta: 0.44,
      spread: 1.15,
      mode: 'detected',
      desc: 'Ion elektrolit di kulit jari membelokkan medan tepi Tx→Rx ke tubuh (ground), menurunkan Cₘ di simpul sekitar sebesar 0,44 pF.'
    },
    wool: {
      peakDelta: 0.02,
      spread: 1.25,
      mode: 'below',
      desc: 'Serat kain wol bersifat isolator (tiada muatan bebas) dan memperbesar jarak d sehingga perubahan ΔC hanya ~0,02 pF—gagal melewati ambang 0,18 pF.'
    },
    'conductive-glove': {
      peakDelta: 0.36,
      spread: 1.2,
      mode: 'detected',
      desc: 'Benang perak/karbon pada ujung sarung tangan menghubungkan medan listrik kaca kembali ke kulit jari sehingga perubahan ΔC sebesar 0,36 pF terbaca sensor.'
    },
    plastic: {
      peakDelta: 0.01,
      spread: 0.85,
      mode: 'below',
      desc: 'Stylus plastik biasa merupakan isolator padat tanpa jalur konduksi ke tubuh manusia. ΔC (~0,01 pF) nyaris tak berbeda dari noise latar.'
    },
    'capacitive-stylus': {
      peakDelta: 0.4,
      spread: 1.05,
      mode: 'detected',
      desc: 'Ujung karet konduktif menyalurkan interaksi medan listrik ke bodi logam stylus yang digenggam tangan, menghasilkan ΔC sebesar 0,40 pF.'
    },
    water: {
      peakDelta: 0.27,
      spread: 2.35,
      mode: 'noise',
      desc: 'Tetesan air bersifat konduktif tetapi tidak ter-ground ke tubuh secara terpusat; air menyebar lebar dan memicu sinyal acak/palsu (gangguan deteksi).'
    }
  };

  const sensorGrid = document.getElementById('sensor-grid');
  const multitouchToggle = document.getElementById('multitouch-toggle');
  const labStatusBadge = document.getElementById('lab-status-badge');
  const labStatusIcon = document.getElementById('lab-status-icon');
  const labStatusText = document.getElementById('lab-status-text');
  const labDeltaVal = document.getElementById('lab-delta-val');
  const labSignalFill = document.getElementById('lab-signal-fill');
  const labCoords = document.getElementById('lab-coords');
  const labMaterialDesc = document.getElementById('lab-material-desc');

  let activeMaterial = 'finger';
  let touchPoints = [{ r: 2, c: 3 }];
  let isDragging = false;
  const nodeButtons = [];

  if (sensorGrid) {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sensor-node';
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        btn.setAttribute('aria-label', `Simpul baris ${r + 1} kolom ${c + 1}`);
        btn.textContent = '2.00';
        sensorGrid.appendChild(btn);
        nodeButtons.push(btn);
      }
    }
  }

  function setPrimaryTouch(r, c) {
    if (multitouchToggle && multitouchToggle.checked) {
      const r2 = (r + 2) % ROWS;
      const c2 = (c + 3) % COLS;
      touchPoints = [
        { r, c },
        { r: r2, c: c2 }
      ];
    } else {
      touchPoints = [{ r, c }];
    }
    renderSensorGrid();
  }

  function renderSensorGrid() {
    const profile = materialProfiles[activeMaterial] || materialProfiles.finger;
    let maxDelta = 0;

    nodeButtons.forEach((btn) => {
      const r = Number(btn.dataset.row);
      const c = Number(btn.dataset.col);
      let totalDelta = 0;

      touchPoints.forEach((pt, pIdx) => {
        const distSq = (r - pt.r) ** 2 + (c - pt.c) ** 2;
        const spread = profile.spread;
        let contribution = profile.peakDelta * Math.exp(-distSq / spread);
        if (profile.mode === 'noise') {
          const jitter = ((r * 3 + c * 5 + pIdx) % 4) * 0.03;
          contribution = Math.max(0, contribution - jitter);
        }
        totalDelta = Math.max(totalDelta, contribution);
      });

      if (touchPoints.length === 0) totalDelta = 0;
      maxDelta = Math.max(maxDelta, totalDelta);

      const capVal = Math.max(0.5, BASELINE_PF - totalDelta);
      btn.textContent = capVal.toFixed(2);
      btn.setAttribute(
        'aria-label',
        `Simpul baris ${r + 1} kolom ${c + 1}: ${capVal.toFixed(2)} pikofarad`
      );

      if (touchPoints.length === 0 || totalDelta < 0.04) {
        btn.dataset.intensity = 'none';
      } else if (profile.mode === 'noise' && totalDelta >= 0.1) {
        btn.dataset.intensity = 'noise';
      } else if (totalDelta >= 0.3) {
        btn.dataset.intensity = 'high';
      } else if (totalDelta >= 0.18) {
        btn.dataset.intensity = 'mid';
      } else {
        btn.dataset.intensity = 'low';
      }
    });

    if (labDeltaVal) {
      labDeltaVal.textContent = `${maxDelta.toFixed(2).replace('.', ',')} pF`;
    }
    if (labSignalFill) {
      const scaleRatio = Math.min(1, maxDelta / 0.6);
      labSignalFill.style.transform = `scaleX(${scaleRatio.toFixed(3)})`;
    }

    if (labStatusBadge && labStatusIcon && labStatusText) {
      if (touchPoints.length === 0) {
        labStatusBadge.dataset.state = 'below';
        labStatusIcon.textContent = '○';
        labStatusText.textContent = 'Tidak Ada Objek Menyentuh Layar';
      } else if (profile.mode === 'noise') {
        labStatusBadge.dataset.state = 'noise';
        labStatusIcon.textContent = '⚠';
        labStatusText.textContent = 'Gangguan Sinyal (Tersebar Tidak Teratur)';
      } else if (maxDelta >= THRESHOLD_PF) {
        labStatusBadge.dataset.state = 'detected';
        labStatusIcon.textContent = '✓';
        labStatusText.textContent =
          touchPoints.length > 1 ? 'Multi-Touch Terdeteksi (2 Titik)' : 'Sentuhan Terdeteksi';
      } else {
        labStatusBadge.dataset.state = 'below';
        labStatusIcon.textContent = '✕';
        labStatusText.textContent = 'Di Bawah Ambang Batas (Tidak Terdeteksi)';
      }
    }

    if (labCoords) {
      if (touchPoints.length === 0) {
        labCoords.textContent = '— (Layar bersih, baseline 2,00 pF)';
      } else if (maxDelta < THRESHOLD_PF) {
        labCoords.textContent = 'Ditolak pengendali (|ΔC| < 0,18 pF)';
      } else if (profile.mode === 'noise') {
        labCoords.textContent = `Anomali area luas sekitar (${touchPoints[0].c + 1}, ${touchPoints[0].r + 1})`;
      } else {
        labCoords.textContent = touchPoints
          .map((pt, i) => `Jari ${i + 1}: (x = ${(pt.c + 1).toFixed(1).replace('.', ',')} , y = ${(pt.r + 1).toFixed(1).replace('.', ',')})`)
          .join('  |  ');
      }
    }

    if (labMaterialDesc) {
      labMaterialDesc.textContent = profile.desc;
    }
  }

  if (sensorGrid) {
    const pickNodeFromPoint = (clientX, clientY) => {
      const target = document.elementFromPoint(clientX, clientY);
      const node = target ? target.closest('.sensor-node') : null;
      if (node && sensorGrid.contains(node)) {
        setPrimaryTouch(Number(node.dataset.row), Number(node.dataset.col));
      }
    };

    sensorGrid.addEventListener('pointerdown', (event) => {
      const node = event.target.closest('.sensor-node');
      if (!node) return;
      isDragging = true;
      sensorGrid.setPointerCapture(event.pointerId);
      setPrimaryTouch(Number(node.dataset.row), Number(node.dataset.col));
    });

    sensorGrid.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      pickNodeFromPoint(event.clientX, event.clientY);
    });

    const stopDrag = () => {
      isDragging = false;
    };
    sensorGrid.addEventListener('pointerup', stopDrag);
    sensorGrid.addEventListener('pointercancel', stopDrag);

    sensorGrid.addEventListener('click', (event) => {
      const node = event.target.closest('.sensor-node');
      if (!node) return;
      setPrimaryTouch(Number(node.dataset.row), Number(node.dataset.col));
    });
  }

  document.querySelectorAll('input[name="touch-material"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      activeMaterial = radio.value;
      if (touchPoints.length === 0) touchPoints = [{ r: 2, c: 3 }];
      renderSensorGrid();
      announce(`Objek diubah ke ${radio.labels?.[0]?.querySelector('strong')?.textContent || activeMaterial}.`);
    });
  });

  if (multitouchToggle) {
    multitouchToggle.addEventListener('change', () => {
      const base = touchPoints[0] || { r: 2, c: 3 };
      setPrimaryTouch(base.r, base.c);
      announce(multitouchToggle.checked ? 'Mode Multi-Touch dua jari aktif.' : 'Mode Single-Touch aktif.');
    });
  }

  document.getElementById('preset-center')?.addEventListener('click', () => {
    setPrimaryTouch(2, 3);
    announce('Simulasi menyentuh pusat kisi pada koordinat 4, 3.');
  });

  document.getElementById('preset-corner')?.addEventListener('click', () => {
    setPrimaryTouch(0, 5);
    announce('Simulasi menyentuh sudut kanan atas pada koordinat 6, 1.');
  });

  document.getElementById('preset-clear')?.addEventListener('click', () => {
    touchPoints = [];
    renderSensorGrid();
    announce('Objek diangkat dari layar, semua simpul kembali ke 2,00 pikofarad.');
  });

  renderSensorGrid();

  /* ==================== 7. TAHAP 7: ACCORDION EXPAND/COLLAPSE ALL ==================== */
  const accordion = document.getElementById('diskusi-accordion');
  const toggleAllBtn = accordion?.querySelector('[command="--toggle-all"]');

  function runToggleAll() {
    if (!accordion || !toggleAllBtn) return;
    const shouldOpen = toggleAllBtn.getAttribute('aria-expanded') !== 'true';
    accordion.querySelectorAll(':scope > details').forEach((item) => {
      item.open = shouldOpen;
    });
  }

  if (accordion && toggleAllBtn) {
    if (Object.hasOwn(HTMLButtonElement.prototype, 'commandForElement')) {
      document.addEventListener(
        'command',
        (event) => {
          if (event.command !== '--toggle-all' || event.target !== accordion) return;
          runToggleAll();
        },
        { capture: true }
      );
    } else {
      toggleAllBtn.addEventListener('click', runToggleAll);
    }

    document.addEventListener(
      'toggle',
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLDetailsElement) || target.parentElement !== accordion) return;
        const items = Array.from(accordion.querySelectorAll(':scope > details'));
        const allOpen = items.every((d) => d.open);
        toggleAllBtn.setAttribute('aria-expanded', String(allOpen));
      },
      { capture: true }
    );
  }

  /* ==================== 8. CHALLENGE QUESTION & MINI QUIZ ==================== */
  const challengeAnswer = document.getElementById('challenge-answer');
  const challengeFeedback = document.getElementById('challenge-feedback');

  document.querySelectorAll('.challenge-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.choice;
      if (!challengeAnswer || !challengeFeedback) return;
      challengeAnswer.hidden = false;
      challengeFeedback.textContent =
        choice === 'no'
          ? '✓ Tepat sekali! Benda yang netral secara keseluruhan tetap dapat mengalami gaya listrik total apabila berada dalam medan listrik yang tidak seragam.'
          : '✕ Hampir tepat untuk medan seragam, tetapi jawabannya TIDAK harus bermuatan total! Benda netral tetap mengalami gaya listrik akibat polarisasi muatan dalam medan tidak seragam.';
      announce('Pembahasan Pertanyaan Tantangan ditampilkan.');
    });
  });

  const quizForm = document.getElementById('mini-quiz');
  const quizResetBtn = document.getElementById('quiz-reset');
  const quizScoreEl = document.getElementById('quiz-score');

  const quizKey = {
    q1: {
      ans: 'b',
      explain: 'Benar! Indium Tin Oxide (ITO) transparan terhadap cahaya tampak namun menghantarkan listrik.'
    },
    q2: {
      ans: 'a',
      explain: 'Benar! Jari mengalihkan sebagian garis medan tepi ke ground sehingga Q_Rx dan Cₘ menurun.'
    },
    q3: {
      ans: 'a',
      explain: 'Benar! Kain wol adalah isolator dan menambah jarak d sehingga |ΔC| terlalu kecil (< 0,18 pF).'
    },
    q4: {
      ans: 'b',
      explain: 'Benar! Benda netral tetap terpolarisasi oleh medan tidak seragam sehingga F_tarik > F_tolak.'
    }
  };

  if (quizForm) {
    quizForm.addEventListener('submit', (event) => {
      event.preventDefault();
      let score = 0;
      const total = Object.keys(quizKey).length;

      Object.entries(quizKey).forEach(([qName, info]) => {
        const selected = quizForm.querySelector(`input[name="${qName}"]:checked`);
        const feedbackEl = document.getElementById(`${qName}-feedback`);
        if (!feedbackEl) return;

        feedbackEl.hidden = false;
        if (!selected) {
          feedbackEl.dataset.correct = 'false';
          feedbackEl.textContent = 'Pilih salah satu jawaban terlebih dahulu.';
        } else if (selected.value === info.ans) {
          score += 1;
          feedbackEl.dataset.correct = 'true';
          feedbackEl.textContent = `✓ ${info.explain}`;
        } else {
          feedbackEl.dataset.correct = 'false';
          feedbackEl.textContent = `✕ Belum tepat. ${info.explain.replace(/^Benar!\s*/, '')}`;
        }
      });

      if (quizScoreEl) {
        quizScoreEl.hidden = false;
        quizScoreEl.textContent = `Skor Anda: ${score} dari ${total}`;
      }
      announce(`Hasil mini kuis: skor Anda ${score} dari ${total}.`);
    });
  }

  if (quizResetBtn && quizForm) {
    quizResetBtn.addEventListener('click', () => {
      quizForm.reset();
      Object.keys(quizKey).forEach((qName) => {
        const feedbackEl = document.getElementById(`${qName}-feedback`);
        if (feedbackEl) {
          feedbackEl.hidden = true;
          feedbackEl.textContent = '';
          delete feedbackEl.dataset.correct;
        }
      });
      if (quizScoreEl) {
        quizScoreEl.hidden = true;
        quizScoreEl.textContent = '';
      }
      announce('Mini kuis direset.');
    });
  }
})();
