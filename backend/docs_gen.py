"""PDF generators for Mind Matters.

Built-in templates:
  - rkm_donation_receipt  (RKM Foundation receipt format)
  - krm_huf_invoice       (Karan Ramesh Mundhra HUF invoice format)
Generic:
  - simple_statement      (any report - title, meta, table, summary)
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


GOLD = colors.HexColor("#C9A961")
GOLD_SOFT = colors.HexColor("#E4C98C")
INK = colors.HexColor("#111111")
MUTED = colors.HexColor("#555555")
PAPER = colors.HexColor("#FFFFFF")


def _num_to_words_in(n: float) -> str:
    """INR numerals → English words (lakhs/crores)."""
    try:
        n = int(round(float(n)))
    except Exception:
        return str(n)
    if n == 0:
        return "Zero"
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def _two(x):
        if x < 20:
            return ones[x]
        t = x // 10
        o = x % 10
        return (tens[t] + (" " + ones[o] if o else "")).strip()

    def _three(x):
        h = x // 100
        r = x % 100
        s = ""
        if h:
            s += ones[h] + " Hundred"
            if r:
                s += " and "
        if r:
            s += _two(r)
        return s.strip()

    parts = []
    crore = n // 10000000
    n = n % 10000000
    lakh = n // 100000
    n = n % 100000
    thou = n // 1000
    n = n % 1000
    rest = n
    if crore:
        parts.append(_three(crore) + " Crore")
    if lakh:
        parts.append(_three(lakh) + " Lakh")
    if thou:
        parts.append(_three(thou) + " Thousand")
    if rest:
        parts.append(_three(rest))
    return " ".join(parts).strip()


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(name="H1", fontName="Helvetica-Bold", fontSize=22, textColor=INK, leading=26))
    ss.add(ParagraphStyle(name="H2", fontName="Helvetica-Bold", fontSize=14, textColor=INK, leading=18))
    ss.add(ParagraphStyle(name="Lead", fontName="Helvetica", fontSize=10, textColor=MUTED, leading=14))
    ss.add(ParagraphStyle(name="Label", fontName="Helvetica-Bold", fontSize=9, textColor=MUTED,
                          spaceAfter=2, letterSpacing=1))
    ss.add(ParagraphStyle(name="Val", fontName="Helvetica", fontSize=11, textColor=INK))
    ss.add(ParagraphStyle(name="Tiny", fontName="Helvetica", fontSize=8, textColor=MUTED))
    ss.add(ParagraphStyle(name="GoldTitle", fontName="Helvetica-Bold", fontSize=28,
                          textColor=GOLD, alignment=1, leading=30, letterSpacing=3))
    ss.add(ParagraphStyle(name="CenterSmall", fontName="Helvetica", fontSize=9, alignment=1, textColor=MUTED))
    return ss


def _kv_row(label, value, ss):
    return [Paragraph(label.upper(), ss["Label"]), Paragraph(str(value or "—"), ss["Val"])]


def render_rkm_receipt(data: dict) -> bytes:
    """data keys: receipt_no, date, donor_name, sum_rupees (number), for_payment_of, by,
       mobile, email, address, pan, received_by_name, received_by_mobile."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
    )
    ss = _styles()
    story = []

    # Title block
    story.append(Paragraph("R.K.M. FOUNDATION", ss["H1"]))
    story.append(Paragraph(
        "Block No 3, 2nd Floor, Sane Guruji Premises,<br/>"
        "386, S.V. Savarkar Marg, Opposite Siddhivinayak Temple,<br/>"
        "Prabhadevi, Mumbai - 400025, Maharashtra, India.<br/>"
        "Phone: 9920780005",
        ss["Lead"],
    ))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.8, color=GOLD))
    story.append(Spacer(1, 6))
    story.append(Paragraph("DONATION RECEIPT", ss["GoldTitle"]))
    story.append(Spacer(1, 8))

    meta_tbl = Table(
        [
            [Paragraph("Date", ss["Label"]), Paragraph(str(data.get("date") or datetime.now().strftime("%d-%m-%Y")), ss["Val"]),
             Paragraph("Receipt No.", ss["Label"]), Paragraph(str(data.get("receipt_no") or "—"), ss["Val"])],
            [Paragraph("PAN No.", ss["Label"]), Paragraph("AACTR4271L", ss["Val"]),
             Paragraph("Registration No.", ss["Label"]), Paragraph("CIT(E)/80G/979(2014-15)/2016-17", ss["Val"])],
        ],
        colWidths=[25 * mm, 45 * mm, 35 * mm, 70 * mm],
    )
    meta_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.4, GOLD),
        ("LINEBELOW", (0, -1), (-1, -1), 0.4, GOLD),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#FAF6EC"), colors.HexColor("#F8F1E0")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 12))

    # Main body
    amount = float(data.get("sum_rupees") or 0)
    body = Table(
        [
            [Paragraph("Received with thanks from", ss["Label"])],
            [Paragraph(f"<b>{data.get('donor_name') or '—'}</b>", ss["Val"])],
            [Paragraph("The sum of Rupees", ss["Label"])],
            [Paragraph(f"<b>{_num_to_words_in(amount)} Only</b>  (₹ {amount:,.2f})", ss["Val"])],
            [Paragraph("For payment of", ss["Label"])],
            [Paragraph(data.get("for_payment_of") or "—", ss["Val"])],
            [Paragraph("By (Mode of Payment)", ss["Label"])],
            [Paragraph(data.get("by") or "—", ss["Val"])],
        ],
        colWidths=[175 * mm],
    )
    body.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(body)
    story.append(Spacer(1, 14))

    # Donor details box
    dd = Table(
        [
            _kv_row("Name", data.get("donor_name"), ss),
            _kv_row("Mobile", data.get("mobile"), ss),
            _kv_row("Email", data.get("email"), ss),
            _kv_row("Address", data.get("address"), ss),
            _kv_row("PAN", data.get("pan"), ss),
        ],
        colWidths=[35 * mm, 140 * mm],
    )
    dd.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, GOLD_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(dd)
    story.append(Spacer(1, 16))

    # Total band
    total = Table(
        [[Paragraph("TOTAL", ss["Label"]), Paragraph(f"<b>₹ {amount:,.2f}</b>", ss["H2"])]],
        colWidths=[130 * mm, 45 * mm],
    )
    total.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(total)
    story.append(Spacer(1, 20))

    # Received by / signature
    sig = Table(
        [
            [Paragraph("Received By", ss["Label"]), ""],
            [Paragraph(f"Name: {data.get('received_by_name') or '—'}", ss["Val"]),
             Paragraph("Authorised Signatory", ss["Tiny"])],
            [Paragraph(f"Mobile: {data.get('received_by_mobile') or '—'}", ss["Val"]),
             Paragraph("____________________________", ss["Tiny"])],
        ],
        colWidths=[100 * mm, 75 * mm],
    )
    sig.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(sig)

    story.append(Spacer(1, 18))
    story.append(HRFlowable(width="100%", thickness=0.3, color=GOLD_SOFT))
    story.append(Paragraph(
        "This donation is eligible for tax exemption under Section 80G of the Income Tax Act, 1961.",
        ss["CenterSmall"],
    ))

    doc.build(story)
    return buf.getvalue()


