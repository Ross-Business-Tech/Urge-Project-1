"""Builds a set of FICTIONAL deal documents for testing "Scan documents with AI".
Every name, address, company and number is made up. Run:
    python3 deliverables/test-documents/src/make_test_docs.py
Outputs (next to this folder): Loan Application.docx, Underwriting Model.xlsx, Answer Key.xlsx,
plus term-sheet.html / financial-statements.html that are printed to PDF separately."""
import os
from docx import Document
from docx.shared import Pt, RGBColor
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
BANNER = 'SAMPLE FOR TESTING ONLY: fictional borrower, people, addresses and numbers.'

D = dict(
    firm='Riverbend Collective Development LLC', city='Detroit, MI', principal='Maya Okafor', title='Managing Member',
    years=7, projects=5, tdc_done=4800000, units_done=18, comm_done=9000, sqft_done=26000,
    project='Elm & Fifth Lofts', address='740 Example Boulevard, Detroit, MI (fictional)',
    loan=1200000, rate=7.25, term=60, io=24, amort=15, orig=1.0, success=3.0,
    units=32, comm=6500, sqft=38000, tdc=11400000,
    sources=[('Senior construction loan (bank)', 7410000), ('Outside investor equity', 2280000), ('Sponsor equity (funded by EBIARA loan)', 700000), ('City HOME funds', 1010000)],
    uses=[('Land acquisition', 1150000), ('Hard construction costs', 7980000), ('Soft costs', 1420000), ('Financing costs & reserves', 850000)],
    loan_uses=[('Sponsor equity contribution to project', 700000), ('Interest reserve', 174000), ('Predevelopment (architecture, permits, environmental)', 256000), ('Closing and legal costs', 70000)],
    fin=[(2023, 'Actual', 820000, 61000), (2024, 'Actual', 960000, 74000), (2025, 'Actual', 1090000, 88000), (2026, 'Projected', 1310000, 112000), (2027, 'Projected', 1520000, 139000)],
    assets=3100000, liabilities=1850000, equity=1250000, cash=285000,
    proj=[(2028, 742000, 286000, 398000), (2029, 781000, 295000, 398000), (2030, 805000, 303000, 398000), (2031, 829000, 312000, 398000)],
    exit_proceeds=2150000, exit_month=54,
)
m = lambda n: f'${n:,.0f}'

# ------------------------------------------------------------------ Loan application (Word)
doc = Document()
st = doc.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(11)
p = doc.add_paragraph(); r = p.add_run(BANNER); r.bold = True; r.font.color.rgb = RGBColor(0xC0, 0, 0)
doc.add_heading('Loan Application: Riverbend Collective Development LLC', 0)
doc.add_paragraph('Submitted to: EBIARA Fund   |   Date: October 2026')
doc.add_heading('1. Borrower', 1)
for k, v in [('Company', D['firm']), ('Headquarters', D['city']), ('Principal', f"{D['principal']}, {D['title']} (owns 100% of the company)"),
             ('Years in real estate development', str(D['years'])), ('Projects completed', str(D['projects'])),
             ('Total development cost of completed projects', m(D['tdc_done'])), ('Residential units completed', str(D['units_done'])),
             ('Commercial space completed', f"{D['comm_done']:,} sq ft"), ('Total square footage completed', f"{D['sqft_done']:,} sq ft")]:
    doc.add_paragraph(f'{k}: {v}', style='List Bullet')
doc.add_heading('2. About the principal', 1)
doc.add_paragraph('Maya Okafor worked for five years as a development associate at a regional affordable-housing nonprofit before founding Riverbend in 2019. '
                  'Since then the firm has completed five small residential and mixed-use projects in Detroit neighborhoods, all delivered within budget. '
                  'Maya will personally guarantee the loan.')
doc.add_paragraph('notes from our call (rough):')
for t in ['grew up on the east side, wants to build where she grew up', 'board member, neighborhood development association',
          'firm has 4 staff, plans to hire a construction manager']:
    doc.add_paragraph(t, style='List Bullet')
doc.add_heading('3. The project', 1)
doc.add_paragraph(f"Project: {D['project']}, {D['address']}. Project type: multifamily mixed-use, new construction on a lot that has been vacant for 12 years. "
                  f"The building will have {D['units']} apartments and {D['comm']:,} sq ft of ground-floor commercial space ({D['sqft']:,} sq ft in total). "
                  f"Total development cost: {m(D['tdc'])}. The team has site control and expects to start construction in Summer 2027.")
doc.add_paragraph('Affordability:')
doc.add_paragraph('4 units at 50% of area median income (AMI)', style='List Bullet')
doc.add_paragraph('6 units at 80% AMI', style='List Bullet')
doc.add_paragraph('22 units at market rate', style='List Bullet')
doc.add_paragraph('Who it serves: working families and young professionals who grew up in the neighborhood, plus two local small businesses for the retail space.')
doc.add_paragraph('Neighborhood: the site is in a strategic neighborhood identified by the city, two blocks from a bus rapid transit stop, near a new grocery store and a public school. '
                  'Walk Score: 81. The project is expected to create 38 permanent jobs and 75 construction jobs.')
