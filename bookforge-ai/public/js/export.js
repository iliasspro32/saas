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
    if (!window.jspdf?.jsPDF) return alert("jsPDF no está cargado.");
    const doc = new window.jspdf.jsPDF({ unit: "pt", format: [432, 648], orientation: "portrait" });
    buildBookPdf(doc, book, { width: 432, height: 648, margin: 50, fontSize: 11, lineHeight: 15, style: "kdp" });
    doc.save(`${slug(book.titulo)}-kdp-6x9.pdf`);
  }

  async function pdfEtsy(book) {
    if (!window.jspdf?.jsPDF) return alert("jsPDF no está cargado.");
    const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    buildBookPdf(doc, book, { width: 595.28, height: 841.89, margin: 58, fontSize: 12, lineHeight: 17, style: "etsy" });
    doc.save(`${slug(book.titulo)}-etsy-a4.pdf`);
  }

  function buildBookPdf(doc, book, settings) {
    const page = { n: 0 };
    const cover = book.portada || {};
    const colors = cover.paleta?.length ? cover.paleta : ["#111827", "#4f46e5", "#f59e0b"];
    drawCover(doc, book, cover, colors, settings, page);
    addPage(doc, settings, page, false);
    drawTitlePage(doc, book, settings);
    addPage(doc, settings, page);
    drawMetadataPage(doc, book, settings, page);
    addPage(doc, settings, page);
    drawTocPage(doc, book, settings, page);

    (book.contenido || []).forEach((chapter) => {
      addPage(doc, settings, page);
      drawChapter(doc, chapter, settings, page);
    });

    addPage(doc, settings, page);
    let y = settings.margin;
    y = drawHeading(doc, "Recursos extra", y, settings, 22, page);
    (book.recursos_extra || []).forEach((item) => {
      y = ensureSpace(doc, y, 90, settings, page);
      y = drawHeading(doc, text(item.titulo), y, settings, 15, page);
      y = drawParagraph(doc, text(item.contenido), y, settings, page);
    });

    addPage(doc, settings, page);
    y = settings.margin;
    y = drawHeading(doc, "Conclusión final", y, settings, 22, page);
    y = drawParagraph(doc, text(book.conclusion_final), y, settings, page);
    y = drawHeading(doc, "Sobre el autor", y + 12, settings, 20, page);
    drawParagraph(doc, text(book.sobre_el_autor), y, settings, page);
  }

  function drawCover(doc, book, cover, colors, settings, page) {
    page.n = 0;
    setFill(doc, colors[0]);
    doc.rect(0, 0, settings.width, settings.height, "F");
    setFill(doc, colors[1]);
    doc.rect(28, 28, settings.width - 56, settings.height - 56, "F");
    setFill(doc, colors[0]);
    doc.rect(44, 44, settings.width - 88, settings.height - 88, "F");
    setFill(doc, colors[2]);
    doc.circle(settings.width - 92, 118, 56, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);
    doc.rect(58, 58, settings.width - 116, settings.height - 116);
    doc.setTextColor(254, 243, 199);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${text(book.plataforma || "KDP").toUpperCase()} READY`, 72, 88);
    doc.setTextColor(255, 255, 255);
    doc.setFont("times", "bold");
    doc.setFontSize(34);
    const titleLines = doc.splitTextToSize(text(cover.titulo_portada || book.titulo), settings.width - 130);
    doc.text(titleLines, 72, 230);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(255, 247, 237);
    const subtitleLines = doc.splitTextToSize(text(cover.subtitulo_portada || book.subtitulo), settings.width - 140);
    doc.text(subtitleLines, 72, 230 + titleLines.length * 38 + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(254, 243, 199);
    doc.text(text(cover.autor_portada || book.autor || "BookForge AI Studio").toUpperCase(), 72, settings.height - 86);
  }

  function drawTitlePage(doc, book, settings) {
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(text(book.tipo || "Ebook profesional").toUpperCase(), settings.width / 2, 150, { align: "center" });
    doc.setFont("times", "bold");
    doc.setFontSize(30);
    const title = doc.splitTextToSize(text(book.titulo), settings.width - settings.margin * 2);
    doc.text(title, settings.width / 2, 230, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(75, 85, 99);
    const subtitle = doc.splitTextToSize(text(book.subtitulo), settings.width - settings.margin * 2);
    doc.text(subtitle, settings.width / 2, 300 + title.length * 20, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(text(book.autor || "BookForge AI Studio"), settings.width / 2, settings.height - 130, { align: "center" });
  }

  function drawMetadataPage(doc, book, settings, page) {
    let y = settings.margin;
    y = drawHeading(doc, "Información editorial", y, settings, 22, page);
    y = drawInfo(doc, "Plataforma", book.plataforma, y, settings);
    y = drawInfo(doc, "Idioma", book.idioma, y, settings);
    y = drawInfo(doc, "Categoría KDP", book.categoria_kdp, y, settings);
    y = drawInfo(doc, "Páginas estimadas", String(book.paginas_estimadas || ""), y, settings);
    y = drawHeading(doc, "Descripción KDP", y + 10, settings, 16, page);
    y = drawParagraph(doc, text(book.descripcion_kdp), y, settings, page);
    y = drawHeading(doc, "Keywords", y + 8, settings, 16, page);
    drawParagraph(doc, (book.keywords || []).join(", "), y, settings, page);
  }

  function drawTocPage(doc, book, settings, page) {
    let y = settings.margin;
    y = drawHeading(doc, "Índice", y, settings, 24, page);
    (book.indice || []).forEach((item) => {
      y = ensureSpace(doc, y, 58, settings, page);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(138, 107, 45);
      doc.text(`CAPÍTULO ${item.capitulo}`, settings.margin, y);
      y += 14;
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text(text(item.titulo), settings.margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(96, 96, 96);
      const lines = doc.splitTextToSize(text(item.descripcion), settings.width - settings.margin * 2);
      doc.text(lines, settings.margin, y);
      y += lines.length * 12 + 12;
    });
  }

  function drawChapter(doc, chapter, settings, page) {
    let y = settings.margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(138, 107, 45);
    doc.text(`CAPÍTULO ${chapter.capitulo}`, settings.margin, y);
    y += 18;
    y = drawHeading(doc, text(chapter.titulo), y, settings, 24, page);
    y = drawParagraph(doc, text(chapter.introduccion), y, settings, page);
    (chapter.secciones || []).forEach((section) => {
      y = drawHeading(doc, text(section.subtitulo), y + 8, settings, 16, page);
      y = drawParagraph(doc, text(section.contenido), y, settings, page);
    });
    y = drawHeading(doc, "Conclusión", y + 8, settings, 16, page);
    y = drawParagraph(doc, text(chapter.conclusion), y, settings, page);
    y = drawHeading(doc, "Ejercicio práctico", y + 8, settings, 15, page);
    drawParagraph(doc, text(chapter.ejercicio), y, settings, page);
  }

  function addPage(doc, settings, page, number = true) {
    if (page.n > 0 || !number) doc.addPage();
    page.n += 1;
    setFill(doc, settings.style === "etsy" ? "#fff7ed" : "#fffdf8");
    doc.rect(0, 0, settings.width, settings.height, "F");
    if (number && page.n > 1) drawPageNumber(doc, settings, page.n - 1);
  }

  function drawPageNumber(doc, settings, number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(String(number), settings.width / 2, settings.height - 24, { align: "center" });
  }

  function drawHeading(doc, heading, y, settings, size, page) {
    y = ensureSpace(doc, y, size * 2.2, settings, page);
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(text(heading), settings.width - settings.margin * 2);
    doc.text(lines, settings.margin, y);
    return y + lines.length * (size + 4) + 8;
  }

  function drawInfo(doc, label, value, y, settings) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(138, 107, 45);
    doc.text(String(label).toUpperCase(), settings.margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(text(value), settings.margin + 120, y);
    return y + 22;
  }

  function drawParagraph(doc, content, y, settings, page) {
    doc.setFont("times", "normal");
    doc.setFontSize(settings.fontSize);
    doc.setTextColor(31, 41, 55);
    const paragraphs = text(content).split(/\n{2,}/).filter(Boolean);
    paragraphs.forEach((paragraph) => {
      const lines = doc.splitTextToSize(paragraph, settings.width - settings.margin * 2);
      lines.forEach((line) => {
        y = ensureSpace(doc, y, settings.lineHeight + 8, settings, page);
        doc.text(line, settings.margin, y);
        y += settings.lineHeight;
      });
      y += 8;
    });
    return y;
  }

  function ensureSpace(doc, y, needed, settings, page) {
    if (y + needed <= settings.height - settings.margin) return y;
    doc.addPage();
    page.n += 1;
    setFill(doc, settings.style === "etsy" ? "#fff7ed" : "#fffdf8");
    doc.rect(0, 0, settings.width, settings.height, "F");
    drawPageNumber(doc, settings, page.n - 1);
    return settings.margin;
  }

  function setFill(doc, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
  }

  function hexToRgb(hex = "#ffffff") {
    const clean = String(hex).replace("#", "").trim();
    const value = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean.padEnd(6, "f").slice(0, 6);
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
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