def render_krm_invoice(data: dict) -> bytes:
    """data keys: invoice_no, date, reference,
       bill_to (dict: name, address, gstin), ship_to (same),
       items (list of {description, hsn, quantity, unit_price, total}),
       gst (default 0), round_off, notes, signatory (default 'KARAN RAMESH MUNDHRA HUF')."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
    )
    ss = _styles()
    story = []

    # Header block
    hdr = Table(
        [
            [
                Paragraph("KARAN RAMESH MUNDHRA HUF", ss["H1"]),
                Paragraph("<b>INVOICE</b>", ParagraphStyle(
                    name="INV", fontName="Helvetica-Bold", fontSize=24,
                    textColor=GOLD, alignment=2, letterSpacing=4,
                )),
            ],
        ],
        colWidths=[100 * mm, 78 * mm],
    )
    hdr.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(hdr)
    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD))
    story.append(Spacer(1, 8))

    # Meta row
    meta = Table(
        [
            [Paragraph("Invoice No.", ss["Label"]), Paragraph(data.get("invoice_no") or "—", ss["Val"]),
             Paragraph("Date", ss["Label"]), Paragraph(str(data.get("date") or datetime.now().strftime("%d-%m-%Y")), ss["Val"]),
             Paragraph("Reference", ss["Label"]), Paragraph(data.get("reference") or "—", ss["Val"])],
        ],
        colWidths=[24 * mm, 38 * mm, 15 * mm, 30 * mm, 22 * mm, 49 * mm],
    )
    meta.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.3, GOLD_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta)
    story.append(Spacer(1, 10))

    # Bill/Ship to
    bt = data.get("bill_to") or {}
    st = data.get("ship_to") or bt
    addr_tbl = Table(
        [[
            Paragraph(
                f"<b>BILL TO</b><br/><br/><b>{bt.get('name','—')}</b><br/>{bt.get('address','—')}<br/>GSTIN: {bt.get('gstin','—')}",
                ss["Val"]),
            Paragraph(
                f"<b>SHIP TO</b><br/><br/><b>{st.get('name','—')}</b><br/>{st.get('address','—')}<br/>GSTIN: {st.get('gstin','—')}",
                ss["Val"]),
        ]],
        colWidths=[89 * mm, 89 * mm],
    )
    addr_tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.3, GOLD_SOFT),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GOLD_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(addr_tbl)
    story.append(Spacer(1, 12))

    # Line items
    items = data.get("items") or []
    head = ["Sr.", "Description", "HSN", "Qty", "Unit Price (₹)", "Total (₹)"]
    rows = [head]
    sub = 0.0
    for i, it in enumerate(items, 1):
        qty = float(it.get("quantity") or 0)
        unit = float(it.get("unit_price") or 0)
        tot = float(it.get("total") or (qty * unit))
        sub += tot
        rows.append([
            str(i),
            Paragraph(it.get("description") or "—", ss["Val"]),
            it.get("hsn") or "—",
            f"{qty:,.2f}",
            f"{unit:,.2f}",
            f"{tot:,.2f}",
        ])
    if not items:
        rows.append(["—", "No line items", "—", "—", "—", "—"])
    items_tbl = Table(rows, colWidths=[10 * mm, 70 * mm, 20 * mm, 18 * mm, 30 * mm, 30 * mm])
    items_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GOLD),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, GOLD_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.4, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PAPER, colors.HexColor("#FBF6E7")]),
    ]))
    story.append(items_tbl)

    # Totals
    gst = float(data.get("gst") or 0)
    round_off = float(data.get("round_off") or 0)
    total_due = sub + gst + round_off
    totals = Table(
        [
            ["", "", "Sub Total", f"₹ {sub:,.2f}"],
            ["", "", "GST", f"₹ {gst:,.2f}"],
            ["", "", "Round Off", f"₹ {round_off:,.2f}"],
            ["", "", "TOTAL DUE", f"₹ {total_due:,.2f}"],
        ],
        colWidths=[70 * mm, 28 * mm, 40 * mm, 40 * mm],
    )
    totals.setStyle(TableStyle([
        ("LINEABOVE", (2, 0), (-1, 0), 0.3, GOLD_SOFT),
        ("FONTNAME", (2, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (2, -1), (-1, -1), 11),
        ("BACKGROUND", (2, -1), (-1, -1), GOLD),
        ("TEXTCOLOR", (2, -1), (-1, -1), colors.white),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(totals)
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"<i>Amount in words: {_num_to_words_in(total_due)} Only</i>", ss["Lead"]))
    story.append(Spacer(1, 14))

    # Bank details box
    bank = data.get("bank") or {
        "name": "YES BANK",
        "account_holder": "KARAN RAMESH MUNDHRA HUF",
        "account_number": "009963400000628",
        "ifsc": "YESB0000099",
        "pan": "AAOHK7058N",
    }
    bank_tbl = Table(
        [[Paragraph(
            f"<b>BANK DETAILS</b><br/>"
            f"Bank: {bank.get('name')}<br/>"
            f"A/C Holder: {bank.get('account_holder')}<br/>"
            f"A/C No.: {bank.get('account_number')}<br/>"
            f"IFSC: {bank.get('ifsc')}<br/>"
            f"PAN: {bank.get('pan')}",
            ss["Val"]),
          Paragraph(
              "<br/><br/><br/>_____________________<br/>"
              f"<b>{data.get('signatory') or 'KARAN RAMESH MUNDHRA HUF'}</b><br/>"
              "Authorised Signatory",
              ss["CenterSmall"]),
          ]],
        colWidths=[95 * mm, 83 * mm],
    )
    bank_tbl.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.3, GOLD_SOFT),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GOLD_SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(bank_tbl)

    doc.build(story)
    return buf.getvalue()


def render_simple_statement(title: str, subtitle: str, meta: dict, table_headers: list,
                            table_rows: list, summary_rows: list = None, footer: str = "") -> bytes:
    """Generic dark/gold report page — used for loan statements, tasks-for-person, etc."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16 * mm, rightMargin=16 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
    )
    ss = _styles()
    story = []

    story.append(Paragraph("MIND MATTERS", ParagraphStyle(
        name="brand", fontName="Helvetica-Bold", fontSize=9,
        textColor=GOLD, letterSpacing=4,
    )))
    story.append(Spacer(1, 2))
    story.append(Paragraph(title, ss["H1"]))
    if subtitle:
        story.append(Paragraph(subtitle, ss["Lead"]))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD))
    story.append(Spacer(1, 10))

    # meta grid
    if meta:
        flat = []
        for k, v in meta.items():
            flat.append([Paragraph(str(k).upper(), ss["Label"]), Paragraph(str(v), ss["Val"])])
        mt = Table(flat, colWidths=[40 * mm, 140 * mm])
        mt.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(mt)
        story.append(Spacer(1, 10))

    # table
    if table_headers:
        rows = [table_headers] + (table_rows or [])
        t = Table(rows, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, GOLD_SOFT),
            ("BOX", (0, 0), (-1, -1), 0.4, GOLD),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [PAPER, colors.HexColor("#FBF6E7")]),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    # summary
    if summary_rows:
        for k, v in summary_rows:
            story.append(Paragraph(f"<b>{k}:</b> {v}", ss["Val"]))
    if footer:
        story.append(Spacer(1, 16))
        story.append(Paragraph(footer, ss["CenterSmall"]))

    doc.build(story)
    return buf.getvalue()