doc.add_heading('4. Why we need the loan', 1)
doc.add_paragraph('- cover our share of equity in the project\n- fund an interest reserve\n- finish predevelopment (architecture, permits, environmental)\n- closing and legal costs')
doc.add_paragraph('Growth plan: two more mixed-use projects in the next three years, which would take the firm from small residential buildings to larger mixed-use development.')
doc.add_heading('5. Ownership structure', 1)
doc.add_paragraph('Maya Okafor owns 100% of Riverbend Collective Development LLC, which is the managing member (25%) of Elm & Fifth Lofts LLC. Two outside investors own the other 75% of the project company.')
doc.add_heading('6. Development team', 1)
t = doc.add_table(rows=1, cols=4); t.style = 'Table Grid'
for i, h in enumerate(['Name', 'Company', 'Role', 'Short bio']): t.rows[0].cells[i].text = h
for row in [('Maya Okafor', 'Riverbend Collective Development', 'Developer / Principal', 'Founder; leads financing, design and construction oversight. 7 years in development.'),
            ('Daniel Reyes', 'Sample Architecture Group', 'Architect', 'Licensed architect; 12 years designing mid-size multifamily buildings.'),
            ('Priya Shah', 'Example Builders Inc.', 'General Contractor', 'GC with 40+ completed multifamily and retail projects in the region.'),
            ('Owen Brooks', 'Placeholder Property Management', 'Property Manager', 'Manages about 600 affordable and market-rate units in Detroit.')]:
    cells = t.add_row().cells
    for i, v in enumerate(row): cells[i].text = v
doc.save(os.path.join(OUT, 'Loan Application - Riverbend (sample).docx'))

# ------------------------------------------------------------------ Underwriting model (Excel, values only)
wb = Workbook()
hdr = Font(bold=True, color='FFFFFF'); fill = PatternFill('solid', fgColor='13284C')
def sheet(ws, title, rows, widths):
    ws.append([BANNER]); ws['A1'].font = Font(bold=True, color='C00000')
    ws.append([title]); ws['A2'].font = Font(bold=True, size=13)
    for r in rows: ws.append(list(r))
    for col, w in zip('ABCDEFG', widths): ws.column_dimensions[col].width = w
ws = wb.active; ws.title = 'Sources & Uses'
rows = [(), ('PROJECT SOURCES', 'Amount', '% of total')]
rows += [(n, a, round(a / D['tdc'], 3)) for n, a in D['sources']] + [('Total sources', sum(a for _, a in D['sources']), 1.0), ()]
rows += [('PROJECT USES', 'Amount', '% of total')] + [(n, a, round(a / D['tdc'], 3)) for n, a in D['uses']] + [('Total uses', sum(a for _, a in D['uses']), 1.0), ()]
rows += [('EBIARA LOAN USES', 'Amount', '')] + [(n, a, '') for n, a in D['loan_uses']] + [('Total EBIARA loan', D['loan'], '')]
sheet(ws, f"{D['project']}: Sources & Uses", rows, [52, 16, 12])
ws = wb.create_sheet('Project Pro Forma')
rows = [(), ('Fiscal year', 'Revenue', 'Operating expenses', 'Net operating income', 'Debt service', 'DSCR')]
rows += [(y, r, o, r - o, d, round((r - o) / d, 2)) for y, r, o, d in D['proj']]
rows += [(), ('Underwriting adjustments', '', '', '', '', ''), ('Borrower vacancy assumption', 0.05), ('Underwritten vacancy', 0.08),
         ('Reduction applied to borrower rents', 0.07), ('Note', 'Borrower’s market-rate rents are above comparable new buildings within one mile; underwriting reduced them.'),
         (), ('Expected repayment proceeds (refinance, sponsor share)', D['exit_proceeds']), ('Expected in month', D['exit_month'])]
sheet(ws, f"{D['project']}: Project cash flow (as underwritten)", rows, [44, 14, 20, 22, 14, 8])
ws = wb.create_sheet('Firm Financials')
rows = [(), ('Year', 'Type', 'Revenue', 'Net income')] + [tuple(r) for r in D['fin']]
rows += [(), ('Balance sheet (Dec 31, 2025)', ''), ('Total assets', D['assets']), ('Total liabilities', D['liabilities']), ('Total equity', D['equity']), ('Cash on hand', D['cash'])]
sheet(ws, 'Riverbend Collective Development LLC: Firm financials', rows, [32, 14, 14, 14])
for w in wb.worksheets:
    for row in w.iter_rows(min_row=3):
        for c in row:
            if isinstance(c.value, (int, float)) and not isinstance(c.value, bool):
                c.number_format = '0.0%' if (isinstance(c.value, float) and c.value <= 1.0) else ('0' if (isinstance(c.value, int) and 1900 < c.value < 2100) else '#,##0')
            if isinstance(c.value, str) and c.value.isupper() or c.value in ('Fiscal year', 'Year'):
                c.font = Font(bold=True)
wb.save(os.path.join(OUT, 'Underwriting Model - Elm & Fifth (sample).xlsx'))

