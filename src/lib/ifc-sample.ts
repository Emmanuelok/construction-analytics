/* A bundled, valid IFC4 (STEP Physical File) sample so the BIM module is
 * demonstrable without an upload. It is plain SPF text — parseIfc() reads it
 * through exactly the same path as a user-uploaded .ifc file. */

function buildSample(): string {
  const body: string[] = []
  let id = 100
  const add = (entity: string) => {
    body.push(`#${id}=${entity};`)
    return id++
  }

  add(`IFCPROJECT('1Meridian00000000000001',$,'Meridian Tower',$,$,$,$,$,$)`)
  add(`IFCSITE('1Site0000000000000000001',$,'Riverside Plot',$,$,$,$,$,.ELEMENT.,(51,30,26),(0,7,40),12.5,$,$)`)
  add(`IFCBUILDING('1Bldg0000000000000000001',$,'Tower A',$,$,$,$,$,.ELEMENT.,$,$,$)`)
  for (const s of ['Level 00 — Lobby', 'Level 01', 'Level 02', 'Level 03 — Roof'])
    add(`IFCBUILDINGSTOREY('1Storey${id}0000000000',$,'${s}',$,$,$,$,$,.ELEMENT.,0.)`)

  const emit = (type: string, n: number, name: (i: number) => string) => {
    for (let i = 0; i < n; i++) add(`${type}('g${id}',$,'${name(i)}',$,$,$,$,$,'t${i}')`)
  }
  emit('IFCWALLSTANDARDCASE', 8, (i) => `Wall ${i + 1} — RC 300mm`)
  emit('IFCSLAB', 4, (i) => `Slab L0${i}`)
  emit('IFCCOLUMN', 12, (i) => `Column ${String.fromCharCode(65 + (i % 6))}-${i + 1}`)
  emit('IFCBEAM', 8, (i) => `Beam B${i + 1}`)
  emit('IFCDOOR', 5, (i) => `Door D${i + 1}`)
  emit('IFCWINDOW', 10, (i) => `Window W${i + 1}`)
  emit('IFCDUCTSEGMENT', 3, (i) => `Supply duct ${i + 1}`)
  emit('IFCPIPESEGMENT', 4, (i) => `Chilled-water pipe ${i + 1}`)
  emit('IFCAIRTERMINAL', 2, (i) => `VAV box ${i + 1}`)
  emit('IFCREINFORCINGBAR', 6, (i) => `Rebar cage ${i + 1}`)

  const qty = (type: string, name: string, value: number) => add(`${type}('${name}',$,$,${value},$)`)
  for (let i = 0; i < 12; i++) qty('IFCQUANTITYVOLUME', 'NetVolume', 3.2) // columns
  for (let i = 0; i < 4; i++) qty('IFCQUANTITYVOLUME', 'NetVolume', 120.5) // slabs
  for (let i = 0; i < 8; i++) qty('IFCQUANTITYVOLUME', 'NetVolume', 1.8) // beams
  for (let i = 0; i < 8; i++) qty('IFCQUANTITYAREA', 'GrossSideArea', 42.0) // walls
  for (let i = 0; i < 4; i++) qty('IFCQUANTITYAREA', 'GrossArea', 310.0) // floors
  for (let i = 0; i < 6; i++) qty('IFCQUANTITYWEIGHT', 'Weight', 1850) // rebar
  for (let i = 0; i < 3; i++) qty('IFCQUANTITYLENGTH', 'Length', 24.5) // duct
  for (let i = 0; i < 4; i++) qty('IFCQUANTITYLENGTH', 'Length', 18.2) // pipe

  const psv = (name: string, wrapped: string) => add(`IFCPROPERTYSINGLEVALUE('${name}',$,${wrapped},$)`)
  psv('FireRating', `IFCLABEL('120min')`)
  psv('LoadBearing', `IFCBOOLEAN(.T.)`)
  psv('IsExternal', `IFCBOOLEAN(.T.)`)
  psv('ThermalTransmittance', `IFCREAL(0.18)`)
  psv('AcousticRating', `IFCLABEL('Rw 52dB')`)
  psv('Combustible', `IFCBOOLEAN(.F.)`)

  const header = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');
FILE_NAME('MeridianTower-Sample.ifc','2026-05-20T09:14:00',('AEC Studio'),('AEC Data & Intelligence Studio'),'IFC4 reference','Studio Sample Generator','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;`
  return `${header}\n${body.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`
}

export const SAMPLE_IFC: string = buildSample()