# Built-in template metadata
BUILTIN_TEMPLATES = [
    {
        "id": "rkm_donation_receipt",
        "name": "RKM Foundation — Donation Receipt",
        "kind": "receipt",
        "builtin": True,
        "required_fields": [
            {"key": "receipt_no", "label": "Receipt No.", "type": "text"},
            {"key": "date", "label": "Date", "type": "date"},
            {"key": "donor_name", "label": "Donor name", "type": "text"},
            {"key": "sum_rupees", "label": "Amount (₹)", "type": "number"},
            {"key": "for_payment_of", "label": "For payment of", "type": "text"},
            {"key": "by", "label": "Mode of payment", "type": "text",
             "placeholder": "Cheque / Online / Cash"},
            {"key": "mobile", "label": "Donor mobile", "type": "text"},
            {"key": "email", "label": "Donor email", "type": "text"},
            {"key": "address", "label": "Donor address", "type": "textarea"},
            {"key": "pan", "label": "Donor PAN", "type": "text"},
            {"key": "received_by_name", "label": "Received by (name)", "type": "text"},
            {"key": "received_by_mobile", "label": "Received by (mobile)", "type": "text"},
        ],
    },
    {
        "id": "krm_huf_invoice",
        "name": "K.R.M. HUF — Invoice",
        "kind": "invoice",
        "builtin": True,
        "required_fields": [
            {"key": "invoice_no", "label": "Invoice No.", "type": "text"},
            {"key": "date", "label": "Date", "type": "date"},
            {"key": "reference", "label": "Reference", "type": "text"},
            {"key": "bill_to.name", "label": "Bill to — name", "type": "text"},
            {"key": "bill_to.address", "label": "Bill to — address", "type": "textarea"},
            {"key": "bill_to.gstin", "label": "Bill to — GSTIN", "type": "text"},
            {"key": "ship_to.name", "label": "Ship to — name (optional)", "type": "text"},
            {"key": "ship_to.address", "label": "Ship to — address (optional)", "type": "textarea"},
            {"key": "ship_to.gstin", "label": "Ship to — GSTIN (optional)", "type": "text"},
            {"key": "items", "label": "Line items (description, hsn, quantity, unit_price)",
             "type": "items"},
            {"key": "gst", "label": "GST (₹)", "type": "number"},
            {"key": "round_off", "label": "Round off (₹)", "type": "number"},
        ],
    },
]


def render_by_template_id(template_id: str, data: dict) -> bytes:
    if template_id == "rkm_donation_receipt":
        return render_rkm_receipt(data)
    if template_id == "krm_huf_invoice":
        return render_krm_invoice(data)
    raise ValueError(f"Unknown template: {template_id}")
