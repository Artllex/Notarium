import { EditorState } from '@tiptap/pm/state';
import { DOMParser as PMParser } from '@tiptap/pm/model';
import { importLegacy, readDocument } from './storage.js';

// Rehydrate a note without publishing changes or modifying its saved timestamps.
export function readNoteState(editor, message, normalizeAutomaticEmptyAfterRows) {
  let doc;
  if (message.documentJson) { doc = editor.schema.nodeFromJSON(readDocument(message.documentJson)); doc.check(); }
  else {
    const host = document.createElement('div'); host.innerHTML = importLegacy(message.markdown);
    doc = PMParser.fromSchema(editor.schema).parse(host);
    const width = (message.markdown || '').match(/<!-- notarium:content-width (650|790|960) -->/);
    if (width) doc = doc.type.create({ ...doc.attrs, contentWidth: Number(width[1]) }, doc.content);
  }
  return EditorState.create({ doc: normalizeAutomaticEmptyAfterRows(doc), schema: editor.schema, plugins: editor.state.plugins });
}