# ------------------------------------------------------------------ Answer key
ak = Workbook(); a = ak.active; a.title = 'Answer key'
a.append(['Answer key: what “Scan documents with AI” should fill in from these sample files']); a['A1'].font = Font(bold=True, size=13)
a.append([BANNER]); a['A2'].font = Font(color='C00000')
a.append(['Deal data field', 'Correct value', 'Found in', 'AI result (fill in)', 'Match? (Y/N)'])
for c in a[3]: c.font = hdr; c.fill = fill
rows = [
 ('Borrower firm name', D['firm'], 'Loan application'), ('Firm location', D['city'], 'Loan application'), ('Principal name', D['principal'], 'Loan application'),
 ('Principal title', D['title'], 'Loan application'), ('Years of experience', D['years'], 'Loan application'), ('Projects completed', D['projects'], 'Loan application'),
 ('Total development costs completed', D['tdc_done'], 'Loan application'), ('Residential units completed', D['units_done'], 'Loan application'),
 ('Commercial space completed (sq ft)', D['comm_done'], 'Loan application'), ('Total square footage completed', D['sqft_done'], 'Loan application'),
 ('Borrower stage (suggested)', 'Emerging ($1M–$10M developed)', 'App suggests from development completed'),
 ('Loan amount', D['loan'], 'Term sheet'), ('Interest rate (%)', D['rate'], 'Term sheet'), ('Term (months)', D['term'], 'Term sheet'),
 ('Repayment structure', 'Interest-only period, then amortizing', 'Term sheet'), ('Interest-only period (months)', D['io'], 'Term sheet'),
 ('Amortize over (years)', D['amort'], 'Term sheet'), ('Origination fee (%)', D['orig'], 'Term sheet'), ('Success fee (%)', D['success'], 'Term sheet'),
 ('Interest reserve?', 'Yes', 'Term sheet'), ('Collateral', 'Second mortgage on the project; first lien on a fourplex at 15 Sample Court (fictional)', 'Term sheet'),
 ('Guarantee', 'Full personal guarantee from Maya Okafor', 'Term sheet'),
 ('How the loan will be used', '; '.join(f'{n} {m(x)}' for n, x in D['loan_uses']), 'Term sheet / model'),
 ('Project name', D['project'], 'Loan application'), ('Location / address', D['address'], 'Loan application'), ('Project type', 'Multifamily mixed-use', 'Loan application'),
 ('Total project size (sq ft)', D['sqft'], 'Loan application'), ('Residential units', D['units'], 'Loan application'),
 ('Affordable units by AMI level', '4 at 50% AMI; 6 at 80% AMI', 'Loan application'), ('Commercial space (sq ft)', D['comm'], 'Loan application'),
 ('Construction type', 'New construction', 'Loan application'), ('Construction start', 'Summer 2027', 'Loan application'), ('Site control?', 'Yes', 'Loan application'),
 ('Previously vacant / blighted?', 'Yes', 'Loan application'), ('Total project cost', D['tdc'], 'Loan application / model'), ('Walk Score', 81, 'Loan application'),
 ('In a strategic neighborhood?', 'Yes', 'Loan application'), ('Permanent jobs', 38, 'Loan application'), ('Construction jobs', 75, 'Loan application'),
 ('Project sources', '; '.join(f'{n} {m(x)}' for n, x in D['sources']), 'Underwriting model'),
 ('Project uses', '; '.join(f'{n} {m(x)}' for n, x in D['uses']), 'Underwriting model'),
 ('Firm financials (revenue / net income)', '; '.join(f'{y} {t}: {m(r)} / {m(n)}' for y, t, r, n in D['fin']), 'Financial statements / model'),
 ('Total assets', D['assets'], 'Financial statements'), ('Total liabilities', D['liabilities'], 'Financial statements'), ('Total equity', D['equity'], 'Financial statements'),
 ('Cash on hand', D['cash'], 'Financial statements'), ('Principal’s ownership of firm (%)', 100, 'Loan application'),
 ('Project projections (revenue / expenses / debt service)', '; '.join(f'{y}: {m(r)} / {m(o)} / {m(d)}' for y, r, o, d in D['proj']), 'Underwriting model'),
 ('Borrower’s vacancy assumption (%)', 5, 'Underwriting model'), ('Expected proceeds to repay loan', D['exit_proceeds'], 'Underwriting model'),
 ('Expected in month', D['exit_month'], 'Underwriting model'), ('Guarantor portfolio DSCR', 1.31, 'Financial statements'),
]
for r in rows: a.append(list(r))
for col, w in zip('ABCDE', [42, 70, 28, 30, 12]): a.column_dimensions[col].width = w
for row in a.iter_rows(min_row=4):
    for c in row: c.alignment = Alignment(wrap_text=True, vertical='top')
    if isinstance(row[1].value, (int, float)) and row[1].value > 1000: row[1].number_format = '#,##0'
a.append([]); a.append(['Notes: the vacancy assumption the underwriter applied (8%) and the rent reduction (7%) are underwriter judgments and are not filled in by the scan.'])
ak.save(os.path.join(OUT, 'Answer Key - what the scan should find.xlsx'))
print('ok')
