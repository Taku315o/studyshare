import { render, screen } from '@testing-library/react';
import TimetablePage from './page';

jest.mock('@/components/timetable/TimetableGrid', () => () => <div data-testid="timetable-grid">grid</div>);

describe('TimetablePage', () => {
  it('renders navigation to timetable settings modal on me page', () => {
    render(<TimetablePage />);

    const link = screen.getByRole('link', { name: '時間・曜日を変更' });
    expect(link).toHaveAttribute('href', '/me?modal=timetable-settings&from=timetable');
  });
});
