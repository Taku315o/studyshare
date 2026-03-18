export const resolveNoteImageSrc = (noteId: string, imageRef: string | null): string | null => {
  if (!imageRef) {
    return null;
  }

  return `/api/notes/${noteId}/image`;
};
