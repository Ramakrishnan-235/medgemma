export type PageId =
  | 'landing'
  | 'signin'
  | 'overview'
  | 'cases'
  | 'case'
  | 'chat'
  | 'imaging'
  | 'compare'
  | 'report'
  | 'reasoning'
  | 'ehr'
  | 'extraction'
  | 'qa'
  | 'library'
  | 'settings';

export const PAGES: [PageId, string][] = [
  ['landing', 'Landing'],
  ['signin', 'Sign in'],
  ['overview', 'Overview'],
  ['cases', 'Cases'],
  ['case', 'Case detail'],
  ['chat', 'General chat'],
  ['imaging', 'Imaging workspace'],
  ['compare', 'Longitudinal tracking'],
  ['report', 'Report studio'],
  ['reasoning', 'Clinical reasoning'],
  ['ehr', 'EHR summary'],
  ['extraction', 'Document extraction'],
  ['qa', 'Medical Q&A'],
  ['library', 'Library'],
  ['settings', 'Settings'],
];

export interface CaseItem {
  id: string;
  name: string;
  meta: string;
  status: 'Needs review' | 'Draft ready' | 'In progress' | 'Reviewed' | string;
  date: string;
}

export const INITIAL_CASES: CaseItem[] = [
  { id: '024', name: 'Chest follow-up', meta: 'CT · 2 studies', status: 'Needs review', date: 'Today, 09:42' },
  { id: '023', name: 'Record synthesis', meta: 'EHR · 4 documents', status: 'Draft ready', date: 'Today, 08:15' },
  { id: '022', name: 'Document review', meta: 'Lab report · 1 file', status: 'In progress', date: 'Yesterday' },
  { id: '021', name: 'Knee imaging', meta: 'MRI · 1 study', status: 'Reviewed', date: '22 Oct, 14:30' },
];

export type LibraryFileType = 'All files' | 'Imaging' | 'Documents' | 'Reports' | 'Conversations';

export interface LibraryItem {
  icon: string;
  name: string;
  category: string;
  caseContext: string;
  date: string;
  status: string;
  page: PageId;
}

export const INITIAL_LIBRARY_FILES: LibraryItem[] = [
  { icon: 'scan', name: 'CT chest · Current', category: 'Imaging', caseContext: 'Case 024', date: '24 Oct 2026', status: 'Needs review', page: 'imaging' },
  { icon: 'scan', name: 'CT chest · Prior', category: 'Imaging', caseContext: 'Case 024', date: '21 Jul 2026', status: 'Source ready', page: 'compare' },
  { icon: 'file', name: 'Clinical note.pdf', category: 'Documents', caseContext: 'Case 024', date: '24 Oct 2026', status: 'Source ready', page: 'reasoning' },
  { icon: 'file', name: 'Lab report.pdf', category: 'Documents', caseContext: 'Case 024', date: '22 Oct 2026', status: 'Review pending', page: 'extraction' },
  { icon: 'report', name: 'Chest imaging report', category: 'Reports', caseContext: 'Case 024', date: '24 Oct 2026', status: 'Draft', page: 'report' },
  { icon: 'chat', name: 'Case preparation', category: 'Conversations', caseContext: 'Case 024', date: '24 Oct 2026', status: 'Saved', page: 'chat' },
];

export interface ExtractedFieldItem {
  id: string;
  label: string;
  value: string;
}

export const INITIAL_EXTRACTED_FIELDS: ExtractedFieldItem[] = [
  { id: 'date', label: 'Collection date', value: '22 Oct 2026' },
  { id: 'specimen', label: 'Specimen', value: 'Whole blood' },
  { id: 'hemoglobin', label: 'Hemoglobin', value: '13.2 g/dL' },
  { id: 'wbc', label: 'White blood cells', value: '6.4 ×10⁹/L' },
];
