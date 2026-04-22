import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const C = {
  white:      [255, 255, 255],
  navy:       [26,  54,  93],
  blue:       [37,  99,  235],
  blueLight:  [219, 234, 254],
  gray50:     [249, 250, 251],
  gray100:    [243, 244, 246],
  gray200:    [229, 231, 235],
  gray400:    [156, 163, 175],
  gray600:    [75,  85,  99],
  gray800:    [31,  41,  55],
  red:        [220, 38,  38],
  redLight:   [254, 226, 226],
  green:      [22,  163, 74],
  greenLight: [220, 252, 231],
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return C.gray400
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function hdr(doc, title, subtitle, PW) {
  doc.setFillColor(...C.navy)
  doc.rect(0, 0, PW, 26, 'F')
  // ProPOR+ brand — left side
  doc.setTextColor(...C.white)
  doc.setFontSize(15); doc.setFont('helvetica', 'bold')
  doc.text('ProPOR+', 14, 11)
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 230)
  doc.text('PRODUCTION · POINT · OF · RENTAL', 14, 17.5)
  // Event name — center, large bold
  doc.setTextColor(...C.white)
  doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(title, PW / 2, 12, { align: 'center' })
  if (subtitle) {
    doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 200, 230)
    doc.text(subtitle, PW / 2, 19, { align: 'center' })
  }
  doc.setFillColor(...C.blue)
  doc.rect(0, 26, PW, 1.2, 'F')
}

function statBox(doc, x, y, w, h, label, value, bg, fg) {
  doc.setFillColor(...(bg || C.gray100)); doc.setDrawColor(...C.gray200)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
  doc.setTextColor(...C.gray600); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
  doc.text(label, x + w / 2, y + 5.5, { align: 'center' })
  doc.setTextColor(...(fg || C.gray800)); doc.setFontSize(13); doc.setFont('helvetica', 'bold')
  doc.text(String(value), x + w / 2, y + 14, { align: 'center' })
}

function dim(b) {
  return (b.l || b.length || 0) + 'in x ' + (b.w || b.width || 0) + 'in x ' + (b.h || b.height || 0) + 'in'
}

function buildWarehouseRows(packed) {
  const sortedCases = [...(packed || [])].sort((a, b) => {
    const ao = a.loadOrder || 0
    const bo = b.loadOrder || 0
    return ao - bo
  })

  const rows = []
  sortedCases.forEach((c, i) => {
    const order = String(c.loadOrder || (i + 1))
    const caseName = c.name || 'Unnamed Case'
    const caseQty = String(c.quantity || 1)
    const caseItems = Array.isArray(c.items) ? c.items : []

    if (caseItems.length === 0) {
      rows.push([order, caseName, '(No contents listed)', '-', caseQty])
      return
    }

    caseItems.forEach(ci => {
      rows.push([
        order,
        caseName,
        ci.name || `Item #${ci.id || ''}`,
        String(ci.qty || 1),
        caseQty,
      ])
    })
  })

  return rows
}

