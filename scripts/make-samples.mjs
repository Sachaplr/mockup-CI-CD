// Regenerates the sample files used by demos and E2E tests: `npm run samples`
import { mkdirSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

mkdirSync('samples', { recursive: true });

const good = [
  ['customer', 'email', 'amount', 'date'],
  ['Acme Corp', 'billing@acme.io', 1200.5, '2024-01-15'],
  ['Globex', 'ap@globex.com', 349.5, '2024-02-03'],
  ['Initech', 'finance@initech.com', 80, '2024-02-20'],
];

// 3 valid rows (total 1,630.00)
writeFileSync('samples/sales.csv', good.map((r) => r.join(',')).join('\n') + '\n');

// Same data as a real workbook, with true Excel date cells
const sheet = XLSX.utils.aoa_to_sheet(good.map((r, i) => (i === 0 ? r : [r[0], r[1], r[2], new Date(`${r[3]}T00:00:00Z`)])), { cellDates: true });
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, 'Sales');
writeFileSync('samples/sales.xlsx', XLSX.write(book, { type: 'buffer', bookType: 'xlsx', cellDates: true }));

// 1 valid + 3 problem rows, to demo validation
writeFileSync(
  'samples/sales-with-errors.csv',
  [
    'customer,email,amount,date',
    'Umbrella,ops@umbrella.com,500,2024-03-01',
    ',not-an-email,10,2024-03-02',
    'Hooli,cfo@hooli.com,-20,2024-03-03',
    'Stark,tony@stark.io,99,2024-02-30',
  ].join('\n') + '\n',
);

console.log('samples written to ./samples');
