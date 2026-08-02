/**
 * High-precision PDF text extraction utility
 * Converts PDF file to base64 and calls backend PDFParse API endpoint for exact text extraction
 */
export async function extractTextFromPDF(file) {
  const token = localStorage.getItem('token');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer) {
          return resolve('');
        }

        // Convert ArrayBuffer to Base64
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5000';
        const headers = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${gatewayUrl}/api/v1/sessions/parse-pdf`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pdfBase64: base64 }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.text && data.text.length > 10) {
            return resolve(data.text);
          }
        }

        // Fallback: If API returns error or is unreachable, extract printable text streams
        const decoder = new TextDecoder('latin1');
        const rawText = decoder.decode(arrayBuffer);
        const printableText = rawText
          .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const matches = printableText.match(/[A-Za-z0-9\s,.@+\-()/]{4,}/g) || [];
        resolve(matches.join(' ').replace(/\s+/g, ' ').trim());
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse PDF document'));
      }
    };

    reader.onerror = () => reject(new Error('Error reading PDF file'));
    reader.readAsArrayBuffer(file);
  });
}