export function generateLoadPlanPDF(plan, packed, unpacked, callSheet, truck, departments) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const planName = plan.name || 'Load Plan'
  const truckName = (truck && truck.name) ? truck.name : 'Truck'
  const eventName = plan.eventName || planName
  const eventDate = plan.eventDate
    ? new Date(plan.eventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : date
  const warehouseNotes = (plan.warehouseNotes || '').trim()
  const warehouseRows = buildWarehouseRows(packed)
  const truckOrderRows = (callSheet && callSheet.length > 0)
    ? callSheet.map(function(row, i) {
      return [
        String(row.callPosition || (i + 1)),
        row.name || '',
        String(row.quantity || 1),
      ]
    })
    : [...(packed || [])]
      .sort((a, b) => (a.loadOrder || 0) - (b.loadOrder || 0))
      .map(function(row, i) {
        return [
          String(row.loadOrder || (i + 1)),
          row.name || '',
          String(row.quantity || 1),
        ]
      })

  // Page 1 white background + header
  doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
  hdr(doc, eventName, truckName + '  ·  ' + eventDate, PW)

  const sY = 32, sH = 18, sg = 3
  const sW = (PW - 28 - sg * 3) / 4
  statBox(doc, 14,            sY, sW, sH, 'UTILIZATION',  Math.round(plan.utilization || 0) + '%', C.blueLight, C.blue)
  statBox(doc, 14+sW+sg,      sY, sW, sH, 'TOTAL WEIGHT', (plan.totalWeight || 0).toLocaleString() + ' lbs', C.gray100, C.gray800)
  statBox(doc, 14+(sW+sg)*2,  sY, sW, sH, 'LINE ITEMS', String(warehouseRows.length), C.greenLight, C.green)
  statBox(doc, 14+(sW+sg)*3,  sY, sW, sH, 'DID NOT FIT',  String(unpacked.length),
    unpacked.length > 0 ? C.redLight : C.gray100, unpacked.length > 0 ? C.red : C.gray400)

  let y = sY + sH + 6

  if (truck) {
    doc.setFillColor(...C.gray100); doc.setDrawColor(...C.gray200)
    doc.roundedRect(14, y, PW - 28, 9, 1.5, 1.5, 'FD')
    doc.setTextColor(...C.gray600); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text(
      truckName + '  -  ' + (truck.length||0) + 'in L x ' + (truck.width||0) + 'in W x ' + (truck.height||0) + 'in H  -  Max: ' + (truck.max_weight || 0).toLocaleString() + ' lbs',
      PW / 2, y + 5.5, { align: 'center' }
    )
    y += 13
  }

  if (departments && departments.length > 0) {
    doc.setTextColor(...C.gray400); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold')
    doc.text('DEPARTMENTS:', 14, y + 3.5)
    let lx = 46
    for (const dept of departments) {
      doc.setFillColor(...hexToRgb(dept.color || '#6b7280'))
      doc.roundedRect(lx, y + 1, 3, 3, 0.5, 0.5, 'F')
      doc.setTextColor(...C.gray800); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
      doc.text(dept.name, lx + 4.5, y + 3.8)
      lx += doc.getTextWidth(dept.name) + 11
      if (lx > PW - 20) { lx = 46; y += 5 }
    }
    y += 8
  }

  doc.setTextColor(...C.navy); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
  doc.text('WAREHOUSE PULL LIST', 14, y + 4)
  doc.setFillColor(...C.blue); doc.rect(14, y + 5.5, 28, 0.5, 'F')
  y += 9

  // willDrawPage fires BEFORE table content on each page (including page 1).
  // We use a flag to skip page 1 since we already drew the header and stat boxes above.
  let manifestFirstPage = true
  autoTable(doc, {
    startY: y,
    head: [['LOAD #', 'CASE', 'LINE ITEM', 'ITEM QTY', 'CASE QTY']],
    body: warehouseRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2.2, textColor: C.gray800, lineColor: C.gray200, lineWidth: 0.2 },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray50 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 52 },
      2: { cellWidth: 74 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    willDrawPage: function(data) {
      if (manifestFirstPage) { manifestFirstPage = false; return }
      doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
      hdr(doc, eventName + ' — Warehouse Pull (cont.)', eventDate, PW)
      data.settings.startY = 32
    },
  })

  if (unpacked.length > 0) {
    const uy = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 8
    doc.setTextColor(...C.red); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold')
    doc.text('CASES THAT DID NOT FIT', 14, uy)
    autoTable(doc, {
      startY: uy + 5,
      head: [['CASE NAME', 'SKU', 'DEPT', 'DIMENSIONS', 'WEIGHT', 'REASON']],
      body: unpacked.map(function(b) {
        return [
          b.name || '',
          b.sku || '-',
          b.department_name || '-',
          (b.length||0) + 'in x ' + (b.width||0) + 'in x ' + (b.height||0) + 'in',
          (b.weight||0) + ' lbs',
          b.reason === 'weight_limit' ? 'Weight Limit' : 'No Space'
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, textColor: C.gray800, lineColor: C.gray200, lineWidth: 0.2 },
      headStyles: { fillColor: C.red, textColor: C.white, fontSize: 6.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.redLight },
      margin: { left: 14, right: 14 },
    })
  }

  // Truck pack order page
  doc.addPage()
  doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
  hdr(doc, 'TRUCK PACK ORDER  ·  ' + eventName, truckName + '  ·  ' + eventDate, PW)

  doc.setFillColor(...C.blueLight); doc.setDrawColor(...C.blue)
  doc.roundedRect(14, 32, PW - 28, 14, 2, 2, 'FD')
  doc.setTextColor(...C.navy); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
  doc.text('TRUCK PACK INSTRUCTIONS', PW / 2, 38, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Load cases in order from BACK to FRONT. Use this list as the truck pack sequence.', PW / 2, 43, { align: 'center' })

  doc.setFillColor(...C.gray100); doc.setDrawColor(...C.gray200)
  doc.roundedRect(14, 49, PW - 28, 17, 2, 2, 'FD')
  doc.setTextColor(...C.gray600); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
  doc.text('WAREHOUSE NOTES', 16, 53.5)
  doc.setTextColor(...C.gray800); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  const noteText = warehouseNotes || 'No warehouse notes provided.'
  doc.text(noteText, 16, 58, { maxWidth: PW - 32 })

  let callFirstPage = true
  autoTable(doc, {
    startY: 71,
    head: [['ORDER', 'CASE NAME', 'QTY']],
    body: truckOrderRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, textColor: C.gray800, lineColor: C.gray200, lineWidth: 0.25, minCellHeight: 10 },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.gray50 },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold', textColor: C.blue },
      1: { cellWidth: 145 },
      2: { cellWidth: 18, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    willDrawPage: function(data) {
      if (callFirstPage) { callFirstPage = false; return }
      doc.setFillColor(...C.white); doc.rect(0, 0, PW, PH, 'F')
      hdr(doc, 'TRUCK PACK ORDER (cont.)  ·  ' + eventName, eventDate, PW)
      data.settings.startY = 32
    },
  })

  const lastY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 200) + 8
  if (lastY < PH - 20) {
    doc.setTextColor(...C.gray400); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
    doc.text('Total Cases: ' + packed.length + '  -  ProPOR+  -  ' + eventDate, PW / 2, lastY, { align: 'center' })
  }

  return doc
}
