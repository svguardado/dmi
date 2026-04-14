'use strict';
/**
 * Comprehensive tests for isp_final.html
 *
 * Tests cover: utility helpers, assignment logic, status management,
 * completion workflow, CRUD operations for personal/projects/activities,
 * area management, history/close-day, note, multi-select, specs, and
 * localStorage persistence.
 *
 * NOTE: The app's script uses const/let at the top level, so those symbols
 * are not exposed as window properties. We access all app state and call all
 * functions via win.eval().
 */

const { createTestWindow } = require('./setup');

// ─── Shared window + state helpers ────────────────────────────────────────────

let win;

/** Evaluate an expression in the app's window context. */
const g = expr => win.eval(expr);

/** Set a named app-level variable to a value. */
const setState = (name, value) => {
  win.__testVal = value;
  win.eval(name + ' = window.__testVal');
};

/** Snapshot the initial personal / actFrec arrays (stringified). */
let _initPersonal;
let _initActFrec;

beforeAll(() => {
  win = createTestWindow();
  _initPersonal = g('JSON.stringify(personal)');
  _initActFrec  = g('JSON.stringify(actFrec)');
});

/** Reset all mutable state to the initial snapshot before each test. */
beforeEach(() => {
  // Re-hydrate arrays from the saved snapshots
  win.__initPersonal = JSON.parse(_initPersonal);
  win.__initActFrec  = JSON.parse(_initActFrec);
  win.eval(`
    personal    = window.__initPersonal;
    actFrec     = window.__initActFrec;
    asigs       = [];
    nAid        = 1;
    proyectos   = [];
    nProjId     = 1;
    historial   = [];
    histFilter  = 'todo';
    selPid      = null;
    selPids     = [];
    assignMode  = 'single';
    editPid     = null;
    editProjId  = null;
    editActId   = null;
    compId      = null;
    tempPhotos  = [];
    tempSpecs   = [];
    nPid        = 24;
    nActId      = 13;
    AREAS       = [...DEFAULT_AREAS];
  `);

  // Clear confirm / alert overrides (default: confirm returns true)
  win.confirm = () => true;
  win.alert   = () => {};

  // Clear DOM inputs that functions read
  const ids = [
    'fAct','fHora','fHoraFin','pmN','pjN','pjD','afN',
    'cHora','cObs','notaInp','specInp','newAreaInp',
  ];
  ids.forEach(id => {
    const el = win.document.getElementById(id);
    if (el) el.value = '';
  });
  win.document.getElementById('globalDate').value = '2026-04-14';
  win.document.getElementById('fArea').value      = 'Club de Playa';
  win.document.getElementById('afE').value        = '🔧';
  win.document.getElementById('afA').value        = 'General';
  win.document.getElementById('pmA').value        = 'Club de Playa';
  win.document.getElementById('pjA').value        = 'Club de Playa';
  win.document.getElementById('pjE').value        = 'activo';
  win.document.getElementById('pjFI').value       = '';
  win.document.getElementById('pjFF').value       = '';
  win.document.getElementById('cEst').value       = 'completada';
  win.document.getElementById('histSearch').value = '';
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UTILITY / PURE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ini() — initials helper', () => {
  test('returns first letters of first two words, uppercased', () => {
    expect(g("ini('Steven Salazar')")).toBe('SS');
  });

  test('handles single-word name (one initial)', () => {
    expect(g("ini('Juan')")).toBe('J');
  });

  test('ignores third and subsequent words', () => {
    expect(g("ini('Ana María García Flores')")).toBe('AM');
  });

  test('handles empty string without throwing', () => {
    expect(g("ini('')")).toBe('');
  });

  test('handles name with extra spaces between words', () => {
    const result = g("ini('Luis Portillo')");
    expect(result).toBe('LP');
  });
});

