This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Google Sheets Setup

This app connects to a real Google Spreadsheet through Google Apps Script.

### Spreadsheet structure

- Use one sheet per classroom.
- Sheet names should be the compact classroom codes: `21`, `22`, ... `65`.
- Row 1 should contain these headers:

```text
วันเดือนปี | เลขประจำตัว | เลขที่ | ชื่อ-สกุล | ชั้น | มา | สาย | ลา | ขาด
```

### Deploy Apps Script

1. Open the spreadsheet.
2. Go to `Extensions > Apps Script`.
3. Replace the script with [`Code.gs`](./Code.gs).
4. Deploy as a Web App.
5. Set `Execute as` to `Me`.
6. Set `Who has access` to `Anyone`.
7. Copy the deployed URL into `.env.local`:

```bash
NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXX/exec
```

### Notes

- `getStudents`, `saveStudents`, `deleteStudent`, `getAttendance`, and `saveAttendance` are all supported.
- Attendance rows store the actual save timestamp in the first column, but the sheet is formatted to display dates only.
- If the sheet is empty, you can call the `bootstrapWorkbook` action once from Apps Script to create all classroom tabs and headers.
- The script is currently bound to spreadsheet ID `1ygvqyv5xc0Bu9LoE6-QRrrCMzsdyPed2MZa_TXIQauM`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
