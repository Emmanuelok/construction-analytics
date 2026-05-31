/* Accessibility helpers — pure, unit-tested. Small builders that produce
 * consistent, screen-reader-friendly labels for the studio's custom interactive
 * controls (editable cells, sliders, toggles, icon-only buttons). Keeping these
 * pure means the exact announced strings are testable and uniform everywhere. */

function fmt(value: string | number): string {
  if (typeof value === 'number') return Math.abs(value) >= 1000 ? Math.round(value).toLocaleString() : String(value)
  return value
}

/** Label for a click-to-edit cell, e.g. "Edit Cost variance, currently 4.2%". */
export function editLabel(field: string, value: string | number, unit = ''): string {
  return `Edit ${field}, currently ${fmt(value)}${unit}`
}

/** Label for an icon-only remove/delete button, e.g. "Remove Meridian Tower". */
export function removeLabel(name: string): string {
  return `Remove ${name}`
}

/** Label for an icon-only action button, e.g. "Resolve Struct×MEP". */
export function actionLabel(action: string, name: string): string {
  return `${action} ${name}`
}

/** Spoken value for a weight/percent slider, e.g. "30 percent". */
export function percentValueText(pct: number): string {
  return `${Math.round(pct * 100)} percent`
}

/** Label for a toggle/switch, e.g. "Cost overrun rule, on". */
export function toggleLabel(name: string, on: boolean): string {
  return `${name}, ${on ? 'on' : 'off'}`
}
