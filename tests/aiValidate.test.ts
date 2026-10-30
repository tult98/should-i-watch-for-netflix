import { describe, expect, it } from 'vitest';
import { validateOpinion } from '../src/background/ai/validate';

const good = { summary_vi: 'Tóm tắt.', verdict: 'recommended', reason_vi: 'Lý do một. Lý do hai.' };

describe('validateOpinion', () => {
  it('accepts a good reply', () => {
    expect(validateOpinion(JSON.stringify(good))).toEqual({ ok: true, opinion: good });
  });

  it('strips a ```json fence', () => {
    const text = '```json\n' + JSON.stringify(good, null, 2) + '\n```';
    expect(validateOpinion(text)).toEqual({ ok: true, opinion: good });
  });

  it('takes the outermost object out of surrounding text', () => {
    const text = `Đây là kết quả: ${JSON.stringify(good)} Chúc bạn xem vui.`;
    expect(validateOpinion(text)).toEqual({ ok: true, opinion: good });
  });

  it('trims the strings', () => {
    const result = validateOpinion(JSON.stringify({ ...good, reason_vi: '  Lý do.  ' }));
    expect(result).toMatchObject({ ok: true, opinion: { reason_vi: 'Lý do.' } });
  });

  it('rejects bad JSON', () => {
    expect(validateOpinion('{ "summary_vi": "x", verdict: }')).toMatchObject({ ok: false });
    expect(validateOpinion('no json here')).toMatchObject({ ok: false });
  });

  it('rejects a verdict outside the enum', () => {
    const result = validateOpinion(JSON.stringify({ ...good, verdict: 'must_watch' }));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('verdict') });
  });

  it('rejects a missing field', () => {
    const { reason_vi: _omit, ...rest } = good;
    const result = validateOpinion(JSON.stringify(rest));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('reason_vi') });
  });

  it('rejects an empty string', () => {
    const result = validateOpinion(JSON.stringify({ ...good, summary_vi: '   ' }));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('summary_vi') });
  });
});
