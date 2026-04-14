'use strict';

/**
 * Test environment setup for isp_final.html
 *
 * Extracts the inline <script> from the single-file HTML app, creates a
 * minimal jsdom document containing every DOM element the script touches,
 * injects mocks for CDN libraries (XLSX, jsPDF, html2canvas, Google APIs),
 * and evaluates the script so all global functions are available for testing.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const HTML_PATH = path.join(__dirname, '..', 'isp_final.html');

// ─── Extract inline <script> block ────────────────────────────────────────────
function extractScript() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // The one big script block starts at the constants section and runs to the end
  const start = html.indexOf('<script>\n/* ═══════════════════════════════════════════════════════════════\n   CONSTANTS');
  const end = html.lastIndexOf('</script>');
  if (start === -1 || end === -1) throw new Error('Could not locate inline <script> block in isp_final.html');
  return html.slice(start + '<script>'.length, end);
}

// ─── Minimal HTML fixture ─────────────────────────────────────────────────────
// Contains every element id that the script accesses without a null-guard.
const MINIMAL_HTML = `<!DOCTYPE html><html><head></head><body>
  <input  id="globalDate"   type="date"  value="2026-04-14">
  <span   id="rptDate"></span>
  <div    id="notaText"></div>
  <div    id="toast"></div>

  <!-- chips (no null guard in chips()) -->
  <span id="chipPend"></span>
  <span id="chipDone"></span>
  <span id="chipProj"></span>
  <span id="chipHist"></span>
  <span id="chipSeg"></span>

  <!-- pool -->
  <input  id="poolSearch"   value="">
  <div    id="poolList"></div>
  <div    id="poolArrow"></div>
  <span   id="poolCount"></span>

  <!-- assignment form -->
  <input  id="fAct"         value="">
  <select id="fProyecto"><option value="">— Sin proyecto —</option></select>
  <select id="fArea">
    <option value="Club de Playa">Club de Playa</option>
    <option value="Centro de Gobierno">Centro de Gobierno</option>
    <option value="Módulo 7">Módulo 7</option>
    <option value="Baños M4">Baños M4</option>
    <option value="Otros">Otros</option>
  </select>
  <input  id="fHora"        value="">
  <input  id="fHoraFin"     value="">
  <div    id="fHint"></div>
  <div    id="assignList"></div>
  <span   id="lzCount"></span>
  <div    id="selBox"></div>
  <div    id="multiCount"></div>
  <button id="btnAsign"></button>
  <span   id="btnAsignTxt"></span>
  <button id="modeSingle"></button>
  <button id="modeMulti"></button>
  <button id="fabBtn"></button>

  <!-- quick acts -->
  <div    id="quickActs"></div>

  <!-- completion modal -->
  <div    id="mComp"></div>
  <span   id="mCompSub"></span>
  <input  id="cHora"        value="">
  <select id="cEst">
    <option value="completada">✅ Completada al 100%</option>
    <option value="parcial">⚠️ Parcialmente</option>
    <option value="no_completada">❌ No completada</option>
  </select>
  <input  id="cObs"         value="">
  <div    id="photoPrevs"></div>

  <!-- nota modal -->
  <div      id="mNota"></div>
  <textarea id="notaInp"></textarea>

  <!-- personal modal -->
  <div    id="mPers"></div>
  <span   id="mPersT"></span>
  <input  id="pmN"          value="">
  <select id="pmA">
    <option value="Club de Playa">Club de Playa</option>
    <option value="Centro de Gobierno">Centro de Gobierno</option>
    <option value="Módulo 7">Módulo 7</option>
    <option value="Baños M4">Baños M4</option>
    <option value="Otros">Otros</option>
  </select>
  <div    id="persColors"></div>
  <div    id="specList"></div>
  <input  id="specInp"      value="">
  <div    id="persListView"></div>
  <div    id="persDetailView"></div>
  <div    id="persGrid"></div>
  <input  id="persSearch"   value="">

  <!-- project modal -->
  <div    id="mProj"></div>
  <span   id="mProjT"></span>
  <input  id="pjN"          value="">
  <input  id="pjD"          value="">
  <select id="pjA">
    <option value="General">General</option>
    <option value="Club de Playa">Club de Playa</option>
    <option value="Centro de Gobierno">Centro de Gobierno</option>
  </select>
  <select id="pjE">
    <option value="activo">activo</option>
    <option value="completado">completado</option>
    <option value="pausado">pausado</option>
  </select>
  <input  id="pjFI"         value="">
  <input  id="pjFF"         value="">
  <div    id="projColors"></div>
  <div    id="projGrid"></div>
  <input  id="projSearch"   value="">
  <div    id="projListView"></div>
  <div    id="projDetailView"></div>

  <!-- activity (actfreq) modal -->
  <div    id="mAct"></div>
  <span   id="mActT"></span>
  <input  id="afN"          value="">
  <select id="afA"><option value="General">General</option></select>
  <input  id="afE"          value="🔧">
  <div    id="actsGrid"></div>
  <input  id="actSearch"    value="">

  <!-- historial -->
  <div    id="histList"></div>
  <input  id="histSearch"   value="">

  <!-- share modal -->
  <div    id="mShare"></div>
  <div    id="shareList"></div>

  <!-- areas modal -->
  <div    id="mAreas"></div>
  <div    id="areasList"></div>
  <input  id="newAreaInp"   value="">

  <!-- memory pill -->
  <div    id="memPill"></div>
  <span   id="memCount"></span>

  <!-- export / preview modal -->
  <div    id="mExport"></div>
  <div    id="mPrev"></div>
  <div    id="prevPage"></div>
  <span   id="prevTitle"></span>
  <span   id="prevSub"></span>
  <div    id="prevFooter"></div>
  <button id="btnPrevDl"></button>
  <span   id="btnPrevTxt"></span>
  <div    id="dlChips"></div>
  <span   id="expTxt"></span>
  <button id="btnExp"></button>

  <!-- report -->
  <div    id="rptContent"></div>
  <div    id="rptList"></div>
  <div    id="kpiRow"></div>

  <!-- lightbox -->
  <div    id="lightbox"></div>
  <img    id="lbImg">

  <!-- seguimiento -->
  <div    id="segList"></div>
  <div    id="segEmpty"></div>
  <div    id="mSeg"></div>
  <div    id="mSegSub"></div>
  <input  id="segHora"      value="">
  <textarea id="segNotaTxt"></textarea>
  <input  id="segDetalle"   value="">
  <div    id="segGaleria"></div>
  <div    id="segCamera"></div>
  <div    id="segPhotoPrevs"></div>

  <!-- drive modal -->
  <div    id="mDrive"></div>
  <div    id="driveStatus"></div>
  <div    id="driveStatusBox"></div>
  <span   id="driveStatusTxt"></span>
  <div    id="driveSteps"></div>
  <span   id="driveSubtitle"></span>
  <div    id="driveProgWrap"></div>
  <div    id="driveProgFill"></div>
  <a      id="driveLink"    href="#"></a>
  <div    id="driveLinkBox"></div>
  <span   id="driveFileName"></span>
  <button id="btnDriveAction"></button>
  <span   id="btnDriveActionTxt"></span>

  <!-- resumen modal -->
  <div    id="mResumen"></div>
  <div    id="rmTitle"></div>
  <div    id="rmSub"></div>
  <div    id="rmKpis"></div>
  <div    id="rmBody"></div>

  <!-- save location -->
  <span   id="saveLocPath"></span>
  <span   id="saveLoc"></span>
  <button id="btnElegirCarpeta"></button>
  <span   id="fsaNote"></span>

  <!-- navigation pages -->
  <div id="pg-asign"    class="pg on"></div>
  <div id="pg-informe"  class="pg"></div>
  <div id="pg-proyectos" class="pg"></div>
  <div id="pg-personal" class="pg"></div>
  <div id="pg-historial" class="pg"></div>
  <div id="pg-actfreq"  class="pg"></div>

  <!-- filter buttons -->
  <button id="pf-all" class="btn-ghost"></button>
</body></html>`;

// ─── Mock external CDN libraries ──────────────────────────────────────────────
function injectLibraryMocks(win) {
  // XLSX (SheetJS)
  const workbookStore = {};
  win.XLSX = {
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      aoa_to_sheet: rows => ({ _rows: rows }),
      book_append_sheet: (wb, ws, name) => {
        wb.SheetNames.push(name);
        wb.Sheets[name] = ws;
      },
      encode_cell: ({ r, c }) => String.fromCharCode(65 + c) + (r + 1),
    },
    write: () => new Uint8Array(0),
  };

  // jsPDF
  win.jspdf = {
    jsPDF: class {
      constructor() {
        this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
        this._pages = 1;
      }
      addPage() { this._pages++; }
      text() {}
      addImage() {}
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setFillColor() {}
      rect() {}
      line() {}
      save() {}
      output() { return new Uint8Array(0); }
      splitTextToSize(t) { return [t]; }
      getTextWidth() { return 100; }
      autoTable() {}
    },
  };

  // html2canvas
  win.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,AA==' });

  // Google Drive APIs
  win.google = {
    accounts: {
      oauth2: {
        initTokenClient: () => ({ requestAccessToken: () => {} }),
      },
    },
  };
  win.gapi = { load: () => {} };
}

// ─── Build a fresh jsdom window with the app's script evaluated ───────────────
function createTestWindow() {
  const dom = new JSDOM(MINIMAL_HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse(win) {
      injectLibraryMocks(win);
      win.confirm = () => true;
      win.alert = () => {};
      // Provide a stable localStorage via jsdom's built-in storage
    },
  });

  const win = dom.window;

  // Evaluate the app script in this window's context
  const script = extractScript();
  const scriptEl = win.document.createElement('script');
  scriptEl.textContent = script;
  win.document.body.appendChild(scriptEl);

  return win;
}

module.exports = { createTestWindow };
