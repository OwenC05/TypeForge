// Gallery states are read from the frozen prototype fixtures (not copied), plus review-only states.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fixtures = await import(pathToFileURL(resolve(import.meta.dirname, '../../../ux/prototype/fixtures.ts')).href);
const narrow = [[390, 844], [320, 640]];
const all = [[1440, 900], [390, 844], [320, 640]];
export const states = [
  ...fixtures.states.map(s => ({ id: s.id, query: s.query })),
  { id: 'R01-press-4of10', query: 'page=practice&fx=s4&view=press' },
  { id: 'R02-assessment-qwerty-on-ready-4', query: 'page=assessment&fx=s4&qwerty=1' },
  { id: 'R03-final-ready-full', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=ready', full: true, viewports: narrow },
  { id: 'R04-final-insufficient-full', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=insufficient', full: true, viewports: narrow },
  { id: 'R05-final-savefail', query: 'page=assessment&fx=s9&view=result&outcome=savefail' },
  { id: 'R06-why-complete-insufficient-full', query: 'page=practice&fx=s10insuff&view=why', full: true, viewports: narrow },
  { id: 'FC-02-press', query: 'page=practice&fx=s4&view=press', forced: true, viewports: all },
  { id: 'FC-03-why-4', query: 'page=practice&fx=s4&view=why', forced: true, viewports: all },
  { id: 'FC-07-result-5', query: 'page=assessment&fx=s4&view=result&outcome=saved', forced: true, viewports: all },
  { id: 'FC-09-savefail', query: 'page=assessment&fx=s4&view=result&outcome=savefail', forced: true, viewports: all },
  { id: 'FC-12-final-insufficient', query: 'page=assessment&fx=s9&view=result&outcome=saved&final=insufficient', forced: true, viewports: all },
  { id: 'FC-22-reset-confirm', query: 'page=progress&fx=s4&view=confirm', forced: true, viewports: all },
];
