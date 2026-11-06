/** A response the browser saves as `fileName` rather than shows. */
export function fileDownload(body: Uint8Array, fileName: string, contentType: string) {
  // The plain name is a fallback for clients that can't read the UTF-8 one.
  const asciiName = fileName.replace(/[^\x20-\x7e]|"/g, "_");
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