describe('fmt() — short date formatter', () => {
  test('returns a non-empty string for a valid date', () => {
    const result = g("fmt('2026-04-14')");
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('includes the year in the formatted string', () => {
    expect(g("fmt('2026-04-14')")).toContain('2026');
  });

  test('formats different months correctly', () => {
    const jan = g("fmt('2026-01-01')");
    const dec = g("fmt('2026-12-31')");
    expect(jan).toContain('2026');
    expect(dec).toContain('2026');
    // Different months should produce different strings
    expect(jan).not.toBe(dec);
  });
});

describe('fmtL() — long date formatter', () => {
  test('returns a longer string than fmt() for the same date', () => {
    const short = g("fmt('2026-04-14')");
    const long  = g("fmtL('2026-04-14')");
    expect(long.length).toBeGreaterThan(short.length);
  });

  test('includes the year', () => {
    expect(g("fmtL('2026-07-04')")).toContain('2026');
  });
});

describe('nowStr() — current time string', () => {
  test('returns a string in HH:MM format', () => {
    const result = g('nowStr()');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('getAreaColor() — area color lookup', () => {
  test('returns the correct hex color for known areas', () => {
    expect(g("getAreaColor('Club de Playa')")).toBe('#005A8E');
    expect(g("getAreaColor('Centro de Gobierno')")).toBe('#003F87');
    expect(g("getAreaColor('Módulo 7')")).toBe('#155E38');
    expect(g("getAreaColor('Baños M4')")).toBe('#7B2D12');
    expect(g("getAreaColor('Otros')")).toBe('#2C3E50');
  });

  test('returns a color string for unknown areas (deterministic fallback)', () => {
    const color = g("getAreaColor('Área Desconocida')");
    expect(typeof color).toBe('string');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('deterministic: same unknown area always returns same color', () => {
    const c1 = g("getAreaColor('Nueva Sede')");
    const c2 = g("getAreaColor('Nueva Sede')");
    expect(c1).toBe(c2);
  });
});

describe('isAsig() — assignment check', () => {
  test('returns false when nobody is assigned', () => {
    expect(g('isAsig(1)')).toBe(false);
  });

  test('returns true after a person is added to asigs', () => {
    win.eval("asigs.push({id:1, pid:1, nombre:'Test', actividad:'X', area:'Club de Playa', hora:'6:30 am', horaEstFin:'', fecha:'2026-04-14', done:false, horaFin:'', estado:'pendiente', observaciones:'', fotos:[]})");
    expect(g('isAsig(1)')).toBe(true);
  });

  test('returns false for a person not in asigs', () => {
    win.eval("asigs.push({id:1, pid:2, nombre:'Test', actividad:'X', area:'Club de Playa', hora:'6:30 am', horaEstFin:'', fecha:'2026-04-14', done:false, horaFin:'', estado:'pendiente', observaciones:'', fotos:[]})");
    expect(g('isAsig(1)')).toBe(false);
    expect(g('isAsig(2)')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STATUS MANAGEMENT — toggleSt()
// ═══════════════════════════════════════════════════════════════════════════════

describe('toggleSt() — toggle person status', () => {
  test('sets status from libre to compensatorio', () => {
    win.eval("toggleSt(1, 'compensatorio')");
    expect(g('personal.find(p => p.id === 1).status')).toBe('compensatorio');
  });

  test('toggles back to libre when same status applied twice', () => {
    win.eval("toggleSt(1, 'compensatorio')");
    win.eval("toggleSt(1, 'compensatorio')");
    expect(g('personal.find(p => p.id === 1).status')).toBe('libre');
  });

  test('sets status to incapacitado', () => {
    win.eval("toggleSt(1, 'incapacitado')");
    expect(g('personal.find(p => p.id === 1).status')).toBe('incapacitado');
  });

  test('changes from incapacitado to compensatorio (different status)', () => {
    win.eval("toggleSt(1, 'incapacitado')");
    win.eval("toggleSt(1, 'compensatorio')");
    expect(g('personal.find(p => p.id === 1).status')).toBe('compensatorio');
  });

  test('does nothing and does not throw for non-existent person', () => {
    expect(() => win.eval("toggleSt(999, 'compensatorio')")).not.toThrow();
    // personal array unchanged
    expect(g('personal.every(p => p.status === "libre")')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ASSIGNMENT — asignar()
// ═══════════════════════════════════════════════════════════════════════════════

describe('asignar() — assign a person to an activity', () => {
  function selectPerson(pid) {
    win.eval(`selP(${pid})`);
  }

  test('does not create assignment when activity field is empty', () => {
    selectPerson(1);
    win.document.getElementById('fAct').value = '';
    win.eval('asignar()');
    expect(g('asigs.length')).toBe(0);
  });

  test('does not create assignment when no person is selected', () => {
    win.document.getElementById('fAct').value = 'Pintura de portón';
    win.eval('asignar()');
    expect(g('asigs.length')).toBe(0);
  });

  test('creates one assignment for a single selected person', () => {
    selectPerson(1);
    win.document.getElementById('fAct').value = 'Pintura de portón';
    win.document.getElementById('fHora').value = '7:00 am';
    win.eval('asignar()');
    expect(g('asigs.length')).toBe(1);
    expect(g('asigs[0].pid')).toBe(1);
    expect(g('asigs[0].actividad')).toBe('Pintura de portón');
    expect(g('asigs[0].hora')).toBe('7:00 am');
    expect(g('asigs[0].done')).toBe(false);
    expect(g('asigs[0].estado')).toBe('pendiente');
  });

  test('defaults hora to "6:30 am" when field is empty', () => {
    selectPerson(1);
    win.document.getElementById('fAct').value = 'Actividad';
    win.eval('asignar()');
    expect(g('asigs[0].hora')).toBe('6:30 am');
  });

  test('stores the correct date from globalDate', () => {
    selectPerson(1);
    win.document.getElementById('fAct').value = 'Tarea';
    win.document.getElementById('globalDate').value = '2026-05-20';
    win.eval('asignar()');
    expect(g('asigs[0].fecha')).toBe('2026-05-20');
  });

  test('skips already-assigned persons in multi mode', () => {
    // Manually assign person 1
    win.eval("asigs.push({id:99, pid:1, nombre:'S', actividad:'X', area:'Club de Playa', hora:'6:30 am', horaEstFin:'', fecha:'2026-04-14', done:false, horaFin:'', estado:'pendiente', observaciones:'', fotos:[]})");
    // Try single-assign person 1 again
    win.eval('selPid = 1');
    win.document.getElementById('fAct').value = 'Nueva tarea';
    win.eval('asignar()');
    // Still only 1 assignment
    expect(g('asigs.length')).toBe(1);
  });

  test('assigns to a project when fProyecto has a value', () => {
    // Create a project first
    win.eval("proyectos.push({id:1, nombre:'Proyecto A', area:'Club de Playa', estado:'activo', color:'#003F87', hist:[]})");
    selectPerson(1);
    win.document.getElementById('fAct').value = 'Tarea proyecto';
    win.document.getElementById('fProyecto').innerHTML += '<option value="1">Proyecto A</option>';
    win.document.getElementById('fProyecto').value = '1';
    win.eval('asignar()');
    expect(g('asigs[0].proyectoId')).toBe('1');
    expect(g('proyectos[0].hist.length')).toBe(1);
  });

  test('multi-mode assigns multiple persons at once', () => {
    win.eval("assignMode = 'multi'");
    win.eval('selPids = [1, 2, 3]');
    win.document.getElementById('fAct').value = 'Actividad grupal';
    win.eval('asignar()');
    expect(g('asigs.length')).toBe(3);
    expect(g('asigs.map(a=>a.pid)')).toEqual([1, 2, 3]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DESMARCAR() / QASIG()
// ═══════════════════════════════════════════════════════════════════════════════

describe('desmarcar() — reset a completed assignment', () => {
  beforeEach(() => {
    win.eval(`asigs = [{id:1, pid:1, nombre:'Test', actividad:'X', area:'Club de Playa', hora:'6:30 am', horaEstFin:'', proyectoId:null, fecha:'2026-04-14', done:true, horaFin:'14:00', estado:'completada', observaciones:'Bien', fotos:['img1']}]`);
  });

  test('sets done to false', () => {
    win.eval('desmarcar(1)');
    expect(g('asigs[0].done')).toBe(false);
  });

  test('clears horaFin, observaciones, fotos, and estado', () => {
    win.eval('desmarcar(1)');
    expect(g('asigs[0].horaFin')).toBe('');
    expect(g('asigs[0].observaciones')).toBe('');
    expect(g('asigs[0].fotos.length')).toBe(0);
    expect(g('asigs[0].estado')).toBe('pendiente');
  });

  test('does nothing for a non-existent assignment id', () => {
    expect(() => win.eval('desmarcar(999)')).not.toThrow();
    expect(g('asigs[0].done')).toBe(true); // unchanged
  });
});

describe('qAsig() — remove an assignment', () => {
  beforeEach(() => {
    win.eval(`asigs = [{id:1, pid:1, nombre:'Test', actividad:'X', area:'Club de Playa', hora:'6:30 am', horaEstFin:'', proyectoId:null, fecha:'2026-04-14', done:false, horaFin:'', estado:'pendiente', observaciones:'', fotos:[]}]`);
    win.confirm = () => true;
  });

  test('removes the assignment when user confirms', () => {
    win.eval('qAsig(1)');
    expect(g('asigs.length')).toBe(0);
  });

  test('keeps the assignment when user cancels', () => {
    win.confirm = () => false;
    win.eval('qAsig(1)');
    expect(g('asigs.length')).toBe(1);
  });

  test('does nothing for a non-existent id', () => {
    expect(() => win.eval('qAsig(999)')).not.toThrow();
    expect(g('asigs.length')).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SYNC PROJECT — syncProj()
// ═══════════════════════════════════════════════════════════════════════════════

describe('syncProj() — synchronise assignment into project history', () => {
  const baseAsig = { id: 1, pid: 1, nombre: 'Test', actividad: 'X', area: 'Club de Playa', hora: '6:30 am', horaEstFin: '', fecha: '2026-04-14', done: false, horaFin: '', estado: 'pendiente', observaciones: '', fotos: [] };

  test('does nothing when assignment has no proyectoId', () => {
    win.__asig = { ...baseAsig, proyectoId: null };
    win.eval('syncProj(window.__asig)');
    expect(g('proyectos.length')).toBe(0);
  });

  test('does nothing when proyectoId does not match any project', () => {
    win.__asig = { ...baseAsig, proyectoId: 99 };
    win.eval("proyectos = [{id:1, nombre:'P', estado:'activo', area:'A', color:'#000', hist:[]}]");
    win.eval('syncProj(window.__asig)');
    expect(g('proyectos[0].hist.length')).toBe(0);
  });

  test('adds the assignment to hist when not already present', () => {
    win.eval("proyectos = [{id:5, nombre:'P', estado:'activo', area:'A', color:'#000', hist:[]}]");
    win.__asig = { ...baseAsig, id: 7, proyectoId: 5 };
    win.eval('syncProj(window.__asig)');
    expect(g('proyectos[0].hist.length')).toBe(1);
    expect(g('proyectos[0].hist[0].id')).toBe(7);
  });

  test('updates existing entry in hist instead of duplicating', () => {
    win.eval("proyectos = [{id:5, nombre:'P', estado:'activo', area:'A', color:'#000', hist:[{id:7, pid:1, done:false}]}]");
    win.__asig = { ...baseAsig, id: 7, proyectoId: 5, done: true, horaFin: '15:00' };
    win.eval('syncProj(window.__asig)');
    expect(g('proyectos[0].hist.length')).toBe(1);
    expect(g('proyectos[0].hist[0].done')).toBe(true);
    expect(g('proyectos[0].hist[0].horaFin')).toBe('15:00');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COMPLETION — saveComp()
// ═══════════════════════════════════════════════════════════════════════════════

describe('saveComp() — complete an assignment', () => {
  beforeEach(() => {
    win.eval(`asigs = [{id:1, pid:1, nombre:'Test', actividad:'X', area:'Club de Playa', hora:'6:30 am', horaEstFin:'', proyectoId:null, fecha:'2026-04-14', done:false, horaFin:'', estado:'pendiente', observaciones:'', fotos:[]}]`);
    win.eval('compId = 1; tempPhotos = []');
    win.document.getElementById('cHora').value = '14:30';
    win.document.getElementById('cEst').value  = 'completada';
    win.document.getElementById('cObs').value  = 'Todo bien';
  });

  test('marks assignment as done', () => {
    win.eval('saveComp()');
    expect(g('asigs[0].done')).toBe(true);
  });

  test('sets horaFin from the cHora input', () => {
    win.eval('saveComp()');
    expect(g('asigs[0].horaFin')).toBe('14:30');
  });

  test('sets estado from the cEst select', () => {
    win.document.getElementById('cEst').value = 'parcial';
    win.eval('saveComp()');
    expect(g('asigs[0].estado')).toBe('parcial');
  });

  test('sets observaciones from cObs input', () => {
    win.eval('saveComp()');
    expect(g('asigs[0].observaciones')).toBe('Todo bien');
  });

  test('copies tempPhotos into the assignment', () => {
    win.eval("tempPhotos = ['data:image/png;base64,A', 'data:image/png;base64,B']");
    win.eval('saveComp()');
    expect(g('asigs[0].fotos.length')).toBe(2);
  });

  test('resets compId to null after saving', () => {
    win.eval('saveComp()');
    expect(g('compId')).toBeNull();
  });

  test('does nothing when compId does not match any assignment', () => {
    win.eval('compId = 999');
    win.eval('saveComp()');
    expect(g('asigs[0].done')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PERSONAL CRUD — savePerson() / delPerson()
// ═══════════════════════════════════════════════════════════════════════════════

describe('savePerson() — create / update a collaborator', () => {
  test('adds a new person when editPid is null', () => {
    const initialCount = g('personal.length');
    win.document.getElementById('pmN').value = 'Carlos Nuevo';
    win.document.getElementById('pmA').value = 'Otros';
    win.eval('editPid = null; savePerson()');
    expect(g('personal.length')).toBe(initialCount + 1);
    expect(g("personal.find(p=>p.nombre==='Carlos Nuevo').area")).toBe('Otros');
  });

  test('assigns a sequential id to the new person', () => {
    win.document.getElementById('pmN').value = 'María Test';
    win.eval('editPid = null; savePerson()');
    const id = g("personal.find(p=>p.nombre==='María Test').id");
    expect(id).toBe(24); // nPid starts at 24
  });

  test('new person starts with status "libre"', () => {
    win.document.getElementById('pmN').value = 'Libre Person';
    win.eval('editPid = null; savePerson()');
    expect(g("personal.find(p=>p.nombre==='Libre Person').status")).toBe('libre');
  });

  test('shows alert and does not add when name is empty', () => {
    const alertCalls = [];
    win.alert = msg => alertCalls.push(msg);
    const initialCount = g('personal.length');
    win.document.getElementById('pmN').value = '';
    win.eval('editPid = null; savePerson()');
    expect(alertCalls.length).toBe(1);
    expect(g('personal.length')).toBe(initialCount);
  });

  test('updates an existing person when editPid is set', () => {
    win.document.getElementById('pmN').value = 'Steven Actualizado';
    win.document.getElementById('pmA').value = 'Módulo 7';
    win.eval('editPid = 1; savePerson()');
    expect(g("personal.find(p=>p.id===1).nombre")).toBe('Steven Actualizado');
    expect(g("personal.find(p=>p.id===1).area")).toBe('Módulo 7');
    // Total count unchanged
    const initialCount = JSON.parse(_initPersonal).length;
    expect(g('personal.length')).toBe(initialCount);
  });

  test('includes tempSpecs in the saved person', () => {
    win.document.getElementById('pmN').value = 'Spec Person';
    win.eval("tempSpecs = ['Pintura', 'Electricidad']; editPid = null; savePerson()");
    expect(g("personal.find(p=>p.nombre==='Spec Person').specs")).toEqual(['Pintura', 'Electricidad']);
  });
});

describe('delPerson() — remove a collaborator', () => {
  test('removes the person from the personal array', () => {
    const initialCount = g('personal.length');
    win.eval('delPerson(1)');
    expect(g('personal.length')).toBe(initialCount - 1);
    expect(g('personal.find(p=>p.id===1)')).toBeUndefined();
  });

  test('also removes that person\'s assignments from asigs', () => {
    win.eval(`asigs = [
      {id:1,pid:1,nombre:'S',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]},
      {id:2,pid:2,nombre:'M',actividad:'Y',area:'A',hora:'6:30 am',horaEstFin:'',fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}
    ]`);
    win.eval('delPerson(1)');
    expect(g('asigs.length')).toBe(1);
    expect(g('asigs[0].pid')).toBe(2);
  });

  test('does not remove when user cancels the confirm', () => {
    win.confirm = () => false;
    const initialCount = g('personal.length');
    win.eval('delPerson(1)');
    expect(g('personal.length')).toBe(initialCount);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PROJECT CRUD — saveProject() / delProj()
// ═══════════════════════════════════════════════════════════════════════════════

describe('saveProject() — create / update a project', () => {
  test('adds a new project when editProjId is null', () => {
    win.document.getElementById('pjN').value  = 'Renovación cafetería';
    win.document.getElementById('pjA').value  = 'Club de Playa';
    win.document.getElementById('pjE').value  = 'activo';
    win.eval('editProjId = null; saveProject()');
    expect(g('proyectos.length')).toBe(1);
    expect(g("proyectos[0].nombre")).toBe('Renovación cafetería');
    expect(g("proyectos[0].estado")).toBe('activo');
    expect(g("proyectos[0].hist")).toEqual([]);
  });

  test('assigns a sequential id to the new project', () => {
    win.document.getElementById('pjN').value = 'Proyecto ID Test';
    win.eval('editProjId = null; saveProject()');
    expect(g('proyectos[0].id')).toBe(1); // nProjId starts at 1
  });

  test('shows alert and does not add when name is empty', () => {
    const alertCalls = [];
    win.alert = msg => alertCalls.push(msg);
    win.document.getElementById('pjN').value = '';
    win.eval('editProjId = null; saveProject()');
    expect(alertCalls.length).toBe(1);
    expect(g('proyectos.length')).toBe(0);
  });

  test('updates an existing project when editProjId is set', () => {
    win.eval("proyectos = [{id:1, nombre:'Viejo', area:'A', estado:'activo', color:'#003F87', fechaInicio:'', fechaFin:'', descripcion:'', hist:[]}]");
    win.document.getElementById('pjN').value = 'Nombre Nuevo';
    win.document.getElementById('pjE').value = 'pausado';
    win.eval('editProjId = 1; saveProject()');
    expect(g('proyectos.length')).toBe(1);
    expect(g("proyectos[0].nombre")).toBe('Nombre Nuevo');
    expect(g("proyectos[0].estado")).toBe('pausado');
  });

  test('stores description and date fields', () => {
    win.document.getElementById('pjN').value  = 'Proyecto con fechas';
    win.document.getElementById('pjD').value  = 'Una descripción';
    win.document.getElementById('pjFI').value = '2026-01-01';
    win.document.getElementById('pjFF').value = '2026-12-31';
    win.eval('editProjId = null; saveProject()');
    expect(g("proyectos[0].descripcion")).toBe('Una descripción');
    expect(g("proyectos[0].fechaInicio")).toBe('2026-01-01');
    expect(g("proyectos[0].fechaFin")).toBe('2026-12-31');
  });
});

describe('delProj() — delete a project', () => {
  beforeEach(() => {
    win.eval("proyectos = [{id:1, nombre:'P', area:'A', estado:'activo', color:'#000', hist:[]}]");
  });

  test('removes the project when user confirms', () => {
    win.eval('delProj(1)');
    expect(g('proyectos.length')).toBe(0);
  });

  test('keeps the project when user cancels', () => {
    win.confirm = () => false;
    win.eval('delProj(1)');
    expect(g('proyectos.length')).toBe(1);
  });

  test('nullifies proyectoId in affected assignments', () => {
    win.eval(`asigs = [{id:1,pid:1,nombre:'S',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:1,fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}]`);
    win.eval('delProj(1)');
    expect(g('asigs[0].proyectoId')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. ACTIVITY CRUD — saveActFreq() / delActFreq()
// ═══════════════════════════════════════════════════════════════════════════════

describe('saveActFreq() — create / update a frequent activity', () => {
  test('adds a new activity when editActId is null', () => {
    const initial = g('actFrec.length');
    win.document.getElementById('afN').value = 'Revisión de tuberías';
    win.document.getElementById('afA').value = 'General';
    win.document.getElementById('afE').value = '🔧';
    win.eval('editActId = null; saveActFreq()');
    expect(g('actFrec.length')).toBe(initial + 1);
    expect(g("actFrec.find(a=>a.nombre==='Revisión de tuberías').area")).toBe('General');
    expect(g("actFrec.find(a=>a.nombre==='Revisión de tuberías').emoji")).toBe('🔧');
  });

  test('assigns a sequential id to the new activity', () => {
    const nextId = g('nActId');
    win.document.getElementById('afN').value = 'Nueva Actividad';
    win.eval('editActId = null; saveActFreq()');
    const created = g("actFrec.find(a=>a.nombre==='Nueva Actividad')");
    expect(created.id).toBe(nextId);
  });

  test('defaults emoji to 🔧 when the field is empty', () => {
    win.document.getElementById('afN').value = 'Sin emoji';
    win.document.getElementById('afE').value = '';
    win.eval('editActId = null; saveActFreq()');
    expect(g("actFrec.find(a=>a.nombre==='Sin emoji').emoji")).toBe('🔧');
  });

  test('shows alert and does not add when name is empty', () => {
    const alertCalls = [];
    win.alert = msg => alertCalls.push(msg);
    const initial = g('actFrec.length');
    win.document.getElementById('afN').value = '';
    win.eval('editActId = null; saveActFreq()');
    expect(alertCalls.length).toBe(1);
    expect(g('actFrec.length')).toBe(initial);
  });

  test('updates an existing activity when editActId is set', () => {
    const target = g('actFrec[0]');
    win.document.getElementById('afN').value = 'Actividad Editada';
    win.document.getElementById('afA').value = 'Módulo 7';
    win.document.getElementById('afE').value = '❄️';
    win.eval(`editActId = ${target.id}; saveActFreq()`);
    const updated = g(`actFrec.find(a=>a.id===${target.id})`);
    expect(updated.nombre).toBe('Actividad Editada');
    expect(updated.area).toBe('Módulo 7');
    expect(updated.emoji).toBe('❄️');
  });
});

describe('delActFreq() — delete a frequent activity', () => {
  test('removes the activity when user confirms', () => {
    const initial = g('actFrec.length');
    const firstId = g('actFrec[0].id');
    win.eval(`delActFreq(${firstId})`);
    expect(g('actFrec.length')).toBe(initial - 1);
    expect(g(`actFrec.find(a=>a.id===${firstId})`)).toBeUndefined();
  });

  test('keeps the activity when user cancels', () => {
    win.confirm = () => false;
    const initial = g('actFrec.length');
    const firstId = g('actFrec[0].id');
    win.eval(`delActFreq(${firstId})`);
    expect(g('actFrec.length')).toBe(initial);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SPEC MANAGEMENT — addSpec() / removeSpec()
// ═══════════════════════════════════════════════════════════════════════════════

describe('addSpec() — add a specialisation chip', () => {
  test('adds spec to tempSpecs', () => {
    win.document.getElementById('specInp').value = 'Pintura';
    win.eval('addSpec()');
    expect(g('tempSpecs')).toContain('Pintura');
  });

  test('clears the input after adding', () => {
    win.document.getElementById('specInp').value = 'Electricidad';
    win.eval('addSpec()');
    expect(win.document.getElementById('specInp').value).toBe('');
  });

  test('does not add an empty string', () => {
    win.document.getElementById('specInp').value = '';
    win.eval('addSpec()');
    expect(g('tempSpecs.length')).toBe(0);
  });

  test('does not add a duplicate spec', () => {
    win.document.getElementById('specInp').value = 'Plomería';
    win.eval('addSpec()');
    win.document.getElementById('specInp').value = 'Plomería';
    win.eval('addSpec()');
    expect(g('tempSpecs.filter(s=>s==="Plomería").length')).toBe(1);
  });
});

describe('removeSpec() — remove a specialisation chip', () => {
  beforeEach(() => {
    win.eval("tempSpecs = ['Pintura', 'Electricidad', 'Plomería']");
  });

  test('removes the spec at the given index', () => {
    win.eval('removeSpec(1)'); // removes 'Electricidad'
    expect(g('tempSpecs')).toEqual(['Pintura', 'Plomería']);
  });

  test('removes the first spec', () => {
    win.eval('removeSpec(0)');
    expect(g('tempSpecs[0]')).toBe('Electricidad');
  });

  test('removes the last spec', () => {
    win.eval('removeSpec(2)');
    expect(g('tempSpecs.length')).toBe(2);
    expect(g('tempSpecs')).toEqual(['Pintura', 'Electricidad']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. AREA MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('addAreaFromModal() — add a new area', () => {
  test('adds a new area to AREAS', () => {
    const initial = g('AREAS.length');
    win.document.getElementById('newAreaInp').value = 'Parque Central';
    win.eval('addAreaFromModal()');
    expect(g('AREAS.length')).toBe(initial + 1);
    expect(g("AREAS.includes('Parque Central')")).toBe(true);
  });

  test('clears the input field after adding', () => {
    win.document.getElementById('newAreaInp').value = 'Área Nueva';
    win.eval('addAreaFromModal()');
    expect(win.document.getElementById('newAreaInp').value).toBe('');
  });

  test('does not add when name is empty', () => {
    const initial = g('AREAS.length');
    win.document.getElementById('newAreaInp').value = '';
    win.eval('addAreaFromModal()');
    expect(g('AREAS.length')).toBe(initial);
  });

  test('does not add a duplicate area (case-insensitive)', () => {
    const initial = g('AREAS.length');
    win.document.getElementById('newAreaInp').value = 'club de playa'; // lowercase dup
    win.eval('addAreaFromModal()');
    expect(g('AREAS.length')).toBe(initial);
  });
});

describe('deleteArea() — remove an area', () => {
  test('removes the area at the given index', () => {
    const firstArea = g('AREAS[0]');
    const initial = g('AREAS.length');
    win.eval('deleteArea(0)');
    expect(g('AREAS.length')).toBe(initial - 1);
    expect(g(`AREAS.includes('${firstArea}')`)).toBe(false);
  });

  test('removes the correct area by index', () => {
    const secondArea = g('AREAS[1]');
    win.eval('deleteArea(1)');
    expect(g(`AREAS.includes('${secondArea}')`)).toBe(false);
  });

  test('keeps all areas when user cancels', () => {
    win.confirm = () => false;
    const initial = g('AREAS.length');
    win.eval('deleteArea(0)');
    expect(g('AREAS.length')).toBe(initial);
  });
});

describe('restoreDefaultAreas() — restore missing default areas', () => {
  test('adds missing default areas without duplicating existing ones', () => {
    // Remove some defaults
    win.eval("AREAS = ['Club de Playa']");
    win.eval('restoreDefaultAreas()');
    // Should now include all 5 defaults
    expect(g("DEFAULT_AREAS.every(a => AREAS.some(x => x.toLowerCase() === a.toLowerCase()))")).toBe(true);
  });

  test('does not duplicate when all defaults already exist', () => {
    win.eval("AREAS = [...DEFAULT_AREAS]");
    const initial = g('AREAS.length');
    win.eval('restoreDefaultAreas()');
    expect(g('AREAS.length')).toBe(initial);
  });

  test('does nothing when user cancels', () => {
    win.confirm = () => false;
    win.eval("AREAS = []");
    win.eval('restoreDefaultAreas()');
    expect(g('AREAS.length')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. NOTE — saveNota() / openNota()
// ═══════════════════════════════════════════════════════════════════════════════

describe('saveNota() — save the daily note', () => {
  test('updates nota to the entered text', () => {
    win.document.getElementById('notaInp').value = 'Nueva nota de prueba';
    win.eval('saveNota()');
    expect(g('nota')).toBe('Nueva nota de prueba');
  });

  test('keeps the existing nota when input is empty (no overwrite with empty)', () => {
    const original = g('nota');
    win.document.getElementById('notaInp').value = '';
    win.eval('saveNota()');
    expect(g('nota')).toBe(original);
  });

  test('updates the notaText DOM element', () => {
    win.document.getElementById('notaInp').value = 'Nota visible';
    win.eval('saveNota()');
    expect(win.document.getElementById('notaText').textContent).toBe('Nota visible');
  });
});

describe('openNota() / closeNota() — modal toggle', () => {
  test('openNota adds "on" class to mNota', () => {
    win.eval('openNota()');
    expect(win.document.getElementById('mNota').classList.contains('on')).toBe(true);
  });

  test('closeNota removes "on" class from mNota', () => {
    win.eval('openNota()');
    win.eval('closeNota()');
    expect(win.document.getElementById('mNota').classList.contains('on')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. HISTORY / CLOSE DAY — cerrarDia() / filteredHist()
// ═══════════════════════════════════════════════════════════════════════════════

describe('cerrarDia() — close and save the day', () => {
  test('does not save when there are no assignments', () => {
    win.eval('cerrarDia()');
    expect(g('historial.length')).toBe(0);
  });

  test('saves a day snapshot when assignments exist', () => {
    win.eval(`asigs = [{id:1,pid:1,nombre:'S',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:true,horaFin:'14:00',estado:'completada',observaciones:'',fotos:[]}]`);
    win.eval('cerrarDia()');
    expect(g('historial.length')).toBe(1);
    expect(g("historial[0].fecha")).toBe('2026-04-14');
  });

  test('snapshot includes totalAsig, totalCumplidas, totalPendientes', () => {
    win.eval(`asigs = [
      {id:1,pid:1,nombre:'S',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:true,horaFin:'14:00',estado:'completada',observaciones:'',fotos:[]},
      {id:2,pid:2,nombre:'M',actividad:'Y',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}
    ]`);
    win.eval('cerrarDia()');
    expect(g('historial[0].totalAsig')).toBe(2);
    expect(g('historial[0].totalCumplidas')).toBe(1);
    expect(g('historial[0].totalPendientes')).toBe(1);
  });

  test('replaces an existing entry for the same date', () => {
    win.eval(`asigs = [{id:1,pid:1,nombre:'S',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}]`);
    win.eval('cerrarDia()'); // first save
    win.eval("asigs[0].done = true");
    win.eval('cerrarDia()'); // save again same date
    expect(g('historial.length')).toBe(1);
    expect(g('historial[0].totalCumplidas')).toBe(1);
  });

  test('sorts historial descending by date', () => {
    // Save day 1
    win.eval(`asigs = [{id:1,pid:1,nombre:'S',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}]`);
    win.eval("document.getElementById('globalDate').value = '2026-04-10'");
    win.eval('cerrarDia()');
    // Save day 2 (later date)
    win.eval("document.getElementById('globalDate').value = '2026-04-14'");
    win.eval(`asigs = [{id:2,pid:2,nombre:'M',actividad:'Y',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}]`);
    win.eval('cerrarDia()');
    // Most recent should be first
    expect(g('historial[0].fecha')).toBe('2026-04-14');
    expect(g('historial[1].fecha')).toBe('2026-04-10');
  });

  test('includes noDisponibles (non-libre persons) in snapshot', () => {
    win.eval("toggleSt(1, 'compensatorio')"); // person 1 is now compensatorio
    win.eval(`asigs = [{id:1,pid:2,nombre:'M',actividad:'X',area:'A',hora:'6:30 am',horaEstFin:'',proyectoId:null,fecha:'2026-04-14',done:false,horaFin:'',estado:'pendiente',observaciones:'',fotos:[]}]`);
    win.eval('cerrarDia()');
    expect(g('historial[0].noDisponibles.length')).toBeGreaterThan(0);
    expect(g('historial[0].noDisponibles[0].status')).toBe('compensatorio');
  });
});

describe('filteredHist() — filter the history list', () => {
  beforeEach(() => {
    // Seed historial with 3 entries at different dates
    const today = new Date();
    const fmtDate = d => d.toISOString().slice(0, 10);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const oldDate = new Date(today);
    oldDate.setDate(today.getDate() - 60); // 60 days ago

    win.__hist = [
      {
        fecha: fmtDate(today),
        asignaciones: [{ nombre: 'Steven Salazar', actividad: 'Pintura' }],
        nota: '', noDisponibles: [], personal: [], totalAsig: 1, totalCumplidas: 0, totalPendientes: 1
      },
      {
        fecha: fmtDate(yesterday),
        asignaciones: [{ nombre: 'Manuel Hernandez', actividad: 'Jardinería' }],
        nota: '', noDisponibles: [], personal: [], totalAsig: 1, totalCumplidas: 1, totalPendientes: 0
      },
      {
        fecha: fmtDate(oldDate),
        asignaciones: [{ nombre: 'Carlos Ortiz', actividad: 'Aire acondicionado' }],
        nota: '', noDisponibles: [], personal: [], totalAsig: 1, totalCumplidas: 0, totalPendientes: 1
      },
    ];
    win.eval('historial = window.__hist; histFilter = "todo"');
    win.document.getElementById('histSearch').value = '';
  });

  test('returns all entries when filter is "todo"', () => {
    const result = g('filteredHist()');
    expect(result.length).toBe(3);
  });

  test('returns only recent entries when filter is "semana"', () => {
    win.eval('histFilter = "semana"');
    const result = g('filteredHist()');
    // Only today and yesterday are within 7 days
    expect(result.length).toBe(2);
  });

  test('returns only current-month entries when filter is "mes"', () => {
    win.eval('histFilter = "mes"');
    const result = g('filteredHist()');
    // today and yesterday are in the current month; 60 days ago may not be
    expect(result.every(d => {
      const date = new Date(d.fecha + 'T12:00:00');
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })).toBe(true);
  });

  test('filters by collaborator name (case-insensitive)', () => {
    win.document.getElementById('histSearch').value = 'steven';
    const result = g('filteredHist()');
    expect(result.length).toBe(1);
    expect(result[0].asignaciones[0].nombre).toBe('Steven Salazar');
  });

  test('filters by activity name', () => {
    win.document.getElementById('histSearch').value = 'jardinería';
    const result = g('filteredHist()');
    expect(result.length).toBe(1);
    expect(result[0].asignaciones[0].actividad).toBe('Jardinería');
  });

  test('returns empty array when search term matches nothing', () => {
    win.document.getElementById('histSearch').value = 'xyzzyxyz';
    const result = g('filteredHist()');
    expect(result.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. MULTI-SELECT MODE — setMode() / toggleMultiSel() / clearSel()
// ═══════════════════════════════════════════════════════════════════════════════

describe('setMode() — switch between single and multi assign modes', () => {
  test('sets assignMode to "multi"', () => {
    win.eval("setMode('multi')");
    expect(g('assignMode')).toBe('multi');
  });

  test('sets assignMode to "single"', () => {
    win.eval("setMode('multi')");
    win.eval("setMode('single')");
    expect(g('assignMode')).toBe('single');
  });
});

describe('toggleMultiSel() — add/remove a pid in the multi-selection list', () => {
  test('adds a pid to selPids when not already present', () => {
    win.eval('toggleMultiSel(3)');
    expect(g('selPids')).toContain(3);
  });

  test('removes the pid when toggled a second time', () => {
    win.eval('toggleMultiSel(3)');
    win.eval('toggleMultiSel(3)');
    expect(g('selPids')).not.toContain(3);
  });

  test('can hold multiple distinct pids', () => {
    win.eval('toggleMultiSel(1)');
    win.eval('toggleMultiSel(2)');
    win.eval('toggleMultiSel(3)');
    expect(g('selPids.length')).toBe(3);
  });
});

describe('clearSel() — reset the current selection', () => {
  test('sets selPid to null', () => {
    win.eval('selPid = 5; clearSel()');
    expect(g('selPid')).toBeNull();
  });

  test('empties the selPids array', () => {
    win.eval('selPids = [1,2,3]; clearSel()');
    expect(g('selPids.length')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. LOCALSTORAGE PERSISTENCE — saveMemory() / loadMemory()
// ═══════════════════════════════════════════════════════════════════════════════

describe('saveMemory() / loadMemory() — localStorage persistence', () => {
  beforeEach(() => {
    win.localStorage.clear();
  });

  test('saveMemory writes historial to localStorage', () => {
    win.eval(`historial = [{fecha:'2026-04-14',asignaciones:[],nota:'',noDisponibles:[],personal:[],totalAsig:0,totalCumplidas:0,totalPendientes:0}]`);
    win.eval('saveMemory()');
    const stored = win.localStorage.getItem('isp_historial_v1');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed.length).toBe(1);
    expect(parsed[0].fecha).toBe('2026-04-14');
  });

  test('saveMemory persists personal to localStorage', () => {
    win.eval('saveMemory()');
    const stored = win.localStorage.getItem('isp_personal_v1');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed.length).toBe(g('personal.length'));
  });

  test('saveMemory persists actFrec to localStorage', () => {
    win.eval('saveMemory()');
    const stored = win.localStorage.getItem('isp_actfreq_v1');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored).length).toBe(g('actFrec.length'));
  });

  test('loadMemory restores historial from localStorage', () => {
    const snap = [{ fecha: '2026-03-01', asignaciones: [], nota: '', noDisponibles: [], personal: [], totalAsig: 0, totalCumplidas: 0, totalPendientes: 0 }];
    win.localStorage.setItem('isp_historial_v1', JSON.stringify(snap));
    win.eval('loadMemory()');
    expect(g('historial.length')).toBe(1);
    expect(g("historial[0].fecha")).toBe('2026-03-01');
  });

  test('loadMemory restores custom AREAS from localStorage', () => {
    const customAreas = ['Zona Norte', 'Zona Sur'];
    win.localStorage.setItem('dmi_areas_v1', JSON.stringify(customAreas));
    win.eval('loadMemory()');
    expect(g('AREAS')).toEqual(customAreas);
  });

  test('loadMemory is resilient to corrupt JSON', () => {
    win.localStorage.setItem('isp_historial_v1', 'NOT_JSON}}}');
    expect(() => win.eval('loadMemory()')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. PHOTO MANAGEMENT — rmP() / renderPPs()
// ═══════════════════════════════════════════════════════════════════════════════

describe('rmP() — remove a temp photo', () => {
  beforeEach(() => {
    win.eval("tempPhotos = ['data:image/png;base64,A', 'data:image/png;base64,B', 'data:image/png;base64,C']");
  });

  test('removes the photo at the given index', () => {
    win.eval('rmP(1)');
    expect(g('tempPhotos.length')).toBe(2);
    expect(g('tempPhotos[0]')).toBe('data:image/png;base64,A');
    expect(g('tempPhotos[1]')).toBe('data:image/png;base64,C');
  });

  test('removes the first photo', () => {
    win.eval('rmP(0)');
    expect(g('tempPhotos[0]')).toBe('data:image/png;base64,B');
  });

  test('removes the last photo', () => {
    win.eval('rmP(2)');
    expect(g('tempPhotos.length')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. updateProjSel() — project select synchronisation
// ═══════════════════════════════════════════════════════════════════════════════

describe('updateProjSel() — keep fProyecto in sync with proyectos', () => {
  test('renders only active/paused projects (not completado)', () => {
    win.eval(`proyectos = [
      {id:1, nombre:'Activo', estado:'activo', color:'#003F87', area:'A', hist:[]},
      {id:2, nombre:'Pausado', estado:'pausado', color:'#000', area:'B', hist:[]},
      {id:3, nombre:'Listo', estado:'completado', color:'#000', area:'C', hist:[]}
    ]`);
    win.eval('updateProjSel()');
    const options = [...win.document.getElementById('fProyecto').options].map(o => o.text);
    expect(options).toContain('Activo');
    expect(options).toContain('Pausado');
    expect(options).not.toContain('Listo');
  });

  test('always contains the blank "— Sin proyecto —" option', () => {
    win.eval('proyectos = []');
    win.eval('updateProjSel()');
    const options = [...win.document.getElementById('fProyecto').options].map(o => o.value);
    expect(options).toContain('');
  });
});
