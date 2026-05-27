(function () {
  function slug(text) {
    return String(text || "bookforge-book").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function text(value) {
    return String(value || "").replace(/<[^>]*>/g, "");
  }

  function allChapterText(book) {
    return (book.contenido || []).map((chapter) => {
      const sections = (chapter.secciones || []).map((section) => `<h2>${section.subtitulo}</h2><p>${section.contenido}</p>`).join("");
      return `<h1>Capítulo ${chapter.capitulo}: ${chapter.titulo}</h1><p>${chapter.introduccion}</p>${sections}<h2>Conclusión</h2><p>${chapter.conclusion}</p><h2>Ejercicio</h2><p>${chapter.ejercicio}</p>`;
    }).join("");
  }

  async function pdfKdp(book) {
    const paper = document.getElementById("bookPaper");
    if (!paper || !window.html2pdf) return alert("html2pdf.js no está cargado.");
    const clone = paper.cloneNode(true);
    clone.style.width = "6in";
    clone.style.padding = ".65in";
    clone.style.background = "#fff";
    clone.style.color = "#111";
    clone.style.fontFamily = "Georgia, serif";
    clone.querySelectorAll("p, li").forEach((node) => { node.style.fontSize = "11pt"; node.style.lineHeight = "1.55"; });
    await window.html2pdf().set({
      margin: 0,
      filename: `${slug(book.titulo)}-kdp-6x9.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: [6, 9], orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    }).from(clone).save();
  }

  async function pdfEtsy(book) {
    const wrapper = document.createElement("div");
    wrapper.style.width = "210mm";
    wrapper.style.padding = "18mm";
    wrapper.style.background = "#fff7ed";
    wrapper.style.color = "#111827";
    wrapper.innerHTML = `
      <div style="border:4px solid #6366f1;padding:24px;margin-bottom:20px">
        <h1 style="font-family:Georgia,serif;font-size:42px;line-height:1">${book.titulo}</h1>
        <p style="font-size:18px;color:#4b5563">${book.subtitulo || ""}</p>
        <p><strong>${book.autor || ""}</strong></p>
      </div>
      ${allChapterText(book)}
    `;
    await window.html2pdf().set({
      margin: 0,
      filename: `${slug(book.titulo)}-etsy-a4.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(wrapper).save();
  }

  async function epub(book) {
    if (!window.JSZip) return alert("JSZip no está cargado.");
    const zip = new JSZip();
    const id = crypto.randomUUID();
    zip.file("mimetype", "application/epub+zip");
    zip.folder("META-INF").file("container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    const oebps = zip.folder("OEBPS");
    oebps.file("content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${id}</dc:identifier><dc:title>${escapeXml(book.titulo)}</dc:title><dc:language>${escapeXml(book.idioma || "es")}</dc:language><dc:creator>${escapeXml(book.autor || "")}</dc:creator></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapters" href="chapters.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapters"/></spine></package>`);
    oebps.file("nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc"><ol><li><a href="chapters.xhtml">${escapeXml(book.titulo)}</a></li></ol></nav></body></html>`);
    oebps.file("chapters.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(book.titulo)}</title></head><body><h1>${escapeXml(book.titulo)}</h1>${allChapterText(book)}</body></html>`);
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip", compression: "DEFLATE" });
    downloadBlob(blob, `${slug(book.titulo)}.epub`);
  }

  async function docx(book) {
    if (!window.JSZip) return alert("JSZip no está cargado.");
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    const word = zip.folder("word");
    const paragraphs = [
      book.titulo,
      book.subtitulo || "",
      book.autor || "",
      `Descripción KDP: ${book.descripcion_kdp || ""}`,
      ...(book.contenido || []).flatMap((chapter) => [
        `Capítulo ${chapter.capitulo}: ${chapter.titulo}`,
        chapter.introduccion,
        ...(chapter.secciones || []).flatMap((section) => [section.subtitulo, section.contenido]),
        chapter.conclusion,
        `Ejercicio: ${chapter.ejercicio || ""}`
      ]),
      book.conclusion_final || "",
      book.sobre_el_autor || ""
    ].filter(Boolean);
    word.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.map((item) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(item)}</w:t></w:r></w:p>`).join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1200" w:bottom="1440" w:left="1200"/></w:sectPr></w:body></w:document>`);
    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
    downloadBlob(blob, `${slug(book.titulo)}.docx`);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeXml(value = "") {
    return text(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[char]);
  }

  window.BookForgeExport = { pdfKdp, pdfEtsy, epub, docx };
})();
