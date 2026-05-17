import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import * as FileSaver from 'file-saver';
import html2canvas from 'html2canvas';
import * as docxPreview from 'docx-preview';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

interface ConvertTool {
  id: string;
  title: string;
  description: string;
  icon: string;
  accept: string;
  format: string;
  targetExt: string;
  type: string;
}

@Component({
  selector: 'app-document-convertor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-convertor.component.html',
  styleUrls: ['./convertor-base.css', './document-convertor.component.css']
})
export class DocumentConvertorComponent implements OnDestroy {
  tools: ConvertTool[] = [
    {
      id: 'pdf-word',
      title: 'PDF to Word',
      description: 'Convert PDF files to editable Word documents with high accuracy.',
      icon: 'description',
      accept: '.pdf',
      format: 'PDF',
      targetExt: '.docx',
      type: 'pdf-doc'
    },
    {
      id: 'word-pdf',
      title: 'Word to PDF',
      description: 'Make DOC and DOCX files easy to read by converting them to PDF.',
      icon: 'picture_as_pdf',
      accept: '.doc,.docx',
      format: 'Word',
      targetExt: '.pdf',
      type: 'doc-pdf'
    },
    {
      id: 'jpg-pdf',
      title: 'JPG to PDF',
      description: 'Convert JPG, PNG, and TIFF images to PDF in seconds.',
      icon: 'image',
      accept: '.jpg,.jpeg,.png',
      format: 'Image',
      targetExt: '.pdf',
      type: 'image-pdf'
    },
    {
      id: 'pdf-jpg',
      title: 'PDF to JPG',
      description: 'Extract images from your PDF or save each page as a separate image.',
      icon: 'collections',
      accept: '.pdf',
      format: 'PDF',
      targetExt: '.jpg',
      type: 'pdf-jpg'
    },
    {
      id: 'merge-pdf',
      title: 'Merge PDF',
      description: 'Combine multiple PDF files into one single document easily.',
      icon: 'call_merge',
      accept: '.pdf',
      format: 'PDF',
      targetExt: '.pdf',
      type: 'merge'
    },
    {
      id: 'compress-pdf',
      title: 'Compress PDF',
      description: 'Reduce the file size of your PDF while optimizing for maximal quality.',
      icon: 'compress',
      accept: '.pdf',
      format: 'PDF',
      targetExt: '.pdf',
      type: 'compress'
    },
    {
      id: 'excel-pdf',
      title: 'Excel to PDF',
      description: 'Make Excel spreadsheets easy to read by converting them to PDF.',
      icon: 'table_view',
      accept: '.xls,.xlsx,.csv',
      format: 'Excel',
      targetExt: '.pdf',
      type: 'excel-pdf'
    },
    {
      id: 'pdf-excel',
      title: 'PDF to Excel',
      description: 'Convert PDF data to Excel spreadsheets in just a few clicks.',
      icon: 'view_list',
      accept: '.pdf',
      format: 'PDF',
      targetExt: '.csv',
      type: 'pdf-excel'
    }
  ];

  activeTool: ConvertTool | null = null;
  selectedFiles: File[] = [];
  previewUrl: string | null = null;
  isDragging = false;
  isConverting = false;

  constructor(private router: Router) {}

  ngOnDestroy() {
    this.cleanupPreview();
  }

  openTool(tool: ConvertTool) {
    this.activeTool = tool;
    this.selectedFiles = [];
    this.cleanupPreview();
  }

  closeTool() {
    this.activeTool = null;
    this.selectedFiles = [];
    this.cleanupPreview();
  }

  onFileSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) this.processFiles(files);
  }

  private processFiles(files: File[]) {
    if (!this.activeTool) return;
    const valid = files.filter(f => this.isValidFile(f));
    if (valid.length === 0) return alert(`Select ${this.activeTool.format} files.`);
    if (this.activeTool.type === 'merge') {
      this.selectedFiles = [...this.selectedFiles, ...valid];
    } else {
      this.selectedFiles = [valid[0]];
      this.cleanupPreview();
      if (valid[0].type.startsWith('image/')) this.previewUrl = URL.createObjectURL(valid[0]);
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    if (this.selectedFiles.length === 0) this.cleanupPreview();
  }

  private cleanupPreview() {
    if (this.previewUrl) { URL.revokeObjectURL(this.previewUrl); this.previewUrl = null; }
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.isDragging = false; }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer?.files) this.processFiles(Array.from(e.dataTransfer.files));
  }

  isValidFile(file: File): boolean {
    if (!this.activeTool) return false;
    return this.activeTool.accept.split(',').some(ext => file.name.toLowerCase().endsWith(ext.trim().toLowerCase()));
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async convert() {
    if (this.selectedFiles.length === 0 || !this.activeTool) return;
    this.isConverting = true;
    try {
      switch (this.activeTool.type) {
        case 'image-pdf': await this.convertJpgToPdf(); break;
        case 'doc-pdf': await this.convertDocToPdf(); break;
        case 'pdf-doc': await this.convertPdfToDoc(); break;
        case 'pdf-jpg': await this.convertPdfToJpg(); break;
        case 'merge': await this.mergePdfs(); break;
        case 'compress': await this.compressPdf(); break;
        case 'pdf-excel': await this.convertPdfToExcel(); break;
        case 'excel-pdf': await this.convertExcelToPdf(); break;
        default: this.triggerSimpleDownload();
      }
    } catch (err) {
      console.error(err);
      alert('Error during conversion.');
    } finally {
      this.isConverting = false;
      this.closeTool();
    }
  }

  // --- Highest Fidelity Implementations ---

  private async convertDocToPdf() {
    const file = this.selectedFiles[0];
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Hidden container for docx-preview
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '800px';
      container.style.background = 'white';
      document.body.appendChild(container);

      // docx-preview provides the most accurate DOM rendering of Word files
      await docxPreview.renderAsync(arrayBuffer, container, undefined, {
        ignoreLastRenderedPageBreak: false,
        useBase64URL: true
      });

      // Inject CSS to fix bullet size and remove any accidental borders/shadows
      const style = document.createElement('style');
      style.textContent = `
        /* Only fix big bullets */
        span[style*="symbol"] { font-size: 8pt !important; }
        li::marker { font-size: 10pt !important; }
      `;
      container.appendChild(style);

      // Allow some time for fonts to load and images to render
      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const logo = await this.getLogoBase64();
      if (logo) {
        pdf.addImage(logo, 'PNG', 10, 5, 8, 8);
      }

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      while (heightLeft > 0) {
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
        position -= pdfHeight;
        if (heightLeft > 0) pdf.addPage();
      }

      pdf.save(this.getNewFileName(file, '.pdf', '_taskpulse'));
      document.body.removeChild(container);
    } catch (err) {
      console.error(err);
      alert('High-fidelity conversion failed. Ensure your file is a valid .docx.');
    }
  }

  private async convertPdfToDoc() {
    const file = this.selectedFiles[0];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const sections = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        const rows: any[][] = [];
        items.forEach(item => {
          const y = item.transform[5];
          let foundRow = rows.find(r => Math.abs(r[0].transform[5] - y) < 4);
          if (foundRow) foundRow.push(item);
          else rows.push([item]);
        });

        rows.sort((a, b) => b[0].transform[5] - a[0].transform[5]);
        const children: any[] = [];

        rows.forEach(row => {
          row.sort((a, b) => a.transform[4] - b.transform[4]);
          const firstX = row[0].transform[4];
          const textRuns = row.map(item => new TextRun({
            text: item.str + (item.hasSpace ? ' ' : ''),
            bold: item.fontName?.toLowerCase().includes('bold'),
            size: Math.round(item.transform[0] * 2) || 22,
            font: 'Arial'
          }));

          children.push(new Paragraph({
            children: textRuns,
            indent: { left: Math.round(firstX * 15) },
            spacing: { before: 80, after: 80 },
            alignment: firstX > 250 ? AlignmentType.CENTER : AlignmentType.LEFT
          }));
        });

        sections.push({ children });
      }

      const buffer = await Packer.toBlob(new Document({ sections }));
      FileSaver.saveAs(buffer, this.getNewFileName(file, '.docx', '_taskpulse'));
    } catch (err) {
      alert('Layout extraction failed for this PDF.');
    }
  }

  private async convertPdfToJpg() {
    const file = this.selectedFiles[0];
    const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    canvas.toBlob(b => b && this.downloadBlob(b, this.getNewFileName(file, '.jpg', '_taskpulse')), 'image/jpeg', 0.95);
  }

  private async convertJpgToPdf() {
    const file = this.selectedFiles[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const pdf = new jsPDF({ orientation: img.width > img.height ? 'l' : 'p', unit: 'px', format: [img.width, img.height] });
        pdf.addImage(e.target.result, 'JPEG', 0, 0, img.width, img.height);
        pdf.save(this.getNewFileName(file, '.pdf', '_taskpulse'));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  private async mergePdfs() {
    const merged = await PDFDocument.create();
    for (const f of this.selectedFiles) {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      (await merged.copyPages(doc, doc.getPageIndices())).forEach(p => merged.addPage(p));
    }
    this.downloadBlob(new Blob([await merged.save()], { type: 'application/pdf' }), 'merged_taskpulse.pdf');
  }

  private async getLogoBase64(): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve('');
      img.src = 'icons/icon-72x72.png';
    });
  }

  private async compressPdf() {
    const file = this.selectedFiles[0];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Force optimization by creating a NEW document and copying pages
      const compressedDoc = await PDFDocument.create();
      const copiedPages = await compressedDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((page) => compressedDoc.addPage(page));
      
      const pdfBytes = await compressedDoc.save({
        useObjectStreams: true,
        addDefaultPage: false
      });
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      this.downloadBlob(blob, this.getNewFileName(file, '.pdf', '_compressed'));
    } catch (err) {
      this.triggerSimpleDownload();
    }
  }

  private async convertPdfToExcel() {
    const file = this.selectedFiles[0];
    const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
    let csv = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const text = await (await pdf.getPage(i)).getTextContent();
      const rows: any[][] = [];
      text.items.forEach((item: any) => {
        const y = item.transform[5];
        let r = rows.find(r => Math.abs(r[0].transform[5] - y) < 4);
        if (r) r.push(item); else rows.push([item]);
      });
      rows.sort((a, b) => b[0].transform[5] - a[0].transform[5]);
      rows.forEach(r => csv += r.sort((a,b)=>a.transform[4]-b.transform[4]).map(it=>`"${it.str.replace(/"/g,'""')}"`).join(',')+'\n');
    }
    this.downloadBlob(new Blob([csv], { type: 'text/csv' }), this.getNewFileName(file, '.csv', '_taskpulse'));
  }

  private async convertExcelToPdf() {
    const workbook = XLSX.read(await this.selectedFiles[0].arrayBuffer(), { type: 'array' });
    const data = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    const pdf = new jsPDF();
    autoTable(pdf, { head: [data[0] || []], body: data.slice(1), theme: 'grid' });
    pdf.save(this.getNewFileName(this.selectedFiles[0], '.pdf', '_taskpulse'));
  }

  private triggerSimpleDownload() {
    this.downloadBlob(new Blob([this.selectedFiles[0]], { type: this.selectedFiles[0].type }), this.getNewFileName(this.selectedFiles[0], this.activeTool!.targetExt, '_taskpulse'));
  }

  private downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  private getNewFileName(f: File, ext: string, suffix: string) {
    const base = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
    return `${base}${suffix}${ext}`;
  }
}
