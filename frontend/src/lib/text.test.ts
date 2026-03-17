import { sanitizeDisplayText } from './text';

describe('sanitizeDisplayText', () => {
  it('normalizes nbsp entities and trims the result', () => {
    expect(sanitizeDisplayText(' 論理学１０１&nbsp; ')).toBe('論理学１０１');
    expect(sanitizeDisplayText('教授&nbsp;山田&#160;太郎')).toBe('教授 山田 太郎');
    expect(sanitizeDisplayText('火曜&#xA0;3限')).toBe('火曜 3限');
  });

  it('decodes common html entities used in imported text', () => {
    expect(sanitizeDisplayText('A&amp;B &lt;intro&gt; &#39;test&#39;')).toBe("A&B <intro> 'test'");
  });

  it('returns null for nullish or blank results', () => {
    expect(sanitizeDisplayText(null)).toBeNull();
    expect(sanitizeDisplayText(undefined)).toBeNull();
    expect(sanitizeDisplayText('&nbsp;')).toBeNull();
  });
});
