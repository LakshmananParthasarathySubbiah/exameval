const { isImagePath } = require('../src/utils/extractText');

describe('isImagePath', () => {
  it('detects image extensions (case-insensitive)', () => {
    expect(isImagePath('answer.jpg')).toBe(true);
    expect(isImagePath('answer.jpeg')).toBe(true);
    expect(isImagePath('scan.PNG')).toBe(true);
    expect(isImagePath('photo.webp')).toBe(true);
  });

  it('treats PDFs and unknown paths as non-images', () => {
    expect(isImagePath('script.pdf')).toBe(false);
    expect(isImagePath('https://x/y/file.pdf')).toBe(false);
    expect(isImagePath('')).toBe(false);
    expect(isImagePath(null)).toBe(false);
  });
});
