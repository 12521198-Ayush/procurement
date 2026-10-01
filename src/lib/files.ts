/** Reads a File as a data: URI; the server ignores the declared type and sniffs the bytes. */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.readAsDataURL(file);
    });
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt';

export function formatBytes(n: number | null | undefined) {
    const v = n || 0;
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
    return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export function humanize(value: string | null | undefined) {
    if (!value) return '';
    return value
        .split('_')
        .map((w) => (w === 'pi' || w === 'po' || w === 'lr' || w === 'grn' ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
}
